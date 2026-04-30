"""Knowledge tree CRUD and generation endpoints."""
import json
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
from app.models.domain import NodeUpdateRequest
from app.services.tree_service import get_tree_service
from app.services.pdf_service import get_pdf_service

router = APIRouter()


@router.post("/knowledge-tree/generate")
async def generate_tree(
    prompt: str = Form(""),
    pdf_file: UploadFile = File(None),
    llm_provider: str = Form(None),
):
    """Generate a new knowledge tree from prompt + optional PDF. (SSE streaming)"""
    service = get_tree_service()
    pdf_text = ""
    if pdf_file:
        pdf_svc = get_pdf_service()
        file_data = await pdf_file.read()
        upload_id = await pdf_svc.save_upload(file_data, pdf_file.filename or "upload.pdf")
        file_path = pdf_svc.get_file_path(upload_id)
        if file_path:
            pdf_text = pdf_svc.extract_text(file_path)

    async def event_stream():
        async for event in service.generate_tree_stream(prompt, pdf_text, llm_provider):
            yield event

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/knowledge-tree/{tree_id}")
async def get_tree(tree_id: str):
    """Get a knowledge tree by ID."""
    service = get_tree_service()
    tree = service.get_tree(tree_id)
    if not tree:
        raise HTTPException(status_code=404, detail="Tree not found")
    return tree


@router.put("/knowledge-tree/{tree_id}/refine")
async def refine_tree(
    tree_id: str,
    prompt: str = Form(""),
    pdf_file: UploadFile = File(None),
    mode: str = Form("inplace"),
    llm_provider: str = Form(None),
    stream: str = Form("true"),
):
    """Refine an existing knowledge tree. Defaults to SSE streaming."""
    service = get_tree_service()
    pdf_text = ""
    if pdf_file:
        pdf_svc = get_pdf_service()
        file_data = await pdf_file.read()
        upload_id = await pdf_svc.save_upload(file_data, pdf_file.filename or "upload.pdf")
        file_path = pdf_svc.get_file_path(upload_id)
        if file_path:
            pdf_text = pdf_svc.extract_text(file_path)

    if stream == "true":
        async def event_stream():
            async for event in service.refine_tree_stream(tree_id, prompt, pdf_text, mode, llm_provider):
                yield event
        return StreamingResponse(event_stream(), media_type="text/event-stream")
    else:
        tree = await service.refine_tree(tree_id, prompt, pdf_text, mode, llm_provider)
        return tree


@router.put("/knowledge-tree/{tree_id}/node/{node_id}")
async def update_node(tree_id: str, node_id: str, body: NodeUpdateRequest):
    """Update a single node's fields."""
    service = get_tree_service()
    tree = service.get_tree(tree_id)
    if not tree:
        raise HTTPException(status_code=404, detail="Tree not found")

    updated = _update_node_recursive(tree.nodes, node_id, body)
    if not updated:
        raise HTTPException(status_code=404, detail="Node not found")

    tree.updated_at = __import__("datetime").datetime.now().isoformat()
    return tree


def _update_node_recursive(node: "KnowledgeNode", node_id: str, body: NodeUpdateRequest) -> bool:
    if node.id == node_id:
        if body.title is not None:
            node.title = body.title
        if body.description is not None:
            node.description = body.description
        if body.keywords is not None:
            node.keywords = body.keywords
        if body.completed is not None:
            node.completed = body.completed
        return True
    for child in node.children:
        if _update_node_recursive(child, node_id, body):
            return True
    return False


@router.post("/knowledge-tree/{tree_id}/node")
async def add_node(tree_id: str, title: str = Form(...), parent_id: str = Form("")):
    """Add a child node to the tree."""
    service = get_tree_service()
    tree = service.get_tree(tree_id)
    if not tree:
        raise HTTPException(status_code=404, detail="Tree not found")

    import uuid
    new_node = {"id": str(uuid.uuid4())[:8], "title": title, "description": "", "keywords": [], "completed": False, "children": []}

    if parent_id:
        added = _add_child_recursive(tree.nodes, parent_id, new_node)
        if not added:
            raise HTTPException(status_code=404, detail="Parent node not found")
    else:
        tree.nodes.children.append(type(tree.nodes).model_validate(new_node))

    tree.updated_at = __import__("datetime").datetime.now().isoformat()
    return tree


def _add_child_recursive(node: "KnowledgeNode", parent_id: str, child_data: dict) -> bool:
    if node.id == parent_id:
        node.children.append(type(node).model_validate(child_data))
        return True
    for child in node.children:
        if _add_child_recursive(child, parent_id, child_data):
            return True
    return False


@router.delete("/knowledge-tree/{tree_id}/node/{node_id}")
async def delete_node(tree_id: str, node_id: str):
    """Delete a node from the tree."""
    service = get_tree_service()
    tree = service.get_tree(tree_id)
    if not tree:
        raise HTTPException(status_code=404, detail="Tree not found")

    removed = _remove_child_recursive(tree.nodes, node_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Node not found")

    tree.updated_at = __import__("datetime").datetime.now().isoformat()
    return tree


def _remove_child_recursive(node: "KnowledgeNode", node_id: str) -> bool:
    for i, child in enumerate(node.children):
        if child.id == node_id:
            node.children.pop(i)
            return True
        if _remove_child_recursive(child, node_id):
            return True
    return False


@router.get("/knowledge-trees")
async def list_trees():
    """List all saved knowledge trees."""
    service = get_tree_service()
    return service.list_trees()


@router.delete("/knowledge-tree/{tree_id}")
async def delete_tree(tree_id: str):
    """Delete a knowledge tree."""
    service = get_tree_service()
    service.delete_tree(tree_id)
    return {"status": "deleted"}
