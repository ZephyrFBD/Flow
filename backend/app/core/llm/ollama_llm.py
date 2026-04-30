"""Ollama LLM implementation (local models via HTTP API)."""
import json
from typing import AsyncIterator
import httpx
from app.core.llm.base import BaseLLM


class OllamaLLM(BaseLLM):
    def __init__(self, base_url: str = "", model: str = "qwen2.5"):
        super().__init__()
        self._base_url = base_url.rstrip("/") or "http://localhost:11434"
        self._model = model
        self._client: httpx.AsyncClient | None = None

    @property
    def name(self) -> str:
        return "ollama"

    async def _ensure_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=120.0)
        return self._client

    def _build_payload(self, prompt: str, system_prompt: str | None = None, stream: bool = False) -> dict:
        payload = {
            "model": self._model,
            "prompt": prompt,
            "stream": stream,
            "options": {"temperature": 0.3},
        }
        if system_prompt:
            payload["system"] = system_prompt
        return payload

    async def generate(self, prompt: str, system_prompt: str | None = None) -> str:
        client = await self._ensure_client()
        payload = self._build_payload(prompt, system_prompt, stream=False)
        response = await client.post(f"{self._base_url}/api/generate", json=payload)
        response.raise_for_status()
        data = response.json()
        self.last_usage = {
            "input_tokens": data.get("prompt_eval_count", 0) or 0,
            "output_tokens": data.get("eval_count", 0) or 0,
            "thinking_tokens": 0,
        }
        self.last_stop_reason = "stop"
        return data.get("response", "")

    async def generate_stream(self, prompt: str, system_prompt: str | None = None) -> AsyncIterator[str]:
        client = await self._ensure_client()
        payload = self._build_payload(prompt, system_prompt, stream=True)
        full_content = ""
        async with client.stream("POST", f"{self._base_url}/api/generate", json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line.strip():
                    try:
                        data = json.loads(line)
                        chunk = data.get("response", "")
                        if chunk:
                            full_content += chunk
                            yield chunk
                        if data.get("done", False):
                            self.last_usage = {
                                "input_tokens": data.get("prompt_eval_count", 0) or 0,
                                "output_tokens": data.get("eval_count", 0) or 0,
                                "thinking_tokens": 0,
                            }
                            self.last_stop_reason = "stop"
                            break
                    except json.JSONDecodeError:
                        continue
