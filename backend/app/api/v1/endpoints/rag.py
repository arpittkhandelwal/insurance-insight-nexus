"""RAG Policy & SOP assistant — ingest docs, embed, retrieve, answer."""

from __future__ import annotations

import os
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

router = APIRouter()


class RagRequest(BaseModel):
    query: str
    top_k: int = 3
    doc_filter: Optional[str] = None  # filter by filename


class RagChunk(BaseModel):
    document: str
    chunk_id: str
    text: str
    score: float


class RagResponse(BaseModel):
    answer: str
    citations: List[RagChunk]
    ai_badge: str = "AI Analytical Insight — Verify against original policy wording."


# Lazy-loaded RAG engine
_rag_engine = None


def _get_rag_engine():
    global _rag_engine
    if _rag_engine is None:
        from app.services.rag_engine import RAGEngine
        _rag_engine = RAGEngine()
        _rag_engine.build_index()
    return _rag_engine


@router.post("/query", response_model=RagResponse)
async def rag_query(body: RagRequest) -> RagResponse:
    """
    Answer a question about policy wordings, SOPs, or claim handling guides.
    Uses FAISS vector search + LLM synthesis.
    """
    engine = _get_rag_engine()
    return await engine.query(body.query, body.top_k)


@router.get("/documents")
async def list_documents() -> dict:
    """List indexed documents."""
    docs_dir = Path("data/docs")
    if not docs_dir.exists():
        return {"documents": [], "message": "Run make seed to generate documents"}
    docs = [f.name for f in docs_dir.glob("*.md")]
    return {"documents": docs, "count": len(docs)}
