# AI Medical Chatbot using LLMs and RAG

A medical question-answering assistant that runs **100% locally** on a modest computer. It combines a small open-source medical LLM, **MedGemma 1.5 4B** quantized to 4 bits, with **retrieval-augmented generation (RAG)** over PubMed and NIH documents. Answers are grounded in cited sources, and safety guardrails handle emergencies, dosage requests and off-topic questions.

> ⚠️ This is an academic project. It gives general health information and **does not replace a health professional**. Do not use it for medical decisions.

## Key results

| Experiment | Result |
| --- | --- |
| Retrieval (E1) | Dense search wins: Recall@5 of **98.9%** (PubMedQA) and **93.3%** (MedQuAD) |
| Open answers (E3, MedQuAD) | RAG raises token F1 from **0.17 to 0.63** and grounding from **0.35 to 0.92**; 60% of answers cite a source |
| Safety guardrails (E4) | **96%** routing accuracy (23/24) with rules + LLM triage, vs 67% with rules + a similarity threshold |
| PubMedQA yes/no/maybe (E2) | About **54%** with or without RAG, below the 56.7% "always yes" baseline: the 4B model struggles to read scientific evidence |
| Resources (E5) | LLM uses **2.9 GB** of memory; the whole stack runs in under 4 GB |

Full analysis, failure cases and limitations are in the notebook (sections 7 to 9).

## How it works

```text
Offline:  PubMedQA + MedQuAD (4,000 docs) → 200-word chunks → multilingual-e5-small embeddings → FAISS index

Online:   user message
            → emergency keyword rules ─────────────► emergency message (no generation)
            → LLM triage: EMERGENCY / MEDICAL / OTHER
                 EMERGENCY ─────────────────────────► emergency message
                 OTHER ─────────────────────────────► out-of-scope reply
            → intent rules (dose / diagnosis request → caution note)
            → French question translated to English
            → dense search, top 3 passages
            → MedGemma 1.5 4B (Q4, Ollama) with a strict prompt
            → answer with [n] citations, in the user's language, plus a medical disclaimer
```

| Component | Choice |
| --- | --- |
| LLM | MedGemma 1.5 4B-it, GGUF Q4_K_M, served by [Ollama](https://ollama.com) |
| Embeddings | `intfloat/multilingual-e5-small` (118 M parameters) |
| Vector search | FAISS `IndexFlatIP` (BM25 and hybrid RRF also compared) |
| Data | [PubMedQA](https://huggingface.co/datasets/qiaojin/PubMedQA) (`pqa_labeled`) and [MedQuAD](https://huggingface.co/datasets/keivalya/MedQuad-MedicalQnADataset) |

## Repository

| File | Content |
| --- | --- |
| `medical_chatbot_rag.ipynb` | The whole project, executed with its results: introduction, state of the art, data, methodology, implementation, experiments, critical analysis, limitations, references |
| `requirements.txt` | Python dependencies |
| `methodologie.txt` | Outline of the report |

## Getting started

**1. Install Ollama and pull the model** (about 2.5 GB):

```bash
ollama pull hf.co/unsloth/medgemma-1.5-4b-it-GGUF:Q4_K_M
```

**2. Create a Python environment and install the dependencies** (tested with Python 3.14):

```bash
python3 -m venv ~/venvs/medical-chatbot
~/venvs/medical-chatbot/bin/pip install -r requirements.txt
~/venvs/medical-chatbot/bin/python -m ipykernel install --user --name medical-chatbot
```

> On macOS, keep the virtual environment **outside** iCloud-synced folders such as Desktop or Documents. iCloud can offload its files to the cloud, which makes imports extremely slow.

**3. Run the notebook** with the `medical-chatbot` kernel, Ollama running in the background. A full run takes about 1 hour on an Apple M4, mostly for the PubMedQA evaluation (450 LLM calls). The datasets and the embedding model download automatically on first run.

To try the chatbot only, run the cells up to section 5.6, build the retriever, then:

```python
medical_chatbot("Comment se transmet la maladie de Lyme ?", retriever, method="dense")
```

## Limitations

- English-only corpus; MedQuAD contains no drug leaflets, so the chatbot cannot answer reliably about medicines.
- Small evaluation samples, and no review by health professionals.
- The model sometimes merges passages, adds uncited claims or copies the context; one stroke warning case was missed by the guardrails.
- Latency was measured on an Apple M4 only (8 to 16 s per answer); it will be slower on a PC without a GPU.

## Roadmap

- [ ] FastAPI backend with a streaming `/chat` route
- [ ] React front end showing cited sources and the disclaimer
- [ ] French and drug-information sources
- [ ] Recall-oriented emergency classifier
- [ ] Phase 2: QLoRA fine-tuning of the answer format (skeleton already in the notebook, section 9.3)
- [ ] Evaluation by health professionals

## Author

Wissem Sahli
