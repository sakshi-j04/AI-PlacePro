"""Extract text from PDF and DOCX resume files"""
import re
from pathlib import Path

def extract_from_pdf(file_path):
    """Extract text from PDF using pdfplumber (better) or PyPDF2 fallback"""
    try:
        import pdfplumber
        with pdfplumber.open(file_path) as pdf:
            text = ""
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
            return text.strip()
    except Exception:
        try:
            import PyPDF2
            with open(file_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                text = ""
                for page in reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
                return text.strip()
        except Exception as e:
            raise ValueError(f"Could not extract text from PDF: {e}")

def extract_from_docx(file_path):
    """Extract text from DOCX file"""
    try:
        from docx import Document
        doc = Document(file_path)
        return "\n".join([para.text for para in doc.paragraphs if para.text.strip()])
    except Exception as e:
        raise ValueError(f"Could not extract text from DOCX: {e}")

def extract_resume_text(file_path):
    """Extract text from resume file based on extension"""
    path = Path(file_path)
    suffix = path.suffix.lower()
    
    if suffix == ".pdf":
        return extract_from_pdf(file_path)
    elif suffix in [".doc", ".docx"]:
        return extract_from_docx(file_path)
    else:
        raise ValueError(f"Unsupported file format: {suffix}")
