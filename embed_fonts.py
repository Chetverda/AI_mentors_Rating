#!/usr/bin/env python3
"""Embed Rostelecom Basis Regular into fonts-embedded.css for file:// and GitHub Pages."""

import base64
from pathlib import Path

BASE = Path(__file__).resolve().parent
FONT = BASE / "fonts" / "RostelecomBasis-Regular.ttf"
OUT = BASE / "fonts-embedded.css"


def main():
    if not FONT.exists():
        raise FileNotFoundError(f"Font not found: {FONT}")
    data = base64.b64encode(FONT.read_bytes()).decode("ascii")
    css = (
        "@font-face{"
        "font-family:'Rostelecom Basis';"
        f"src:url(data:font/truetype;charset=utf-8;base64,{data}) format('truetype');"
        "font-weight:400;font-style:normal;font-display:swap"
        "}\n"
    )
    OUT.write_text(css, encoding="utf-8")
    print(f"Written {OUT.name} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
