"""
FamilyCare Security — Lớp bảo mật phía Python
Lọc thêm PII nếu anonymizer.ts phía Express bỏ sót
"""

import re

# Pattern phát hiện thông tin nhạy cảm
_PATTERNS = [
    (re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"), "[email]"),
    (re.compile(r"(\+84|0)(3[2-9]|5[6-9]|7[06-9]|8[1-9]|9[0-9])\d{7}"), "[sdt]"),
    (re.compile(r"\b\d{9,12}\b"), "[so]"),
]


def sanitize(text: str) -> str:
    """Xóa email và số điện thoại khỏi text trước khi gửi Gemini."""
    for pattern, replacement in _PATTERNS:
        text = pattern.sub(replacement, text)
    return text


def is_safe(text: str) -> bool:
    """Kiểm tra text có còn chứa thông tin nhạy cảm không."""
    return not any(p.search(text) for p, _ in _PATTERNS)