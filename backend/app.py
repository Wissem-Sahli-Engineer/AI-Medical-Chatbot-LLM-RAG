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


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


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

    def events():
        try:
            for ev in rag.chat_events(req.message.strip(), state["retriever"]):
                yield json.dumps(ev, ensure_ascii=False, allow_nan=False) + "\n"
        except Exception as e:
            yield json.dumps({"type": "error", "message": str(e)}) + "\n"

    return StreamingResponse(events(), media_type="application/x-ndjson")
