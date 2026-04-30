"""Project save/load endpoints (.knowtree file format)."""
import json
import os
from urllib.parse import quote
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import Response
from app.models.domain import KnowledgeTreeFile
from app.services.tree_service import get_tree_service

router = APIRouter()


@router.get("/project/save")
async def save_project(tree_id: str):
    """Save a project as .knowtree JSON download."""
    service = get_tree_service()
    tree = service.get_tree(tree_id)
    if not tree:
        raise HTTPException(status_code=404, detail="Tree not found")

    content = tree.model_dump_json(indent=2)
    filename = f"{tree.title.replace(' ', '_')}.knowtree"
    return Response(
        content=content,
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename, safe='')}",
        },
    )


@router.post("/project/load")
async def load_project(file: UploadFile = File(...)):
    """Load a project from .knowtree file upload."""
    service = get_tree_service()
    try:
        content = await file.read()
        data = json.loads(content)
        tree = KnowledgeTreeFile(**data)
        service.save_tree(tree)
        return tree
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to load project: {e}")


@router.get("/project/list")
async def list_projects():
    """List recent projects."""
    service = get_tree_service()
    return service.list_trees()
