"""FastAPI server for the medical chatbot.

Run from the project root:
    ~/venvs/medical-chatbot/bin/uvicorn backend.app:app --port 8000
"""
import json
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from . import rag

state = {"retriever": None, "error": None}


def _load():
    try:
        state["retriever"] = rag.Retriever()
    except Exception as e:  # reported by /api/health
        state["error"] = str(e)


@asynccontextmanager
async def lifespan(app):
    # Load the index in the background so the server answers /api/health right away.
    threading.Thread(target=_load, daemon=True).start()
    yield


app = FastAPI(title="Medical RAG Chatbot", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5180"], allow_methods=["*"], allow_headers=["*"])


class HistoryItem(BaseModel):
    role: str
    content: str


class FileIn(BaseModel):
    name: str
    data: str  # base64, without the "data:...;base64," prefix


class ChatRequest(BaseModel):
    message: str = Field(default="", max_length=4000)
    history: list[HistoryItem] = Field(default=[], max_length=20)
    images: list[str] = Field(default=[], max_length=3)       # base64 images
    files: list[FileIn] = Field(default=[], max_length=3)     # PDF, TXT or MD
    show_reasoning: bool = False
    top_k: int = Field(default=3, ge=1, le=5)


@app.get("/api/health")
def health():
    return {
        "index": "ready" if state["retriever"] else ("error" if state["error"] else "loading"),
        "index_error": state["error"],
        "llm": rag.ollama_status(),
        "model": rag.LLM_MODEL,
        "chunks": len(state["retriever"].chunks) if state["retriever"] else None,
    }


@app.post("/api/chat")
def chat(req: ChatRequest):
    if state["retriever"] is None:
        raise HTTPException(503, "The knowledge base is still loading. Try again in a moment.")
    if rag.ollama_status() != "ready":
        raise HTTPException(503, "Ollama is not running or the MedGemma model is missing.")

    if not req.message.strip() and not req.images:
        raise HTTPException(422, "Write a message or attach an image.")
    if sum(len(f.data) for f in req.files) > 20_000_000:
        raise HTTPException(413, "Attached files are too large (15 MB maximum in total).")

    def events():
        try:
            for ev in rag.chat_events(state["retriever"], req.message, history=[h.model_dump() for h in req.history],
                                      images=req.images, files=[f.model_dump() for f in req.files],
                                      show_reasoning=req.show_reasoning, top_k=req.top_k):
                yield json.dumps(ev, ensure_ascii=False, allow_nan=False) + "\n"
        except Exception as e:
            yield json.dumps({"type": "error", "message": str(e)}) + "\n"

    return StreamingResponse(events(), media_type="application/x-ndjson")
