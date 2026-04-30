"""Pydantic domain models for the knowledge tree system."""
from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class KnowledgeNode(BaseModel):
    """A single node in the knowledge tree."""
    id: str = ""
    title: str = ""
    description: str = ""
    keywords: list[str] = Field(default_factory=list)
    completed: bool = False
    children: list[KnowledgeNode] = Field(default_factory=list)


class PromptRecord(BaseModel):
    """Record of a single prompt used to generate or refine a tree."""
    timestamp: str = ""
    prompt_text: Optional[str] = None
    pdf_filename: Optional[str] = None
    mode: str = "generate"  # "generate" | "refine"


class ExampleQuestion(BaseModel):
    """A question associated with a knowledge node."""
    id: str = ""
    node_id: str = ""
    type: str = "choice"  # "choice" | "essay"
    question: str = ""
    options: Optional[list[str]] = None
    answer: str = ""
    explanation: str = ""
    difficulty: str = "medium"  # "easy" | "medium" | "hard"
    user_answer: Optional[str] = None
    is_correct: Optional[bool] = None
    ai_score: Optional[float] = None
    suggestion: str = ""


class QuestionConfig(BaseModel):
    """Configuration for generating questions."""
    types: list[str] = Field(default_factory=lambda: ["choice", "essay"])
    count: int = 5
    difficulty: str = "medium"
    extra_requirements: Optional[str] = None


class KnowledgeTreeFile(BaseModel):
    """Complete knowledge tree data saved as .knowtree JSON."""
    format_version: str = "1.0"
    tree_id: str = ""
    title: str = ""
    version: int = 1
    parent_id: Optional[str] = None
    children_ids: list[str] = Field(default_factory=list)
    prompt_history: list[PromptRecord] = Field(default_factory=list)
    nodes: KnowledgeNode = Field(default_factory=KnowledgeNode)
    questions: list[ExampleQuestion] = Field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""


# --- Request/Response Models ---

class GenerateRequest(BaseModel):
    prompt: Optional[str] = None
    llm_provider: Optional[str] = None


class RefineRequest(BaseModel):
    prompt: Optional[str] = None
    mode: str = "inplace"  # "inplace" | "derive"


class QuestionsGenerateRequest(BaseModel):
    tree_id: str
    node_id: Optional[str] = None
    types: list[str] = Field(default_factory=lambda: ["choice", "essay"])
    count: int = 5
    difficulty: str = "medium"
    extra_requirements: Optional[str] = None


class AnswerSubmitRequest(BaseModel):
    user_answer: str


class NodeUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    keywords: Optional[list[str]] = None
    completed: Optional[bool] = None


class LLMConfigUpdate(BaseModel):
    provider: str  # openai | claude | ollama
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: Optional[str] = None
    enabled: Optional[bool] = None


class ActiveProviderUpdate(BaseModel):
    provider: str  # openai | claude | ollama
