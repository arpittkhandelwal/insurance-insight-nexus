"""
Ask Nexus endpoint — SSE streaming agentic NL query endpoint.
"""

from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.nl_agent import NLAgent
from app.services.llm_provider import get_llm_provider

router = APIRouter()


class AskRequest(BaseModel):
    question: str
    session_id: Optional[str] = None
    language: str = "en"  # en | hi


@router.post("/stream")
async def ask_stream(body: AskRequest, request: Request) -> StreamingResponse:
    """
    Streams the 10-step agent trace as Server-Sent Events.
    Each SSE event is a JSON object: {"type": "...", "data": {...}}
    Frontend shows each step in real-time with timing.
    """
    llm = get_llm_provider()
    db = request.app.state.db
    agent = NLAgent(llm=llm, db=db)

    async def event_generator():
        try:
            async for event in agent.run(
                question=body.question,
                session_id=body.session_id,
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'data': {'message': str(exc)}})}\n\n"
        finally:
            yield "data: {\"type\": \"end\"}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/suggestions")
async def get_suggestions(category: Optional[str] = Query(None)) -> dict:
    """Pre-built question suggestions for the Ask Nexus UI."""
    suggestions = {
        "monsoon": [
            "Why did motor claims spike in Kerala in July 2022?",
            "Show the flood claim trend for Maharashtra in 2022",
            "What was the financial impact of the July 2022 monsoon flood?",
        ],
        "fraud": [
            "Show me the top 10 fraud risk claims this month",
            "Which garages are part of the detected fraud ring?",
            "What is the total fraud exposure in Motor claims?",
        ],
        "analytics": [
            "What is the loss ratio by product line for 2023?",
            "Compare settlement days by adjuster for Health claims",
            "Which state has the highest claim frequency?",
        ],
        "portfolio": [
            "Show the Rajasthan crop loss ratio trend since 2020",
            "Which product line has the worst combined ratio?",
            "What percentage of policies are at risk of lapsing?",
        ],
    }
    if category and category in suggestions:
        return {"questions": suggestions[category]}
    all_qs = []
    for qs in suggestions.values():
        all_qs.extend(qs)
    return {"questions": all_qs, "categories": list(suggestions.keys())}
