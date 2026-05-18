#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import re
import zipfile
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape


def resolve_markdown_input(argv: list[str]) -> Path:
    if len(argv) >= 2 and argv[1].strip():
        explicit_path = (Path.cwd() / argv[1].strip()).resolve()
        if not explicit_path.exists():
            raise FileNotFoundError(f"指定 Markdown 文件不存在: {explicit_path}")
        return explicit_path

    candidates = [
        "csm_detailed_analysis.md",
        "销售周报_终极版_20260320.md",
    ]
    for name in candidates:
        candidate_path = (Path.cwd() / name).resolve()
        if candidate_path.exists():
            return candidate_path
    raise FileNotFoundError("未找到可转换的 Markdown 文件，请先运行 detailed-analysis 子命令。")


def parse_markdown(markdown: str) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for raw_line in markdown.splitlines():
        line = raw_line.rstrip("\n")
        stripped = line.strip()
        if not stripped:
            items.append({"kind": "blank"})
            continue
        if line.startswith("# "):
            items.append({"kind": "heading1", "text": line[2:].strip()})
            continue
        if line.startswith("## "):
            items.append({"kind": "heading2", "text": line[3:].strip()})
            continue
        if line.startswith("### "):
            items.append({"kind": "heading3", "text": line[4:].strip()})
            continue
        if line.startswith("- "):
            items.append({"kind": "bullet", "text": line[2:].strip()})
            continue
        if re.match(r"^\d+\.\s", line):
            items.append({"kind": "plain", "text": stripped})
            continue
        items.append({"kind": "plain", "text": line})
    return items


def run_xml(text: str, bold: bool = False, size: int | None = None) -> str:
    text_escaped = escape(text)
    space_attr = ' xml:space="preserve"' if text.startswith(" ") or text.endswith(" ") else ""
    rpr_parts: list[str] = []
    if bold:
        rpr_parts.append("<w:b/>")
    if size:
        rpr_parts.append(f'<w:sz w:val="{size}"/>')
        rpr_parts.append(f'<w:szCs w:val="{size}"/>')
    rpr_xml = f"<w:rPr>{''.join(rpr_parts)}</w:rPr>" if rpr_parts else ""
    return f"<w:r>{rpr_xml}<w:t{space_attr}>{text_escaped}</w:t></w:r>"


def paragraph_xml(item: dict[str, Any]) -> str:
    kind = item.get("kind")
    if kind == "blank":
        return "<w:p/>"
    if kind == "heading1":
        return f"<w:p>{run_xml(str(item.get('text') or ''), bold=True, size=40)}</w:p>"
    if kind == "heading2":
        return f"<w:p>{run_xml(str(item.get('text') or ''), bold=True, size=34)}</w:p>"
    if kind == "heading3":
        return f"<w:p>{run_xml(str(item.get('text') or ''), bold=True, size=30)}</w:p>"
    if kind == "bullet":
        return f"<w:p>{run_xml('• ' + str(item.get('text') or ''))}</w:p>"
    return f"<w:p>{run_xml(str(item.get('text') or ''))}</w:p>"


def build_document_xml(items: list[dict[str, Any]]) -> str:
    paragraphs = "".join(paragraph_xml(item) for item in items)
    sect = (
        '<w:sectPr>'
        '<w:pgSz w:w="11906" w:h="16838"/>'
        '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>'
        "</w:sectPr>"
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body>{paragraphs}{sect}</w:body>"
        "</w:document>"
    )


def write_docx(output_path: Path, document_xml: str) -> None:
    content_types_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        "</Types>"
    )
    rels_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        "</Relationships>"
    )

    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types_xml.encode("utf-8"))
        zf.writestr("_rels/.rels", rels_xml.encode("utf-8"))
        zf.writestr("word/document.xml", document_xml.encode("utf-8"))


def main(argv: list[str]) -> int:
    input_path = resolve_markdown_input(argv)
    markdown = input_path.read_text(encoding="utf-8")
    items = parse_markdown(markdown)
    document_xml = build_document_xml(items)

    output_path = (Path.cwd() / f"{input_path.stem}.docx").resolve()
    write_docx(output_path, document_xml)
    print(f"[csm-doc-export] Word 文档已生成: {output_path}")
    return 0


if __name__ == "__main__":
    import sys

    try:
        raise SystemExit(main(sys.argv))
    except Exception as error:
        print(f"[csm-doc-export] md-to-docx failed: {error}")
        raise SystemExit(1)

