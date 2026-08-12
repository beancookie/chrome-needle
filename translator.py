import json
import requests

_ICIBa_URL = (
    "https://dictionary.iciba.com/dictionary/fy/batch"
    "?client=6&key=1000006&timestamp=1786521741958"
    "&signature=2bf8daa41af4dd5a0075d9d27300cf08"
)


def has_chinese(text: str) -> bool:
    return any("\u4e00" <= ch <= "\u9fff" for ch in text)


def translate_zh_to_en(text: str) -> str:
    """Translate Chinese text to English via iCiBa free API."""
    payload = json.dumps({"from": "zh", "to": "en", "textList": [text]})
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://www.iciba.com/",
        "Content-Type": "application/json",
    }
    resp = requests.post(_ICIBa_URL, data=payload, headers=headers, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    if data.get("code") != 1:
        raise RuntimeError(f"iciba translation failed: {data}")
    return data["data"][0]["out"]


def maybe_translate(text: str) -> tuple[str, str | None]:
    """If text contains Chinese, translate to English.
    Returns (final_text, original_if_translated_or_None).
    """
    if has_chinese(text):
        translated = translate_zh_to_en(text)
        return translated, text
    return text, None
