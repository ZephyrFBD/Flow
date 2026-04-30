"""LLM service — provider registry, routing, and configuration management."""
import os
from pathlib import Path
from typing import Optional
from dotenv import set_key
from app.config import AppConfig, LLMProviderConfig
from app.core.llm.base import BaseLLM
from app.core.llm.openai_llm import OpenAILLM
from app.core.llm.claude_llm import ClaudeLLM
from app.core.llm.ollama_llm import OllamaLLM

_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"


class LLMService:
    """Manages LLM providers and configuration at runtime."""
    _instance: Optional["LLMService"] = None

    def __init__(self):
        self._providers: dict[str, BaseLLM] = {}
        self._config = AppConfig()
        self._initialized = False

    @classmethod
    def get_instance(cls) -> "LLMService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def initialize(self):
        """Load config from env and create provider instances."""
        self._load_env()
        self._create_providers()
        self._initialized = True

    def _load_env(self):
        self._config.openai.api_key = os.getenv("OPENAI_API_KEY", "")
        self._config.openai.base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
        self._config.openai.model = os.getenv("OPENAI_MODEL", "gpt-4o")

        self._config.claude.api_key = os.getenv("ANTHROPIC_API_KEY", "")
        self._config.claude.base_url = os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com/v1")
        self._config.claude.model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")

        self._config.ollama.base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self._config.ollama.model = os.getenv("OLLAMA_MODEL", "qwen2.5")

        self._config.active_provider = os.getenv("DEFAULT_LLM_PROVIDER", "openai")

    def _create_providers(self):
        self._providers["openai"] = OpenAILLM(
            api_key=self._config.openai.api_key,
            base_url=self._config.openai.base_url,
            model=self._config.openai.model,
        )
        self._providers["claude"] = ClaudeLLM(
            api_key=self._config.claude.api_key,
            base_url=self._config.claude.base_url,
            model=self._config.claude.model,
        )
        self._providers["ollama"] = OllamaLLM(
            base_url=self._config.ollama.base_url,
            model=self._config.ollama.model,
        )

    def get_active_provider(self) -> BaseLLM:
        """Get the currently active LLM provider."""
        provider = self._providers.get(self._config.active_provider)
        if not provider:
            raise ValueError(f"Provider '{self._config.active_provider}' not available. Choose from: {list(self._providers.keys())}")
        return provider

    def get_provider(self, name: str) -> BaseLLM:
        """Get a specific provider by name."""
        provider = self._providers.get(name)
        if not provider:
            raise ValueError(f"Provider '{name}' not available.")
        return provider

    def set_active_provider(self, name: str):
        """Switch the active provider at runtime."""
        if name not in self._providers:
            raise ValueError(f"Provider '{name}' not available.")
        self._config.active_provider = name

    def update_provider_config(self, provider: str, **kwargs):
        """Update a provider's configuration and rebuild it."""
        if provider not in self._providers:
            raise ValueError(f"Provider '{provider}' not available.")

        cfg: LLMProviderConfig = getattr(self._config, provider)
        for key, value in kwargs.items():
            if value is not None and hasattr(cfg, key):
                setattr(cfg, key, value)

        # Rebuild provider
        if provider == "openai":
            self._providers[provider] = OpenAILLM(
                api_key=cfg.api_key, base_url=cfg.base_url, model=cfg.model
            )
            _set_env("OPENAI_API_KEY", cfg.api_key)
            _set_env("OPENAI_BASE_URL", cfg.base_url)
            _set_env("OPENAI_MODEL", cfg.model)
        elif provider == "claude":
            self._providers[provider] = ClaudeLLM(
                api_key=cfg.api_key, base_url=cfg.base_url, model=cfg.model
            )
            _set_env("ANTHROPIC_API_KEY", cfg.api_key)
            _set_env("ANTHROPIC_BASE_URL", cfg.base_url)
            _set_env("ANTHROPIC_MODEL", cfg.model)
        elif provider == "ollama":
            self._providers[provider] = OllamaLLM(
                base_url=cfg.base_url, model=cfg.model
            )
            _set_env("OLLAMA_BASE_URL", cfg.base_url)
            _set_env("OLLAMA_MODEL", cfg.model)

    async def get_providers_status(self) -> dict:
        """Get status of all providers."""
        status = {}
        for name, provider in self._providers.items():
            cfg = getattr(self._config, name)
            status[name] = {
                "model": cfg.model,
                "configured": bool(cfg.api_key or name == "ollama"),
                "active": name == self._config.active_provider,
            }
        return status

    def update_active_provider(self, name: str):
        """Persist active provider switch to .env."""
        self.set_active_provider(name)
        _set_env("DEFAULT_LLM_PROVIDER", name)

    def get_config(self) -> dict:
        """Get current full configuration (without API keys)."""
        return {
            "active_provider": self._config.active_provider,
            "providers": {
                "openai": {
                    "base_url": self._config.openai.base_url,
                    "model": self._config.openai.model,
                    "configured": bool(self._config.openai.api_key),
                },
                "claude": {
                    "base_url": self._config.claude.base_url,
                    "model": self._config.claude.model,
                    "configured": bool(self._config.claude.api_key),
                },
                "ollama": {
                    "base_url": self._config.ollama.base_url,
                    "model": self._config.ollama.model,
                    "configured": True,
                },
            },
        }

def _set_env(key: str, value: str):
    """Persist a config value to the .env file."""
    try:
        set_key(str(_ENV_FILE), key, value)
    except Exception:
        pass  # best-effort
