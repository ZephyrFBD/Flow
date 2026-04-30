"""Question generation and evaluation service."""
import asyncio
import json
import time
import uuid
from datetime import datetime
from typing import AsyncIterator
from app.models.domain import ExampleQuestion, QuestionConfig
from app.services.llm_service import LLMService


QUESTION_GENERATE_SYSTEM_PROMPT = """You are an educational question generator. Given a knowledge point, create questions.

Output ONLY valid JSON as an array of question objects:
[
  {
    "type": "choice",
    "question": "Question text",
    "options": ["A. option1", "B. option2", "C. option3", "D. option4"],
    "answer": "A. option1",
    "explanation": "Why this is correct",
    "difficulty": "medium"
  }
]

Rules:
- "type" can be "choice" or "essay"
- For "choice": provide 4 options, answer is the correct option text
- For "essay": no options needed, answer is a reference answer
- difficulty: "easy", "medium", or "hard"
- IMPORTANT: Use $...$ to wrap ALL mathematical notation (e.g., $A^{-1}$, $A^T$, $(A^{-1})^{-1}=A$)
- Output ONLY valid JSON array"""


ANSWER_EVALUATE_SYSTEM_PROMPT = """You are an educational evaluator. Evaluate the user's answer.

For each evaluation, output valid JSON:
{
  "is_correct": true/false,
  "explanation": "Detailed explanation of why the answer is right or wrong",
  "ai_score": 8.5,
  "suggestion": "Suggestions for improvement (for essay questions)"
}

Rules:
- For choice questions: is_correct is boolean, ai_score is optional
- For essay questions: ai_score is 0-10, provide constructive suggestions
- explanation should be detailed and educational
- IMPORTANT: Use $...$ to wrap ALL mathematical notation (e.g., $A^{-1}$, $A^T$, $(A^{-1})^{-1}=A$)
- Output ONLY valid JSON"""


class QuestionService:
    """Generate and evaluate questions."""

    async def generate_questions(self, node_title: str, node_description: str,
                                  config: QuestionConfig,
                                  node_id: str = "",
                                  provider: str | None = None) -> list[ExampleQuestion]:
        """Generate questions for a knowledge node."""
        llm = LLMService.get_instance()
        active = llm.get_provider(provider) if provider else llm.get_active_provider()

        type_str = " and ".join(config.types)
        prompt = (
            f"Knowledge point: {node_title}\n"
            f"Description: {node_description}\n"
            f"Generate {config.count} {config.difficulty} {type_str} questions.\n"
        )
        if config.extra_requirements:
            prompt += f"Extra requirements: {config.extra_requirements}\n"

        start = time.time()
        response = await active.generate(prompt, QUESTION_GENERATE_SYSTEM_PROMPT)
        elapsed = time.time() - start

        if active.last_usage:
            self._last_metadata = {
                "duration_sec": round(elapsed, 1),
                "input_tokens": active.last_usage.get("input_tokens", 0),
                "output_tokens": active.last_usage.get("output_tokens", 0),
                "thinking_tokens": active.last_usage.get("thinking_tokens", 0),
                "stop_reason": active.last_stop_reason or "",
            }
        return self._parse_questions(response, node_title, node_id)

    async def generate_questions_stream(self, node_title: str, node_description: str,
                                         config: QuestionConfig,
                                         node_id: str = "",
                                         provider: str | None = None) -> AsyncIterator[str]:
        """Stream-generated questions as SSE events."""
        llm = LLMService.get_instance()
        active = llm.get_provider(provider) if provider else llm.get_active_provider()

        type_str = " and ".join(config.types)
        prompt = (
            f"Knowledge point: {node_title}\n"
            f"Description: {node_description}\n"
            f"Generate {config.count} {config.difficulty} {type_str} questions.\n"
        )
        if config.extra_requirements:
            prompt += f"Extra requirements: {config.extra_requirements}\n"

        start = time.time()
        buffer = ""
        last_token_emit = 0
        async for chunk in active.generate_stream(prompt, QUESTION_GENERATE_SYSTEM_PROMPT):
            buffer += chunk
            now = time.time()
            if now - last_token_emit >= 0.5:
                last_token_emit = now
                estimated = len(buffer) // 4
                yield f'event: token_progress\ndata: {json.dumps({"chars": len(buffer), "estimated_tokens": estimated, "elapsed": round(now - start, 1)})}\n\n'
        elapsed = time.time() - start

        questions = self._parse_questions(buffer, node_title, node_id)
        for q in questions:
            yield f'event: question_added\ndata: {q.model_dump_json()}\n\n'
        yield 'event: done\ndata: {}\n\n'
        # Emit metadata
        if active.last_usage:
            meta = {
                "duration_sec": round(elapsed, 1),
                "input_tokens": active.last_usage.get("input_tokens", 0),
                "output_tokens": active.last_usage.get("output_tokens", 0),
                "thinking_tokens": active.last_usage.get("thinking_tokens", 0),
                "stop_reason": active.last_stop_reason or "",
            }
            yield f'event: metadata\ndata: {json.dumps(meta)}\n\n'

    @property
    def last_metadata(self) -> dict | None:
        return getattr(self, '_last_metadata', None)

    async def evaluate_answer(self, question: ExampleQuestion, user_answer: str,
                               provider: str | None = None) -> dict:
        """Evaluate a user's answer using LLM."""
        llm = LLMService.get_instance()
        active = llm.get_provider(provider) if provider else llm.get_active_provider()

        prompt = (
            f"Question: {question.question}\n"
            f"Correct answer: {question.answer}\n"
            f"User's answer: {user_answer}\n"
            f"Question type: {question.type}\n"
            f"Evaluate the user's answer."
        )

        response = await active.generate(prompt, ANSWER_EVALUATE_SYSTEM_PROMPT)
        cleaned = self._clean_json(response)
        try:
            result = json.loads(cleaned)
            return result
        except json.JSONDecodeError:
            return {
                "is_correct": user_answer.strip().lower() == question.answer.strip().lower(),
                "explanation": response[:500],
                "ai_score": None,
                "suggestion": "",
            }

    async def evaluate_answer_stream(self, question: ExampleQuestion, user_answer: str,
                                      provider: str | None = None) -> AsyncIterator[str]:
        """Stream answer evaluation as SSE events."""
        llm = LLMService.get_instance()
        active = llm.get_provider(provider) if provider else llm.get_active_provider()

        prompt = (
            f"Question: {question.question}\n"
            f"Correct answer: {question.answer}\n"
            f"User's answer: {user_answer}\n"
            f"Question type: {question.type}\n"
            f"Evaluate the user's answer."
        )

        # First, send a quick judgment for choice questions
        if question.type == "choice" and question.options:
            is_correct = user_answer.strip().lower() == question.answer.strip().lower()
            yield f'event: judgment_start\ndata: {json.dumps({"type": "choice", "correct": is_correct})}\n\n'
        else:
            yield 'event: judgment_start\ndata: {"type": "essay"}\n\n'

        # Stream the explanation — buffer full response then parse JSON
        start = time.time()
        buffer = ""
        last_token_emit = 0
        async for chunk in active.generate_stream(prompt, ANSWER_EVALUATE_SYSTEM_PROMPT):
            buffer += chunk
            now = time.time()
            if now - last_token_emit >= 0.5:
                last_token_emit = now
                estimated = len(buffer) // 4
                yield f'event: token_progress\ndata: {json.dumps({"chars": len(buffer), "estimated_tokens": estimated, "elapsed": round(now - start, 1)})}\n\n'
        elapsed = time.time() - start

        # Parse JSON response and stream only the explanation
        cleaned = self._clean_json(buffer)
        try:
            result = json.loads(cleaned)
            explanation = result.get("explanation", "")
            # For choice questions, update judgment from LLM
            if question.type == "choice" and result.get("is_correct") is not None:
                yield f'event: judgment_start\ndata: {json.dumps({"type": "choice", "correct": result["is_correct"]})}\n\n'
            # Stream explanation in word chunks for typing effect
            words = explanation.split()
            for i in range(0, len(words), 3):
                chunk_text = " ".join(words[i:i+3])
                if chunk_text:
                    yield f'event: explanation_chunk\ndata: {json.dumps({"text": chunk_text + " "})}\n\n'
                    await asyncio.sleep(0.02)
        except (json.JSONDecodeError, Exception):
            # Fallback: send raw buffer
            yield f'event: explanation_chunk\ndata: {json.dumps({"text": buffer})}\n\n'

        # Parse the full response for essay feedback
        if question.type == "essay":
            cleaned = self._clean_json(buffer)
            try:
                result = json.loads(cleaned)
                yield f'event: essay_feedback\ndata: {json.dumps({"score": result.get("ai_score"), "suggestion": result.get("suggestion", "")})}\n\n'
            except json.JSONDecodeError:
                pass

        yield 'event: done\ndata: {}\n\n'
        # Emit metadata
        if active.last_usage:
            meta = {
                "duration_sec": round(elapsed, 1),
                "input_tokens": active.last_usage.get("input_tokens", 0),
                "output_tokens": active.last_usage.get("output_tokens", 0),
                "thinking_tokens": active.last_usage.get("thinking_tokens", 0),
                "stop_reason": active.last_stop_reason or "",
            }
            yield f'event: metadata\ndata: {json.dumps(meta)}\n\n'

    @staticmethod
    def _parse_questions(response: str, node_title: str, node_id: str = "") -> list[ExampleQuestion]:
        """Parse LLM response into questions."""
        cleaned = QuestionService._clean_json(response)
        try:
            data = json.loads(cleaned)
            if isinstance(data, list):
                questions = []
                for item in data:
                    q = ExampleQuestion(
                        id=str(uuid.uuid4())[:8],
                        node_id=node_id,
                        type=item.get("type", "choice"),
                        question=item.get("question", ""),
                        options=item.get("options"),
                        answer=item.get("answer", ""),
                        explanation=item.get("explanation", ""),
                        difficulty=item.get("difficulty", "medium"),
                    )
                    questions.append(q)
                return questions
        except (json.JSONDecodeError, Exception):
            pass
        return []

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
_question_service: QuestionService | None = None


def get_question_service() -> QuestionService:
    global _question_service
    if _question_service is None:
        _question_service = QuestionService()
    return _question_service
