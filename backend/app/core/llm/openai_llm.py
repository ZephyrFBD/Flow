"""OpenAI LLM implementation."""
from typing import AsyncIterator
from openai import AsyncOpenAI
from app.core.llm.base import BaseLLM


class OpenAILLM(BaseLLM):
    def __init__(self, api_key: str = "", base_url: str = "", model: str = "gpt-4o"):
        super().__init__()
        self._api_key = api_key
        self._base_url = base_url or "https://api.openai.com/v1"
        self._model = model
        self._client: AsyncOpenAI | None = None

    @property
    def configured(self) -> bool:
        return bool(self._api_key)

    @property
    def name(self) -> str:
        return "openai"

    async def _ensure_client(self) -> AsyncOpenAI:
        if self._client is None:
            self._client = AsyncOpenAI(
                api_key=self._api_key,
                base_url=self._base_url,
            )
        return self._client

    async def generate(self, prompt: str, system_prompt: str | None = None) -> str:
        client = await self._ensure_client()
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = await client.chat.completions.create(
            model=self._model,
            messages=messages,
            temperature=0.3,
        )
        if response.usage:
            self.last_usage = {
                "input_tokens": response.usage.prompt_tokens or 0,
                "output_tokens": response.usage.completion_tokens or 0,
                "thinking_tokens": 0,
            }
        self.last_stop_reason = response.choices[0].finish_reason if response.choices else "stop"
        return response.choices[0].message.content or ""

    async def generate_stream(self, prompt: str, system_prompt: str | None = None) -> AsyncIterator[str]:
        client = await self._ensure_client()
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        stream = await client.chat.completions.create(
            model=self._model,
            messages=messages,
            temperature=0.3,
            stream=True,
            stream_options={"include_usage": True},
        )
        usage = None
        async for chunk in stream:
            if hasattr(chunk, "usage") and chunk.usage:
                usage = chunk.usage
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

        if usage:
            self.last_usage = {
                "input_tokens": usage.prompt_tokens or 0,
                "output_tokens": usage.completion_tokens or 0,
                "thinking_tokens": 0,
            }
        self.last_stop_reason = "stop"
