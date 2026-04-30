"""Configuration management for LLM providers and app settings."""
from pydantic import BaseModel


class LLMProviderConfig(BaseModel):
    """Configuration for a single LLM provider."""
    api_key: str = ""
    base_url: str = ""
    model: str = ""
    enabled: bool = True


class AppConfig(BaseModel):
    """Application configuration."""
    active_provider: str = "openai"  # openai | claude | ollama

    openai: LLMProviderConfig = LLMProviderConfig(
        base_url="https://api.openai.com/v1",
        model="gpt-4o",
    )
    claude: LLMProviderConfig = LLMProviderConfig(
        base_url="https://api.anthropic.com/v1",
        model="claude-sonnet-4-20250514",
    )
    ollama: LLMProviderConfig = LLMProviderConfig(
        base_url="http://localhost:11434",
        model="qwen2.5",
    )

    class Config:
        arbitrary_types_allowed = True
