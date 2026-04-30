"""Question generation and answer evaluation endpoints."""
import json
import uuid
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.models.domain import QuestionsGenerateRequest, AnswerSubmitRequest
from app.services.tree_service import get_tree_service
from app.services.question_service import get_question_service

router = APIRouter()


@router.post("/questions/generate")
async def generate_questions(body: QuestionsGenerateRequest):
    """Generate questions for a knowledge node. (SSE streaming)"""
    tree_svc = get_tree_service()
    tree = tree_svc.get_tree(body.tree_id)
    if not tree:
        raise HTTPException(status_code=404, detail="Tree not found")

    # Find the node
    node = _find_node(tree.nodes, body.node_id) if body.node_id else tree.nodes
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    from app.models.domain import QuestionConfig

    q_svc = get_question_service()

    # Build config from request body
    config = QuestionConfig(
        types=body.types,
        count=body.count,
        difficulty=body.difficulty,
        extra_requirements=body.extra_requirements,
    )

    # First, generate all questions (non-streaming) and save to tree
    questions = await q_svc.generate_questions(
        node.title, node.description, config, node_id=body.node_id or ""
    )
    # Store questions in tree (reassign to trigger Pydantic setter)
    tree.questions = list(tree.questions) + questions

    # Then stream them back to the client
    async def event_stream():
        for q in tree.questions:
            yield f'event: question_added\ndata: {q.model_dump_json()}\n\n'
        yield 'event: done\ndata: {}\n\n'
        # Emit LLM metadata from the generation call
        meta = q_svc.last_metadata
        if meta:
            yield f'event: metadata\ndata: {json.dumps(meta)}\n\n'

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/questions/{question_id}/submit")
async def submit_answer(question_id: str, body: AnswerSubmitRequest):
    """Submit an answer and get evaluation. (SSE streaming)"""
    # Find the question in any tree
    tree_svc = get_tree_service()
    question = None
    for tree_summary in tree_svc.list_trees():
        tree = tree_svc.get_tree(tree_summary["tree_id"])
        if tree:
            for q in tree.questions:
                if q.id == question_id:
                    question = q
                    break
        if question:
            break

    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    q_svc = get_question_service()

    # Update question with user answer
    question.user_answer = body.user_answer

    async def event_stream():
        async for event in q_svc.evaluate_answer_stream(question, body.user_answer):
            yield event

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.put("/questions/{question_id}")
async def update_question(question_id: str, body: dict):
    """Update question metadata (e.g., user_answer, is_correct)."""
    tree_svc = get_tree_service()
    for tree_summary in tree_svc.list_trees():
        tree = tree_svc.get_tree(tree_summary["tree_id"])
        if tree:
            for q in tree.questions:
                if q.id == question_id:
                    if "user_answer" in body:
                        q.user_answer = body["user_answer"]
                    if "is_correct" in body:
                        q.is_correct = body["is_correct"]
                    if "ai_score" in body:
                        q.ai_score = body["ai_score"]
                    if "explanation" in body:
                        q.explanation = body["explanation"]
                    if "suggestion" in body:
                        q.suggestion = body["suggestion"]
                    return {"status": "updated"}
    raise HTTPException(status_code=404, detail="Question not found")


def _find_node(node, node_id: str):
    """Find a node by ID recursively."""
    if node.id == node_id:
        return node
    for child in node.children:
        result = _find_node(child, node_id)
        if result:
            return result
    return None
