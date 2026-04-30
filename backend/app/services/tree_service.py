"""Knowledge tree generation and management."""
import asyncio
import json
import time
import uuid
from datetime import datetime
from typing import AsyncIterator, Optional
from app.models.domain import KnowledgeNode, KnowledgeTreeFile, PromptRecord
from app.services.llm_service import LLMService


TREE_GENERATE_SYSTEM_PROMPT = """You are a knowledge tree generator. Given the user's input, create a structured knowledge tree.

Output ONLY valid JSON in the following format (no markdown, no code fences):
{
  "title": "Overall topic title",
  "description": "Brief overview of the topic",
  "keywords": ["keyword1", "keyword2"],
  "children": [
    {
      "title": "Subtopic 1",
      "description": "Brief description",
      "keywords": ["kw1", "kw2"],
      "children": [
        {
          "title": "Detail 1.1",
          "description": "Description",
          "keywords": [],
          "children": []
        }
      ]
    }
  ]
}

Rules:
- Maximum depth: 4 levels
- Each node must have title and description
- Be comprehensive but concise
- Output ONLY valid JSON"""

TREE_REFINE_SYSTEM_PROMPT = """You are a knowledge tree editor. Given an existing tree and new input, update the tree.

Output ONLY valid JSON in the same format as the original tree. You may:
- Add new nodes
- Update existing descriptions
- Reorganize branches
- Keep the same root title unless the new input clearly changes the topic

Output ONLY valid JSON, no markdown."""


class TreeService:
    """In-memory knowledge tree storage and generation."""

    def __init__(self):
        self._trees: dict[str, KnowledgeTreeFile] = {}

    def get_tree(self, tree_id: str) -> Optional[KnowledgeTreeFile]:
        return self._trees.get(tree_id)

    def save_tree(self, tree: KnowledgeTreeFile):
        self._trees[tree.tree_id] = tree

    def delete_tree(self, tree_id: str):
        self._trees.pop(tree_id, None)

    def list_trees(self) -> list[dict]:
        return [
            {
                "tree_id": t.tree_id,
                "title": t.title,
                "version": t.version,
                "updated_at": t.updated_at,
                "node_count": self._count_nodes(t.nodes),
                "completed_count": self._count_completed(t.nodes),
                "parent_id": t.parent_id,
                "children_ids": t.children_ids,
            }
            for t in sorted(self._trees.values(), key=lambda x: x.updated_at, reverse=True)
        ]

    def get_version_tree_ids(self, tree_id: str) -> list[str]:
        """Collect all version IDs in the same family."""
        tree = self._trees.get(tree_id)
        if not tree:
            return [tree_id]
        # Find root
        root = tree
        while root.parent_id and root.parent_id in self._trees:
            root = self._trees[root.parent_id]
        # Collect all descendants
        ids = []
        stack = [root.tree_id]
        while stack:
            tid = stack.pop()
            ids.append(tid)
            t = self._trees.get(tid)
            if t:
                stack.extend(t.children_ids)
        return ids

    @staticmethod
    def _count_nodes(node: KnowledgeNode) -> int:
        return 1 + sum(TreeService._count_nodes(c) for c in node.children)

    @staticmethod
    def _count_completed(node: KnowledgeNode) -> int:
        return (1 if node.completed else 0) + sum(TreeService._count_completed(c) for c in node.children)

    def _build_full_prompt(self, prompt: str, pdf_text: str = "") -> str:
        parts = []
        if prompt:
            parts.append(prompt)
        if pdf_text:
            parts.append(f"--- PDF Content ---\n{pdf_text[:5000]}")
        return "\n\n".join(parts) if parts else "Please create a knowledge tree about a general topic."

    async def generate_tree(self, prompt: str, pdf_text: str = "",
                            provider: str | None = None) -> KnowledgeTreeFile:
        """Generate a new knowledge tree (non-streaming)."""
        llm = LLMService.get_instance()
        try:
            active = llm.get_provider(provider) if provider else llm.get_active_provider()
        except ValueError as e:
            raise ValueError(str(e))
        if not active.configured:
            raise ValueError(f"{active.name} 未配置 API Key，请在设置中配置")
        full_prompt = self._build_full_prompt(prompt, pdf_text)

        try:
            response = await active.generate(full_prompt, TREE_GENERATE_SYSTEM_PROMPT)
        except Exception as e:
            raise ValueError(f"LLM 调用失败: {str(e)}")
        root = self._parse_tree_response(response)

        tree = KnowledgeTreeFile(
            format_version="1.0",
            tree_id=str(uuid.uuid4()),
            title=root.title,
            version=1,
            nodes=root,
            prompt_history=[
                PromptRecord(
                    timestamp=datetime.now().isoformat(),
                    prompt_text=prompt or "",
                    pdf_filename="uploaded.pdf" if pdf_text else None,
                    mode="generate",
                )
            ],
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat(),
        )
        self._trees[tree.tree_id] = tree
        return tree

    @staticmethod
    def _collect_breadth_first(node: KnowledgeNode) -> list[tuple[KnowledgeNode, str | None]]:
        """Collect nodes in breadth-first order with their parent_id.
        Returns list of (node, parent_id_or_None).
        """
        result: list[tuple[KnowledgeNode, str | None]] = []
        queue: list[tuple[KnowledgeNode, str | None]] = [(node, None)]
        while queue:
            current, parent_id = queue.pop(0)
            result.append((current, parent_id))
            for child in current.children:
                queue.append((child, current.id))
        return result

    async def _emit_metadata(self, active, elapsed: float):
        """Yield metadata SSE event if usage data is available."""
        if active.last_usage:
            meta = {
                "duration_sec": round(elapsed, 1),
                "input_tokens": active.last_usage.get("input_tokens", 0),
                "output_tokens": active.last_usage.get("output_tokens", 0),
                "thinking_tokens": active.last_usage.get("thinking_tokens", 0),
                "stop_reason": active.last_stop_reason or "",
            }
            yield f'event: metadata\ndata: {json.dumps(meta)}\n\n'

    async def generate_tree_stream(self, prompt: str, pdf_text: str = "",
                                    provider: str | None = None) -> AsyncIterator[str]:
        """Stream tree generation as SSE events."""
        llm = LLMService.get_instance()
        try:
            active = llm.get_provider(provider) if provider else llm.get_active_provider()
        except ValueError as e:
            yield f'event: error\ndata: {json.dumps({"message": str(e)})}\n\n'
            return
        if not active.configured:
            yield f'event: error\ndata: {json.dumps({"message": f"{active.name} 未配置 API Key，请在设置中配置"})}\n\n'
            return
        full_prompt = self._build_full_prompt(prompt, pdf_text)

        yield 'event: progress\ndata: {"phase": "generating", "percent": 10}\n\n'

        llm_start = time.time()
        buffer = ""
        last_token_emit = 0
        try:
            async for chunk in active.generate_stream(full_prompt, TREE_GENERATE_SYSTEM_PROMPT):
                buffer += chunk
                now = time.time()
                if now - last_token_emit >= 0.5:
                    last_token_emit = now
                    estimated = len(buffer) // 4
                    yield f'event: token_progress\ndata: {json.dumps({"chars": len(buffer), "estimated_tokens": estimated, "elapsed": round(now - llm_start, 1)})}\n\n'
        except Exception as e:
            yield f'event: error\ndata: {json.dumps({"message": f"LLM 调用失败: {str(e)}"})}\n\n'
            return
        llm_elapsed = time.time() - llm_start

        if not buffer.strip():
            yield f'event: error\ndata: {json.dumps({"message": "LLM 返回为空，请检查 API Key 和模型配置"})}\n\n'
            return

        yield 'event: progress\ndata: {"phase": "parsing", "percent": 60}\n\n'

        root = self._parse_tree_response(buffer)

        tree = KnowledgeTreeFile(
            format_version="1.0",
            tree_id=str(uuid.uuid4()),
            title=root.title,
            version=1,
            nodes=root,
            prompt_history=[
                PromptRecord(
                    timestamp=datetime.now().isoformat(),
                    prompt_text=prompt or "",
                    pdf_filename="uploaded.pdf" if pdf_text else None,
                    mode="generate",
                )
            ],
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat(),
        )
        self._trees[tree.tree_id] = tree

        all_nodes = self._collect_breadth_first(root)
        total = len(all_nodes)
        for i, (node, parent_id) in enumerate(all_nodes):
            percent = 60 + int(((i + 1) / total) * 38)
            yield (
                f'event: node_added\n'
                f'data: {json.dumps({"node": node.model_dump(), "parent_id": parent_id})}\n\n'
            )
            yield f'event: progress\ndata: {{"phase": "rendering", "percent": {percent}}}\n\n'
            await asyncio.sleep(0.03)

        yield f'event: tree_ready\ndata: {json.dumps({"tree_id": tree.tree_id})}\n\n'
        yield 'event: done\ndata: {}\n\n'
        # Emit metadata after done
        async for meta in self._emit_metadata(active, llm_elapsed):
            yield meta

    async def refine_tree(self, tree_id: str, new_prompt: str, pdf_text: str = "",
                          mode: str = "inplace", provider: str | None = None) -> KnowledgeTreeFile:
        """Refine an existing tree with new input (non-streaming)."""
        existing = self._trees.get(tree_id)
        if not existing:
            raise ValueError(f"Tree {tree_id} not found")

        llm = LLMService.get_instance()
        try:
            active = llm.get_provider(provider) if provider else llm.get_active_provider()
        except ValueError as e:
            raise ValueError(str(e))
        if not active.configured:
            raise ValueError(f"{active.name} 未配置 API Key，请在设置中配置")

        combined = new_prompt
        if pdf_text:
            combined += f"\n\n--- PDF Content ---\n{pdf_text}" if combined else f"PDF Content:\n{pdf_text}"

        existing_json = existing.nodes.model_dump_json(indent=2)
        refine_prompt = f"Existing tree:\n{existing_json}\n\nNew input:\n{combined}"

        try:
            response = await active.generate(refine_prompt, TREE_REFINE_SYSTEM_PROMPT)
        except Exception as e:
            raise ValueError(f"LLM 调用失败: {str(e)}")
        root = self._parse_tree_response(response)

        if mode == "derive":
            tree = KnowledgeTreeFile(
                format_version="1.0",
                tree_id=str(uuid.uuid4()),
                title=root.title,
                version=existing.version + 1,
                parent_id=tree_id,
                nodes=root,
                prompt_history=existing.prompt_history + [
                    PromptRecord(
                        timestamp=datetime.now().isoformat(),
                        prompt_text=new_prompt or "",
                        pdf_filename="uploaded.pdf" if pdf_text else None,
                        mode="refine",
                    )
                ],
                created_at=datetime.now().isoformat(),
                updated_at=datetime.now().isoformat(),
            )
            existing.children_ids.append(tree.tree_id)
            self._trees[tree.tree_id] = tree
            return tree
        else:
            existing.nodes = root
            existing.version += 1
            existing.updated_at = datetime.now().isoformat()
            existing.prompt_history.append(
                PromptRecord(
                    timestamp=datetime.now().isoformat(),
                    prompt_text=new_prompt or "",
                    pdf_filename="uploaded.pdf" if pdf_text else None,
                    mode="refine",
                )
            )
            return existing

    async def refine_tree_stream(self, tree_id: str, new_prompt: str, pdf_text: str = "",
                                  mode: str = "inplace",
                                  provider: str | None = None) -> AsyncIterator[str]:
        """Refine an existing tree with SSE streaming (per-node events)."""
        existing = self._trees.get(tree_id)
        if not existing:
            yield f'event: error\ndata: {{"message": "Tree {tree_id} not found"}}\n\n'
            return

        llm = LLMService.get_instance()
        try:
            active = llm.get_provider(provider) if provider else llm.get_active_provider()
        except ValueError as e:
            yield f'event: error\ndata: {json.dumps({"message": str(e)})}\n\n'
            return
        if not active.configured:
            yield f'event: error\ndata: {json.dumps({"message": f"{active.name} 未配置 API Key，请在设置中配置"})}\n\n'
            return

        combined = new_prompt
        if pdf_text:
            combined += f"\n\n--- PDF Content ---\n{pdf_text}" if combined else f"PDF Content:\n{pdf_text}"

        existing_json = existing.nodes.model_dump_json(indent=2)
        refine_prompt = f"Existing tree:\n{existing_json}\n\nNew input:\n{combined}"

        yield 'event: progress\ndata: {"phase": "generating", "percent": 10}\n\n'

        llm_start = time.time()
        buffer = ""
        last_token_emit = 0
        try:
            async for chunk in active.generate_stream(refine_prompt, TREE_REFINE_SYSTEM_PROMPT):
                buffer += chunk
                now = time.time()
                if now - last_token_emit >= 0.5:
                    last_token_emit = now
                    estimated = len(buffer) // 4
                    yield f'event: token_progress\ndata: {json.dumps({"chars": len(buffer), "estimated_tokens": estimated, "elapsed": round(now - llm_start, 1)})}\n\n'
        except Exception as e:
            yield f'event: error\ndata: {json.dumps({"message": f"LLM 调用失败: {str(e)}"})}\n\n'
            return
        llm_elapsed = time.time() - llm_start

        if not buffer.strip():
            yield f'event: error\ndata: {json.dumps({"message": "LLM 返回为空，请检查 API Key 和模型配置"})}\n\n'
            return

        yield 'event: progress\ndata: {"phase": "parsing", "percent": 60}\n\n'

        root = self._parse_tree_response(buffer)

        if mode == "derive":
            tree = KnowledgeTreeFile(
                format_version="1.0",
                tree_id=str(uuid.uuid4()),
                title=root.title,
                version=existing.version + 1,
                parent_id=tree_id,
                nodes=root,
                prompt_history=existing.prompt_history + [
                    PromptRecord(
                        timestamp=datetime.now().isoformat(),
                        prompt_text=new_prompt or "",
                        pdf_filename="uploaded.pdf" if pdf_text else None,
                        mode="refine",
                    )
                ],
                created_at=datetime.now().isoformat(),
                updated_at=datetime.now().isoformat(),
            )
            existing.children_ids.append(tree.tree_id)
            self._trees[tree.tree_id] = tree
            result_tree = tree
        else:
            existing.nodes = root
            existing.version += 1
            existing.updated_at = datetime.now().isoformat()
            existing.prompt_history.append(
                PromptRecord(
                    timestamp=datetime.now().isoformat(),
                    prompt_text=new_prompt or "",
                    pdf_filename="uploaded.pdf" if pdf_text else None,
                    mode="refine",
                )
            )
            result_tree = existing

        # Emit nodes progressively
        all_nodes = self._collect_breadth_first(root)
        total = len(all_nodes)
        for i, (node, parent_id) in enumerate(all_nodes):
            percent = 60 + int(((i + 1) / total) * 38)
            yield (
                f'event: node_added\n'
                f'data: {json.dumps({"node": node.model_dump(), "parent_id": parent_id})}\n\n'
            )
            yield f'event: progress\ndata: {{"phase": "rendering", "percent": {percent}}}\n\n'
            await asyncio.sleep(0.03)

        yield f'event: tree_ready\ndata: {json.dumps({"tree_id": result_tree.tree_id})}\n\n'
        yield 'event: done\ndata: {}\n\n'
        async for meta in self._emit_metadata(active, llm_elapsed):
            yield meta

    @staticmethod
    def _parse_tree_response(response: str) -> KnowledgeNode:
        """Parse LLM JSON response into a KnowledgeNode."""
        cleaned = TreeService._clean_json(response)
        try:
            data = json.loads(cleaned)
            return TreeService._assign_ids(KnowledgeNode(**data))
        except (json.JSONDecodeError, Exception):
            return KnowledgeNode(title="Knowledge Tree", description=response[:1000])

    @staticmethod
    def _assign_ids(node: KnowledgeNode, prefix: str = "n") -> KnowledgeNode:
        if not node.id:
            node.id = str(uuid.uuid4())[:8]
        for i, child in enumerate(node.children):
            node.children[i] = TreeService._assign_ids(child, f"{prefix}-{i}")
        return node

    @staticmethod
    def _clean_json(text: str) -> str:
        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            text = "\n".join(lines)
        return text.strip()


# Singleton
_tree_service: TreeService | None = None


def get_tree_service() -> TreeService:
    global _tree_service
    if _tree_service is None:
        _tree_service = TreeService()
    return _tree_service
