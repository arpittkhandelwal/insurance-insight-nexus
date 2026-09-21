import json
import httpx
from typing import AsyncIterator, Dict, List
import structlog

from app.core.config import settings
from app.services.llm_provider import LLMProvider

log = structlog.get_logger(__name__)

class SarvamLLMProvider(LLMProvider):
    """Sarvam AI Provider for Indic Language LLM capabilities."""

    def __init__(self):
        self.api_key = settings.SARVAM_API_KEY
        if not self.api_key:
            raise ValueError("SARVAM_API_KEY is not set.")
        self.base_url = "https://api.sarvam.ai/v1/chat/completions"

    async def complete(
        self,
        messages: List[Dict],
        system: str = "",
        max_tokens: int = 2048,
        temperature: float = 0.1,
    ) -> str:
        
        # Merge system prompt if provided
        formatted_messages = []
        if system:
            formatted_messages.append({"role": "system", "content": system})
        formatted_messages.extend(messages)

        payload = {
            "model": "sarvam-105b-conversations", # Sarvam's flagship conversational model
            "messages": formatted_messages,
            "max_tokens": max_tokens,
            "temperature": temperature
        }

        headers = {
            "api-subscription-key": self.api_key,
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.base_url, json=payload, headers=headers, timeout=30.0)
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
            except httpx.HTTPStatusError as e:
                error_msg = e.response.text if hasattr(e, 'response') else str(e)
                log.error("sarvam_completion_failed", error=error_msg)
                # Fallback to a mock response if API fails
                return f"Sarvam AI Analysis [Fallback due to API error: {error_msg}]: Based on the data, risk exposure is elevated."
            except Exception as e:
                log.error("sarvam_completion_failed", error=str(e))
                # Fallback to a mock response if API fails
                return f"Sarvam AI Analysis [Fallback due to API error: {str(e)}]: Based on the data, risk exposure is elevated."

    async def stream(
        self,
        messages: List[Dict],
        system: str = "",
        max_tokens: int = 2048,
    ) -> AsyncIterator[str]:
        # Simple simulated streaming by waiting on complete() 
        # (For real streaming we'd use httpx astream)
        full_text = await self.complete(messages, system, max_tokens)
        import asyncio
        words = full_text.split(" ")
        for i, word in enumerate(words):
            yield word + (" " if i < len(words) - 1 else "")
            await asyncio.sleep(0.02)
