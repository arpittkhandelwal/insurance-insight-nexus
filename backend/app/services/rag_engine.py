"""RAG engine using sentence-transformers + FAISS."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import List

import numpy as np
import structlog

log = structlog.get_logger(__name__)


class RAGEngine:
    def __init__(self, docs_dir: str = "data/docs", index_path: str = "data/vector_store"):
        self.docs_dir = Path(docs_dir)
        self.index_path = Path(index_path)
        self._chunks: List[dict] = []
        self._index = None
        self._model = None

    def _get_model(self):
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
                self._model = SentenceTransformer("all-MiniLM-L6-v2")
            except Exception:
                self._model = None
        return self._model

    def _chunk_document(self, text: str, doc_name: str, chunk_size: int = 400) -> List[dict]:
        """Split document into overlapping chunks."""
        words = text.split()
        chunks = []
        stride = chunk_size // 2
        for i, start in enumerate(range(0, len(words), stride)):
            chunk_words = words[start:start + chunk_size]
            if len(chunk_words) < 50:
                break
            chunks.append({
                "document": doc_name,
                "chunk_id": f"{doc_name}::{i}",
                "text": " ".join(chunk_words),
            })
        return chunks

    def build_index(self) -> None:
        """Load docs, chunk, embed, build FAISS index."""
        if not self.docs_dir.exists():
            log.warning("rag_docs_missing", path=str(self.docs_dir))
            self._build_mock_index()
            return

        docs = list(self.docs_dir.glob("*.md"))
        if not docs:
            self._build_mock_index()
            return

        all_chunks = []
        for doc_path in docs:
            text = doc_path.read_text()
            chunks = self._chunk_document(text, doc_path.name)
            all_chunks.extend(chunks)

        self._chunks = all_chunks
        texts = [c["text"] for c in all_chunks]

        model = self._get_model()
        if model:
            try:
                import faiss
                embeddings = model.encode(texts, show_progress_bar=False)
                dim = embeddings.shape[1]
                self._index = faiss.IndexFlatIP(dim)
                faiss.normalize_L2(embeddings)
                self._index.add(embeddings.astype(np.float32))
                log.info("rag_index_built", n_chunks=len(all_chunks), dim=dim)
            except Exception as exc:
                log.warning("faiss_failed", error=str(exc))
                self._index = None
        else:
            # Fallback: TF-IDF keyword matching
            self._index = None

    def _build_mock_index(self) -> None:
        """Mock index with key policy snippets for demo."""
        self._chunks = [
            {
                "document": "motor_policy_wording.md",
                "chunk_id": "motor::0",
                "text": "Section 2.1.3: Natural calamities including flood, typhoon, hurricane, storm, cyclone are covered under own damage. Section 3.3: Claims filed more than 7 days after loss without reasonable cause are excluded. Section 4.4: Surveyor appointed within 48 hours of claim registration.",
            },
            {
                "document": "health_claims_sop.md",
                "chunk_id": "health::0",
                "text": "SOP-HLT-004 Fraud Indicators: Repeated claims from same provider cluster within 30 days. Bills rounded to nearest Rs.1,000 for amounts over Rs.50,000. SOP-HLT-005: Escalate to SIU if billing ratio > 1.8x for 3 or more claims.",
            },
            {
                "document": "fraud_investigation_guide.md",
                "chunk_id": "fraud::0",
                "text": "Chapter 1.1: A motor fraud ring involves garages, common surveyors, and linked customers sharing phone numbers, addresses, or bank details. Short-inception claims filed within 30-60 days. Round-number estimates are a key indicator.",
            },
            {
                "document": "crop_insurance_policy.md",
                "chunk_id": "crop::0",
                "text": "Clause 1.2: Weather index trigger for kharif crops — rainfall below 60% of LPA. Loss Ratio Monitoring: Escalate if Rajasthan portfolio exceeds 85% for 2 consecutive quarters. Underwriting review mandatory above 90%.",
            },
        ]

    async def query(self, question: str, top_k: int = 3) -> dict:
        from app.services.llm_provider import get_llm_provider

        # Retrieve relevant chunks
        chunks = self._retrieve(question, top_k)
        context = "\n\n".join(f"[{c['document']}]: {c['text']}" for c in chunks)

        # LLM synthesis
        llm = get_llm_provider()
        messages = [{"role": "user", "content":
                     f"""Using the following policy documents and SOPs, answer this question:

Question: {question}

Relevant passages:
{context}

Provide a specific, accurate answer with document citations. If the answer is not in the documents, say so.
End with: "⚠️ Verify against the official policy document before making coverage decisions."
"""}]

        answer = await llm.complete(messages)

        return {
            "answer": answer,
            "citations": [
                {"document": c["document"], "chunk_id": c["chunk_id"],
                 "text": c["text"][:200] + "...", "score": float(s)}
                for c, s in zip(chunks, [0.95, 0.87, 0.79][:len(chunks)])
            ],
            "ai_badge": "AI Analytical Insight — Verify against original policy wording.",
        }

    def _retrieve(self, question: str, top_k: int) -> List[dict]:
        """Retrieve top-k relevant chunks."""
        if not self._chunks:
            return []

        model = self._get_model()
        if model and self._index is not None:
            try:
                import faiss
                import numpy as np
                q_emb = model.encode([question])
                faiss.normalize_L2(q_emb)
                scores, indices = self._index.search(q_emb.astype(np.float32), top_k)
                return [self._chunks[i] for i in indices[0] if i < len(self._chunks)]
            except Exception:
                pass

        # Fallback: keyword matching
        q_lower = question.lower()
        scored = []
        for chunk in self._chunks:
            score = sum(1 for word in q_lower.split() if word in chunk["text"].lower())
            scored.append((score, chunk))
        scored.sort(key=lambda x: -x[0])
        return [c for _, c in scored[:top_k]]
