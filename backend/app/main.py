"""FastAPI entry point."""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.routers import knowledge, questions, project, config as config_router
from app.services.llm_service import LLMService

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: init LLM service
    llm_service = LLMService.get_instance()
    await llm_service.initialize()
    yield
    # Shutdown


app = FastAPI(
    title="Flow API",
    description="AI Knowledge Tree Generator",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(knowledge.router, prefix="/api/v1")
app.include_router(questions.router, prefix="/api/v1")
app.include_router(project.router, prefix="/api/v1")
app.include_router(config_router.router, prefix="/api/v1")


@app.get("/api/v1/health")
async def health():
    llm_service = LLMService.get_instance()
    providers = await llm_service.get_providers_status()
    return {"status": "ok", "providers": providers}
