"""Claude (Anthropic) LLM implementation."""
import time
from typing import AsyncIterator
from anthropic import AsyncAnthropic
from httpx import AsyncClient, Timeout
from app.core.llm.base import BaseLLM


class ClaudeLLM(BaseLLM):
    def __init__(self, api_key: str = "", base_url: str = "", model: str = "claude-sonnet-4-20250514"):
        super().__init__()
        self._api_key = api_key
        self._base_url = base_url or "https://api.anthropic.com/v1"
        self._model = model
        self._client: AsyncAnthropic | None = None

    @property
    def configured(self) -> bool:
        return bool(self._api_key)

    @property
    def name(self) -> str:
        return "claude"

    async def _ensure_client(self) -> AsyncAnthropic:
        if self._client is None:
            http_client = AsyncClient(timeout=Timeout(300.0, connect=30.0))
            self._client = AsyncAnthropic(
                api_key=self._api_key,
                base_url=self._base_url,
                http_client=http_client,
            )
        return self._client

    async def generate(self, prompt: str, system_prompt: str | None = None) -> str:
        client = await self._ensure_client()
        kwargs = {
            "model": self._model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.3,
            "max_tokens": 8192,
        }
        if system_prompt:
            kwargs["system"] = system_prompt

        response = await client.messages.create(**kwargs)
        self.last_stop_reason = response.stop_reason
        if response.usage:
            self.last_usage = {
                "input_tokens": response.usage.input_tokens or 0,
                "output_tokens": response.usage.output_tokens or 0,
                "thinking_tokens": getattr(response.usage, "thinking_tokens", 0) or 0,
            }
        return "".join(block.text for block in response.content if block.type == "text")

    async def generate_stream(self, prompt: str, system_prompt: str | None = None) -> AsyncIterator[str]:
        client = await self._ensure_client()
        kwargs = {
            "model": self._model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.3,
            "max_tokens": 8192,
        }
        if system_prompt:
            kwargs["system"] = system_prompt

        text_yielded = False
        async with client.messages.stream(**kwargs) as stream:
            async for text in stream.text_stream:
                text_yielded = True
                yield text

        # Always get final message for metadata (usage, stop_reason)
        msg = await stream.get_final_message()
        self.last_stop_reason = msg.stop_reason
        if msg.usage:
            self.last_usage = {
                "input_tokens": msg.usage.input_tokens or 0,
                "output_tokens": msg.usage.output_tokens or 0,
                "thinking_tokens": getattr(msg.usage, "thinking_tokens", 0) or 0,
            }

        # Fallback: if text_stream yielded nothing (e.g. all thinking blocks),
        # extract text from content blocks
        if not text_yielded:
            for block in msg.content:
                if block.type == "text":
                    yield block.text
