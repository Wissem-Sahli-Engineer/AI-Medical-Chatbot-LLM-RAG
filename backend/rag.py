"""RAG pipeline of the medical chatbot (final configuration of medical_chatbot_rag.ipynb).

Dense retrieval (multilingual E5 + FAISS) over PubMedQA abstracts and MedQuAD answers,
keyword rules + LLM triage as guardrails, MedGemma 1.5 4B (Q4) served by Ollama.
"""
import json
import os
import re
import time
from pathlib import Path

import faiss
import numpy as np
import pandas as pd
import requests
import torch
from datasets import load_dataset
from sentence_transformers import SentenceTransformer

os.environ["TOKENIZERS_PARALLELISM"] = "false"
# On macOS, FAISS and PyTorch each ship OpenMP: multi-threaded FAISS search crashes the process.
faiss.omp_set_num_threads(1)

SEED = 42
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
LLM_MODEL = os.environ.get("LLM_MODEL", "hf.co/unsloth/medgemma-1.5-4b-it-GGUF:Q4_K_M")
EMB_MODEL = "intfloat/multilingual-e5-small"
NUM_CTX = 4096
TOP_K = 3
# The notebook's evaluation indexes a 3,000-answer sample; the app indexes all of MedQuAD for coverage.
N_MEDQUAD_DOCS = int(os.environ.get("MEDQUAD_DOCS", "0")) or None
CHUNK_SIZE, CHUNK_OVERLAP = 200, 40
CACHE_DIR = Path(__file__).parent / "cache"
DEVICE = "mps" if torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu")


# ---------------------------------------------------------------- knowledge base

def chunk_text(text, size=CHUNK_SIZE, overlap=CHUNK_OVERLAP):
    words = text.split()
    if len(words) <= size:
        return [" ".join(words)]
    step = size - overlap
    return [" ".join(words[i:i + size]) for i in range(0, len(words) - overlap, step)]


def load_documents():
    # Same data and cleaning as the notebook (section 3). The original question is kept as a
    # display title only; the indexed text is the abstract or answer, as in the evaluation.
    pqa = load_dataset("qiaojin/PubMedQA", "pqa_labeled", split="train")
    pqa_df = pd.DataFrame({
        "doc_id": [f"pqa_{p}" for p in pqa["pubid"]],
        "source": "PubMedQA",
        "title": pqa["question"],
        "url": [f"https://pubmed.ncbi.nlm.nih.gov/{p}/" for p in pqa["pubid"]],
        "text": [" ".join(c["contexts"]) for c in pqa["context"]],
    })
    mq = (load_dataset("keivalya/MedQuad-MedicalQnADataset", split="train").to_pandas()
          .rename(columns={"Question": "question", "Answer": "answer"})
          .dropna(subset=["question", "answer"]))
    mq["question"] = mq["question"].str.strip().str.replace(r"\s*\?+\s*\?*$", " ?", regex=True)
    mq["answer"] = mq["answer"].str.strip()
    mq = mq[mq["answer"].str.split().str.len() >= 20]
    mq = mq.drop_duplicates("answer").drop_duplicates("question")
    if N_MEDQUAD_DOCS:
        mq = mq.sample(N_MEDQUAD_DOCS, random_state=SEED)
    mq = mq.reset_index(drop=True)
    mq_df = pd.DataFrame({
        "doc_id": [f"mq_{i}" for i in range(len(mq))],
        "source": "MedQuAD",
        "title": mq["question"],
        "url": None,
        "text": mq["answer"],
    })
    return pd.concat([pqa_df, mq_df], ignore_index=True)


def build_chunks(docs):
    rows = []
    for d in docs.itertuples():
        for j, ch in enumerate(chunk_text(d.text)):
            rows.append({"chunk_id": f"{d.doc_id}#{j}", "doc_id": d.doc_id, "source": d.source,
                         "title": d.title, "url": d.url, "text": ch})
    return pd.DataFrame(rows)


class Retriever:
    """Dense retriever (the best configuration in experiment E1). Embeddings are cached on disk."""

    def __init__(self):
        self.model = SentenceTransformer(EMB_MODEL, device=DEVICE)
        CACHE_DIR.mkdir(exist_ok=True)
        chunks_path, emb_path = CACHE_DIR / "chunks.parquet", CACHE_DIR / "embeddings.npy"
        if chunks_path.exists() and emb_path.exists():
            self.chunks = pd.read_parquet(chunks_path)
            emb = np.load(emb_path)
        else:
            self.chunks = build_chunks(load_documents())
            emb = self._encode(["passage: " + t for t in self.chunks["text"]])
            self.chunks.to_parquet(chunks_path)
            np.save(emb_path, emb)
        self.index = faiss.IndexFlatIP(emb.shape[1])
        self.index.add(emb)

    def _encode(self, texts):
        return self.model.encode(texts, batch_size=64, normalize_embeddings=True,
                                 convert_to_numpy=True, show_progress_bar=False).astype("float32")

    def search(self, query, k=TOP_K):
        scores, idx = self.index.search(self._encode(["query: " + query]), k)
        return [(int(i), float(s)) for i, s in zip(idx[0], scores[0])]


# ---------------------------------------------------------------- LLM client

NO_REASONING = "\n\nGive only the final answer. Do not show any reasoning or analysis steps."
ANSWER_PREFILL = {"fr": "Réponse :", "en": "Answer:"}
TRUNCATE_RE = re.compile(r"\n\s*(\[\d+\]\s|CONTEXT:|QUESTION:)")


def gemma_prompt(user_content, prefill=""):
    return f"<start_of_turn>user\n{user_content}<end_of_turn>\n<start_of_turn>model\n{prefill}"


def is_thinking(text):
    return bool(re.match(r"^\s*thought\b", text))


def _options(max_tokens, repeat_penalty=None):
    o = {"num_ctx": NUM_CTX, "num_predict": max_tokens, "temperature": 0.0, "seed": SEED}
    if repeat_penalty:
        o["repeat_penalty"] = repeat_penalty
    return o


def _clean(text):
    text = text.replace("<end_of_turn>", "")
    if "<unused95>" in text:
        text = text.split("<unused95>")[-1]
    return text.strip()


def generate(user_content, max_tokens=300, prefill="", repeat_penalty=None):
    def call(content):
        r = requests.post(f"{OLLAMA_URL}/api/generate", timeout=600, json={
            "model": LLM_MODEL, "prompt": gemma_prompt(content, prefill), "raw": True, "stream": False,
            "keep_alive": "15m", "options": _options(max_tokens, repeat_penalty)})
        r.raise_for_status()
        return _clean(r.json()["response"])

    text = call(user_content)
    if is_thinking(text):
        text = call(user_content + NO_REASONING)
    return text


def stream_answer(prompt, lang, max_tokens=300, repeat_penalty=1.15, holdback=12):
    """Stream a long answer token by token.

    The first characters are held until we know the model did not start a "thought" block
    (if it did, the answer is regenerated without streaming). A short tail is always held
    back so that the answer can be cut cleanly if the model starts copying a context passage.
    """
    body = {"model": LLM_MODEL, "prompt": gemma_prompt(prompt, ANSWER_PREFILL[lang]), "raw": True,
            "stream": True, "keep_alive": "15m", "options": _options(max_tokens, repeat_penalty)}
    buf, sent, checked = "", 0, False
    with requests.post(f"{OLLAMA_URL}/api/generate", json=body, stream=True, timeout=600) as r:
        r.raise_for_status()
        for line in r.iter_lines():
            if not line:
                continue
            part = json.loads(line)
            buf += part.get("response", "").replace("<end_of_turn>", "")
            if not checked:
                if len(buf.strip()) < 12 and not part.get("done"):
                    continue
                checked = True
                if is_thinking(buf):
                    break
                buf = buf.lstrip()
            m = TRUNCATE_RE.search(buf)
            if m:
                buf = buf[:m.start()]
                break
            if part.get("done"):
                break
            if len(buf) - holdback > sent:
                yield buf[sent:len(buf) - holdback]
                sent = len(buf) - holdback
    if checked and not is_thinking(buf):
        final = buf.rstrip()
        if len(final) > sent:
            yield final[sent:]
        return
    # Thought block detected: regenerate once without streaming.
    text = generate(prompt + NO_REASONING, max_tokens, ANSWER_PREFILL[lang], repeat_penalty)
    m = TRUNCATE_RE.search(text)
    yield text[:m.start()].strip() if m else text


def ollama_status():
    try:
        tags = requests.get(f"{OLLAMA_URL}/api/tags", timeout=3).json()
        return "ready" if any(m["name"] == LLM_MODEL for m in tags.get("models", [])) else "model_missing"
    except requests.RequestException:
        return "offline"


# ---------------------------------------------------------------- guardrails

TOKEN_RE = re.compile(r"\w+")
FR_HINTS = set("le la les des une est que qui quoi quel quelle quels quelles comment pourquoi je j ai mon ma mes "
               "avec pour dans sur pas du au aux est-ce mal douleur médicament traitement".split())


def detect_lang(text):
    words = TOKEN_RE.findall(text.lower())
    fr = sum(w in FR_HINTS for w in words) + 2 * bool(re.search(r"[éèêàùçôî]", text.lower()))
    return "fr" if fr >= 2 else "en"


EMERGENCY_PATTERNS = [
    r"douleurs? (dans la |à la |a la )?(poitrine|thoracique)", r"oppression thoracique", r"chest (pain|tightness|pressure)",
    r"(du mal|difficult[ée]s?) à respirer", r"(n'arrive|n arrive) (plus |pas )?à respirer", r"j'?\s?étouffe",
    r"(can'?t|cannot|unable to|struggling to|hard to) breathe", r"short(ness)? of breath",
    r"heart attack", r"crise cardiaque", r"infarctus",
    r"\bavc\b", r"\bstroke\b", r"visage (qui )?(tombe|paralys)", r"face (is )?droop", r"slurred speech",
    r"(parle|parler) (mal|difficilement)", r"paralys", r"(can'?t|cannot) move (my|his|her) (arm|leg)",
    r"(ne peut|n'arrive) (plus|pas) (à )?bouger",
    r"suicid", r"me tuer", r"en finir", r"kill (myself|me)", r"end my life", r"mettre fin à (mes jours|ma vie)",
    r"want to die", r"envie de mourir",
    r"overdose", r"surdose", r"(avalé|pris) (toute la boîte|toute la boite|trop de)", r"took (too many|the whole bottle)",
    r"saigne (beaucoup|abondamment)", r"hémorragie", r"(bleeding|bleeds) (heavily|a lot|won'?t stop)",
    r"perte de connaissance", r"(s'est )?évanoui", r"inconscient", r"unconscious", r"passed out", r"not breathing",
    r"convulsion", r"seizure", r"crise d'épilepsie", r"anaphyla", r"(gorge|langue|lèvres?|visage) (qui )?(gonfle|enfle)",
    r"(throat|tongue|lips?|face) (is |are )?swell",
]
PRESCRIPTION_PATTERNS = [
    r"\bposologie\b", r"quelle dose", r"combien de (comprimés|mg|cachets|gélules)", r"(dois-je|je dois|puis-je) prendre",
    r"prescri", r"ordonnance", r"how (much|many) (mg |pills |tablets )?should i take", r"what dose", r"dosage",
    r"should i (take|stop|start)", r"arrêter mon traitement", r"remplacer mon (traitement|médicament)",
]
DIAGNOSIS_PATTERNS = [
    r"est-ce que j'?\s?ai (un|une|le|la|du|des)", r"ai-je (un|une|le|la)", r"quelle maladie (ai-je|j'?ai)",
    r"do i have", r"what (disease|illness|condition) do i have", r"am i (sick|ill)",
]

EMERGENCY_MSG = {
    "fr": ("**Votre message décrit une situation potentiellement urgente.** Appelez immédiatement les secours "
           "(15 ou 112 en France / Europe, ou le numéro d'urgence de votre pays) ou rendez-vous aux urgences. "
           "En cas de pensées suicidaires, appelez le 3114 (France) ou une ligne d'écoute locale. "
           "Je ne peux pas évaluer une urgence médicale."),
    "en": ("**Your message describes a potentially urgent situation.** Call emergency services now "
           "(911 in the US, 112 in Europe, or your local emergency number) or go to the nearest emergency department. "
           "If you are having suicidal thoughts, call or text 988 (US) or a local crisis line. "
           "I cannot assess a medical emergency."),
}
OUT_OF_SCOPE_MSG = {
    "fr": "Je suis un assistant d'information médicale : cette question sort de mon périmètre. Je peux répondre à des questions sur les maladies, les symptômes, les médicaments ou les examens.",
    "en": "I am a medical information assistant, so this question is outside my scope. I can answer questions about diseases, symptoms, medicines or medical tests.",
}
CAUTION_NOTE = {
    "prescription": {"fr": "Je ne peux pas prescrire ni conseiller une dose : demandez à votre médecin ou à votre pharmacien.",
                     "en": "I cannot prescribe or recommend a dose: please ask your doctor or pharmacist."},
    "diagnosis": {"fr": "Je ne peux pas poser de diagnostic : seul un professionnel de santé peut le faire après examen.",
                  "en": "I cannot make a diagnosis: only a health professional can, after an examination."},
}
DISCLAIMER = {"fr": "Information générale, ne remplace pas l'avis d'un professionnel de santé.",
              "en": "General information only; it does not replace advice from a health professional."}


def match_any(patterns, text):
    t = text.lower()
    return any(re.search(p, t) for p in patterns)


def classify_intent(question):
    if match_any(EMERGENCY_PATTERNS, question):
        return "emergency"
    if match_any(PRESCRIPTION_PATTERNS, question):
        return "prescription"
    if match_any(DIAGNOSIS_PATTERNS, question):
        return "diagnosis"
    return "medical_info"


TRIAGE_PROMPT = '''Classify the user message into exactly one category:
EMERGENCY: describes symptoms or a situation that may need urgent medical help right now (for example sudden weakness or numbness, collapse or unresponsiveness, severe breathing difficulty, chest pain, heavy bleeding, poisoning or overdose, suicidal thoughts).
MEDICAL: a question about health, diseases, symptoms, medicines, tests or treatments that is not an emergency.
OTHER: anything not related to health or medicine.

Message: {question}
Category (EMERGENCY, MEDICAL or OTHER):'''


def llm_triage(question):
    out = generate(TRIAGE_PROMPT.format(question=question), max_tokens=6, prefill="Category:").upper()
    m = re.search(r"EMERGENCY|MEDICAL|OTHER", out)
    return m.group(0) if m else "MEDICAL"


def route(question):
    lang, intent = detect_lang(question), classify_intent(question)
    r = {"lang": lang, "intent": intent, "triage": None}
    if intent == "emergency":
        return {**r, "category": "emergency"}
    r["triage"] = llm_triage(question)
    if r["triage"] == "EMERGENCY":
        return {**r, "category": "emergency"}
    if r["triage"] == "OTHER":
        return {**r, "category": "out_of_scope"}
    return {**r, "category": intent if intent in CAUTION_NOTE else "answered"}


# ---------------------------------------------------------------- chatbot

LANG_NAME = {"fr": "in French", "en": "in English"}
RELEVANCE_PROMPT = '''Passages:
{context}

Question: {question}

Do the passages above contain information that answers this question? Answer YES or NO.'''

NOT_FOUND_MSG = {
    "fr": "Je n'ai pas trouvé d'information sur ce sujet dans mes sources (PubMed et pages santé du NIH). Je préfère ne pas répondre de mémoire : consultez un professionnel de santé ou une source officielle.",
    "en": "I could not find information on this topic in my sources (PubMed and NIH health pages). I prefer not to answer from memory: please ask a health professional or check an official source.",
}

TRANSLATE_PROMPT = "Translate the following question into English. Output only the English translation, nothing else.\n\n{question}"
RAG_PROMPT = '''You are a careful medical information assistant. You are NOT a doctor.
Rules:
- Answer ONLY with information found in the CONTEXT. If the context does not contain the answer, say clearly that you do not know.
- Use only passages that are about the subject of the question; ignore passages about other diseases or other medicines.
- After EVERY sentence, cite the passage it comes from with its number in brackets, for example: "Metformin can cause nausea [1]."
- Never give a diagnosis. Never prescribe, dose or change a treatment; advise consulting a health professional instead.
- Write {lang_name}, for a non-expert reader: a SHORT answer of 3 to 5 sentences in your own words. Summarise; never copy the passages.

CONTEXT:
{context}

QUESTION: {question}
ANSWER (3 to 5 short sentences, each ending with its citation [n]):'''


def chat_events(question, retriever):
    """Yield the chatbot's answer as a sequence of events (dicts) for the streaming API."""
    t0 = time.time()
    r = route(question)
    lang = r["lang"]
    yield {"type": "meta", **r}

    if r["category"] == "emergency":
        yield {"type": "token", "text": EMERGENCY_MSG[lang]}
    elif r["category"] == "out_of_scope":
        yield {"type": "token", "text": OUT_OF_SCOPE_MSG[lang]}
    else:
        query = question if lang == "en" else generate(TRANSLATE_PROMPT.format(question=question), max_tokens=100).strip('"')
        hits = retriever.search(query)
        sources = []
        for n, (i, score) in enumerate(hits, 1):
            ch = retriever.chunks.iloc[i]
            url = ch["url"] if isinstance(ch["url"], str) else None   # MedQuAD rows have no URL (NaN after the cache)
            sources.append({"n": n, "title": ch["title"], "source": ch["source"], "url": url,
                            "chunk_id": ch["chunk_id"], "score": round(score, 3), "text": ch["text"]})
        yield {"type": "sources", "query": query, "sources": sources}
        context = "\n\n".join(f"[{s['n']}] ({s['source']}) {s['text']}" for s in sources)
        # Relevance check: never answer from the model's memory with citations that do not support it.
        relevant = generate(RELEVANCE_PROMPT.format(context=context, question=query), max_tokens=4, prefill="Answer:")
        if "NO" in relevant.upper() and "YES" not in relevant.upper():
            yield {"type": "sources", "query": query, "sources": []}
            yield {"type": "token", "text": NOT_FOUND_MSG[lang]}
        else:
            prompt = RAG_PROMPT.format(lang_name=LANG_NAME[lang], context=context, question=question)
            for piece in stream_answer(prompt, lang):
                yield {"type": "token", "text": piece}
        if r["category"] in CAUTION_NOTE:
            yield {"type": "caution", "text": CAUTION_NOTE[r["category"]][lang]}

    yield {"type": "done", "disclaimer": DISCLAIMER[lang], "latency_s": round(time.time() - t0, 1)}
