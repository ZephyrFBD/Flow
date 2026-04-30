"""LLM configuration endpoints."""
from fastapi import APIRouter, HTTPException
from app.models.domain import LLMConfigUpdate, ActiveProviderUpdate
from app.services.llm_service import LLMService

router = APIRouter()


@router.get("/config/llm-providers")
async def get_providers():
    """Get available LLM providers and their status."""
    llm = LLMService.get_instance()
    return await llm.get_providers_status()


@router.get("/config")
async def get_config():
    """Get full configuration."""
    llm = LLMService.get_instance()
    return llm.get_config()


@router.put("/config/active-provider")
async def set_active_provider(body: ActiveProviderUpdate):
    """Switch the active LLM provider."""
    llm = LLMService.get_instance()
    try:
        llm.set_active_provider(body.provider)
        return {"status": "ok", "active_provider": body.provider}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/config/provider")
async def update_provider(body: LLMConfigUpdate):
    """Update a provider's configuration."""
    llm = LLMService.get_instance()
    try:
        llm.update_provider_config(
            body.provider,
            api_key=body.api_key,
            base_url=body.base_url,
            model=body.model,
        )
        return {"status": "ok", "provider": body.provider}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
