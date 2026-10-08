#!/usr/bin/env python3
"""Offline English↔Kiswahili translation for the Get Mchongo import flow."""
import json
import re
import sys
import types


class LocalSentenceSplitter:
    """Small deterministic sentence splitter; translation itself stays in the local model."""

    def split_sentences(self, text: str) -> list[str]:
        return [part.strip() for part in re.split(r"(?<=[.!?])\s+|\n+|(?<=;)\s+", text) if part.strip()]


def main() -> None:
    request = json.load(sys.stdin)
    source = request.get("source")
    target = request.get("target")
    texts = request.get("texts")
    if source not in {"en", "sw"} or target not in {"en", "sw"} or not isinstance(texts, list):
        raise ValueError("Invalid local translation request.")
    if source == target:
        print(json.dumps({"texts": texts}, ensure_ascii=False))
        return

    # Argos imports Stanza for its optional splitter. This app supplies its own small splitter,
    # so a minimal deployment does not need to install Stanza, PyTorch, or CUDA packages.
    try:
        import stanza  # noqa: F401
    except ImportError:
        sys.modules["stanza"] = types.ModuleType("stanza")

    import argostranslate.settings
    argostranslate.settings.device = "cpu"
    argostranslate.settings.inter_threads = 1
    argostranslate.settings.intra_threads = 1
    argostranslate.settings.chunk_type = argostranslate.settings.ChunkType.MINISBD
    import argostranslate.translate

    languages = argostranslate.translate.get_installed_languages()
    from_language = next((language for language in languages if language.code == source), None)
    to_language = next((language for language in languages if language.code == target), None)
    if from_language is None or to_language is None:
        raise RuntimeError("Offline translation language data is not installed.")
    translation = from_language.get_translation(to_language)
    if translation is None:
        raise RuntimeError("The offline English↔Kiswahili translation model is not installed.")
    # The packaged Stanza sentence detector does not support Swahili. Use a language-neutral
    # sentence splitter; CTranslate2 still runs the downloaded Argos translation model locally.
    translation.sentencizer = LocalSentenceSplitter()

    protected_pattern = re.compile(
        r"https?://[^\s<>]+|www\.[^\s<>]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\+?\d[\d().\s/-]{5,}\d",
        re.IGNORECASE,
    )

    def translate_text(text: str) -> str:
        if not text:
            return text
        protected: list[str] = []

        def mask(match: re.Match[str]) -> str:
            protected.append(match.group(0))
            return f" ZXQSAFEVALUE{len(protected) - 1}QXZ "

        masked = protected_pattern.sub(mask, text)
        chunks: list[str] = []
        # Keep line boundaries, but avoid feeding very long OCR lines to the model.
        for segment in re.split(r"(\n+)", masked):
            if not segment or segment.isspace() or segment.startswith("\n"):
                chunks.append(segment)
                continue
            words = re.findall(r"\S+\s*", segment)
            current = ""
            translated_parts: list[str] = []
            for word in words:
                if current and len(current) + len(word) > 700:
                    translated_parts.append(translation.translate(current))
                    current = ""
                current += word
            if current:
                translated_parts.append(translation.translate(current))
            chunks.append("".join(translated_parts))
        result = "".join(chunks)
        for index, value in enumerate(protected):
            result = re.sub(rf"\bZXQSAFEVALUE\s*{index}\s*QXZ\b", value, result, flags=re.IGNORECASE)
            result = result.replace(f"ZXQSAFEVALUE{index}QXZ", value)
        return result

    translated = [translate_text(text if isinstance(text, str) else "") for text in texts]
    print(json.dumps({"texts": translated}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # The caller surfaces a concise message to the admin.
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
