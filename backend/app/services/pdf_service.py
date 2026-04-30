"""PDF text extraction using PyMuPDF."""
import os
import uuid
from typing import Optional
import fitz  # PyMuPDF


class PDFService:
    """Extract text from PDF files."""

    def __init__(self):
        self._uploads: dict[str, str] = {}  # id -> file path

    async def save_upload(self, file_data: bytes, filename: str) -> str:
        """Save uploaded PDF and return its ID."""
        upload_id = str(uuid.uuid4())
        upload_dir = "uploads"
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, f"{upload_id}_{filename}")
        with open(file_path, "wb") as f:
            f.write(file_data)
        self._uploads[upload_id] = file_path
        return upload_id

    def get_file_path(self, upload_id: str) -> Optional[str]:
        return self._uploads.get(upload_id)

    def extract_text(self, file_path: str, max_chars: int = 50000) -> str:
        """Extract text from a PDF file."""
        try:
            doc = fitz.open(file_path)
            text_parts = []
            total = 0
            for page_num, page in enumerate(doc):
                text = page.get_text()
                text_parts.append(f"--- Page {page_num + 1} ---\n{text}")
                total += len(text)
                if total > max_chars:
                    text_parts.append(f"\n[... truncated at {max_chars} characters]")
                    break
            doc.close()
            return "\n".join(text_parts)
        except Exception as e:
            raise ValueError(f"Failed to extract PDF text: {e}")

    def extract_text_chunks(self, file_path: str, chunk_size: int = 3000,
                            overlap: int = 200) -> list[str]:
        """Extract text and split into overlapping chunks for long PDFs."""
        full_text = self.extract_text(file_path, max_chars=100000)
        words = full_text.split()
        chunks = []
        start = 0
        while start < len(words):
            end = start + chunk_size
            chunk = " ".join(words[start:end])
            chunks.append(chunk)
            start = end - overlap
            if start < 0:
                start = 0
        return chunks if chunks else [full_text]

    def cleanup(self, upload_id: str):
        """Remove uploaded file."""
        file_path = self._uploads.pop(upload_id, None)
        if file_path and os.path.exists(file_path):
            os.remove(file_path)


# Singleton
_pdf_service: PDFService | None = None


def get_pdf_service() -> PDFService:
    global _pdf_service
    if _pdf_service is None:
        _pdf_service = PDFService()
    return _pdf_service
