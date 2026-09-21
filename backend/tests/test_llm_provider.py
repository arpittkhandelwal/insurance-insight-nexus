import pytest
from typing import Dict, List, AsyncIterator
from app.services.llm_provider import FallbackLLMProvider, LLMProvider

class FailProvider(LLMProvider):
    async def complete(self, messages: List[Dict], system: str = "", max_tokens: int = 2048, temperature: float = 0.1) -> str:
        raise Exception("Provider failed")
        
    async def stream(self, messages: List[Dict], system: str = "", max_tokens: int = 2048) -> AsyncIterator[str]:
        raise Exception("Provider failed")
        yield ""

class SuccessProvider(LLMProvider):
    async def complete(self, messages: List[Dict], system: str = "", max_tokens: int = 2048, temperature: float = 0.1) -> str:
        return "Success"
        
    async def stream(self, messages: List[Dict], system: str = "", max_tokens: int = 2048) -> AsyncIterator[str]:
        yield "Suc"
        yield "cess"

@pytest.mark.asyncio
async def test_fallback_complete_success():
    provider = FallbackLLMProvider([FailProvider(), SuccessProvider()])
    result = await provider.complete([{"role": "user", "content": "hi"}])
    assert result == "Success"

@pytest.mark.asyncio
async def test_fallback_complete_all_fail():
    provider = FallbackLLMProvider([FailProvider(), FailProvider()])
    with pytest.raises(Exception, match="Provider failed"):
        await provider.complete([{"role": "user", "content": "hi"}])

@pytest.mark.asyncio
async def test_fallback_stream_success():
    provider = FallbackLLMProvider([FailProvider(), SuccessProvider()])
    chunks = []
    async for chunk in provider.stream([{"role": "user", "content": "hi"}]):
        chunks.append(chunk)
    assert "".join(chunks) == "Success"
