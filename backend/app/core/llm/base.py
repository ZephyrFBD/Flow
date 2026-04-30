"""Abstract base class for LLM providers."""
from abc import ABC, abstractmethod
from typing import AsyncIterator


class BaseLLM(ABC):
    """Abstract interface for LLM providers."""

    def __init__(self):
        self.last_usage: dict | None = None
        self.last_stop_reason: str | None = None

    @abstractmethod
    async def generate(self, prompt: str, system_prompt: str | None = None) -> str:
        """Generate a complete response (non-streaming)."""
        ...

    @abstractmethod
    async def generate_stream(self, prompt: str, system_prompt: str | None = None) -> AsyncIterator[str]:
        """Generate a streaming response, yielding text chunks."""
        ...

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider name: openai, claude, ollama."""
        ...
