"""文档解析工具：支持 pdf / docx / md / txt 等常见格式。
所有 parser 都返回纯文本（str），异常时抛 ValueError。
"""
from __future__ import annotations

import os
from pathlib import Path


def _read_bytes(path: str) -> bytes:
    with open(path, "rb") as f:
        return f.read()


def parse_txt(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except UnicodeDecodeError:
        with open(path, "r", encoding="gbk", errors="ignore") as f:
            return f.read()


def parse_md(path: str) -> str:
    # markdown 本身就是纯文本，我们保留结构即可，不需要转 HTML
    return parse_txt(path)


def parse_docx(path: str) -> str:
    try:
        from docx import Document  # type: ignore
    except Exception as e:  # pragma: no cover
        raise RuntimeError("python-docx 未安装，无法解析 .docx：" + str(e))

    doc = Document(path)
    parts: list[str] = []
    for p in doc.paragraphs:
        if p.text and p.text.strip():
            parts.append(p.text)
    for table in doc.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells if c and c.text]
            if cells:
                parts.append(" | ".join(cells))
    return "\n".join(parts)


def parse_pdf(path: str) -> str:
    try:
        from PyPDF2 import PdfReader  # type: ignore
    except Exception as e:  # pragma: no cover
        raise RuntimeError("PyPDF2 未安装，无法解析 .pdf：" + str(e))

    reader = PdfReader(path)
    chunks: list[str] = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        if text.strip():
            chunks.append(f"--- 第 {i + 1} 页 ---\n{text}")
    return "\n\n".join(chunks)


def parse_pptx(path: str) -> str:
    try:
        from pptx import Presentation  # type: ignore
    except Exception as e:  # pragma: no cover
        raise RuntimeError("python-pptx 未安装，无法解析 .pptx：" + str(e))

    prs = Presentation(path)
    parts: list[str] = []
    for i, slide in enumerate(prs.slides):
        texts: list[str] = []
        for shape in slide.shapes:
            if shape.has_text_frame:
                for para in shape.text_frame.paragraphs:
                    t = "".join(run.text for run in para.runs).strip()
                    if t:
                        texts.append(t)
            elif shape.has_table:
                for row in shape.table.rows:
                    cells = [c.text.strip() for c in row.cells if c.text.strip()]
                    if cells:
                        texts.append(" | ".join(cells))
        if texts:
            parts.append(f"--- 幻灯片 {i + 1} ---\n" + "\n".join(texts))
    return "\n\n".join(parts)


def parse_file(path: str, content_type: str | None = None) -> str:
    if not os.path.exists(path):
        raise FileNotFoundError(path)

    suffix = Path(path).suffix.lower().lstrip(".")
    # content_type 兜底
    if not suffix and content_type:
        ct = content_type.lower()
        if "pdf" in ct:
            suffix = "pdf"
        elif "word" in ct or "msword" in ct or "officedocument" in ct:
            suffix = "docx"
        elif "markdown" in ct:
            suffix = "md"
        else:
            suffix = "txt"

    if suffix in ("txt", "log", "csv", "json", "py", "js", "ts", "tsx", "jsx", "html", "xml"):
        return parse_txt(path)
    if suffix == "md" or suffix == "markdown":
        return parse_md(path)
    if suffix == "docx":
        return parse_docx(path)
    if suffix == "pdf":
        return parse_pdf(path)
    if suffix == "pptx":
        return parse_pptx(path)
    # 兜底：当文本读
    try:
        return parse_txt(path)
    except Exception as e:
        raise ValueError(f"不支持的文件格式: .{suffix} ({e})")
