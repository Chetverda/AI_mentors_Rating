#!/usr/bin/env python3
"""Update mentors-data.json and index.html from the Excel source file."""

import json
import re
import zipfile
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

BASE = Path(__file__).resolve().parent
DATA_JSON = BASE / "mentors-data.json"
INDEX_HTML = BASE / "index.html"
DATA_SCRIPT_OPEN = '<script type="application/json" id="mentors-data">'
DATA_SCRIPT_CLOSE = '</script>'

LEVEL_ONBOARD = "\u041e\u043d\u0431\u043e\u0440\u0434\u0438\u043d\u0433"
LEVEL_1 = "\u041f\u0435\u0440\u0432\u044b\u0439 \u0443\u0440\u043e\u0432\u0435\u043d\u044c"
LEVEL_2 = "\u0412\u0442\u043e\u0440\u043e\u0439 \u0443\u0440\u043e\u0432\u0435\u043d\u044c"
LEVEL_3 = "\u0422\u0440\u0435\u0442\u0438\u0439 \u0443\u0440\u043e\u0432\u0435\u043d\u044c"
LEVEL_PRO = "\u0427\u0435\u0442\u0432\u0435\u0440\u0442\u044b\u0439 \u0443\u0440\u043e\u0432\u0435\u043d\u044c \u2014 PRO"


def find_xlsx():
    for pattern in ("*2026.xlsx", "*.xlsx"):
        matches = sorted(BASE.glob(pattern))
        if matches:
            return matches[0]
    raise FileNotFoundError(f"No .xlsx file found in {BASE}")


def parse_xlsx(path):
    with zipfile.ZipFile(path) as z:
        ss = []
        if "xl/sharedStrings.xml" in z.namelist():
            root = ET.fromstring(z.read("xl/sharedStrings.xml"))
            ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
            for si in root.findall(".//m:si", ns):
                texts = [t.text or "" for t in si.findall(".//m:t", ns)]
                ss.append("".join(texts))

        wb = ET.fromstring(z.read("xl/workbook.xml"))
        ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
        sheets = [
            (sh.get("name"), sh.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"))
            for sh in wb.findall(".//m:sheet", ns)
        ]
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        rid_to_path = {rel.get("Id"): rel.get("Target") for rel in rels}

        def col_row(ref):
            m = re.match(r"([A-Z]+)(\d+)", ref)
            col = sum((ord(c) - 64) * 26**i for i, c in enumerate(reversed(m.group(1))))
            return col, int(m.group(2))

        def cell_val(c):
            t = c.get("t")
            v = c.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v")
            if v is None or v.text is None:
                return None
            if t == "s":
                return ss[int(v.text)]
            try:
                f = float(v.text)
                return int(f) if f == int(f) else f
            except ValueError:
                return v.text

        all_data = {}
        for name, rid in sheets:
            target = "xl/" + rid_to_path[rid].replace("xl/", "")
            root = ET.fromstring(z.read(target))
            ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
            grid = defaultdict(dict)
            max_r = max_c = 0
            for row in root.findall(".//m:sheetData/m:row", ns):
                for c in row.findall("m:c", ns):
                    ref = c.get("r")
                    col, r = col_row(ref) if ref else (1, int(row.get("r")))
                    grid[r][col] = cell_val(c)
                    max_r, max_c = max(max_r, r), max(max_c, col)
            rows = [
                [grid[r].get(c) for c in range(1, 8)]
                for r in range(1, max_r + 1)
                if any(grid[r].get(c) not in (None, "") for c in range(1, 8))
            ]
            all_data[name] = rows
        return all_data


def find_sheet(raw, *patterns):
    for name in raw:
        if all(p in name for p in patterns):
            return name
    raise KeyError(f"No sheet matching {patterns!r}")


LEVELS = [
    (LEVEL_ONBOARD, lambda s, m, i: s >= 1 or m >= 1 or i >= 1),
    (LEVEL_1, lambda s, m, i: s >= 3 or m >= 1),
    (LEVEL_2, lambda s, m, i: s >= 6 and m >= 1),
    (LEVEL_3, lambda s, m, i: s >= 10 and m >= 4),
    (LEVEL_PRO, lambda s, m, i: s > 15 and m >= 6),
]


def calc_level(s, m, i):
    result = LEVEL_ONBOARD
    for name, check in LEVELS:
        if check(s, m, i):
            result = name
    return result


def parse_mentors(rows):
    mentors = []
    for row in rows[1:]:
        if not row[2] or not isinstance(row[2], str):
            continue
        name = row[2].strip()
        if not name or name[0] in "\u2757\u2705":
            continue
        s, m, i = int(row[3] or 0), int(row[4] or 0), int(row[5] or 0)
        mentors.append(
            {
                "name": name,
                "sessions": s,
                "masterclasses": m,
                "initiatives": i,
                "excelLevel": row[6] or LEVEL_ONBOARD,
                "total": s + m + i,
            }
        )
    return mentors


def enrich(mentors):
    for m in mentors:
        m["level"] = calc_level(m["sessions"], m["masterclasses"], m["initiatives"])
    return sorted(mentors, key=lambda x: (-x["total"], -x["sessions"], -x["masterclasses"], x["name"]))


def build_data():
    raw = parse_xlsx(find_xlsx())
    q1_sheet = find_sheet(raw, "1", "2026")
    q2_sheet = find_sheet(raw, "2", "2026")
    bonus_sheet = find_sheet(raw, "\u0421\u0438\u0441\u0442\u0435\u043c\u0430")

    q1 = enrich(parse_mentors(raw[q1_sheet]))
    q2 = enrich(parse_mentors(raw[q2_sheet]))

    bonus = []
    for row in raw[bonus_sheet][1:6]:
        bonus.append({"num": row[1], "name": row[2], "requirements": row[3], "deadline": row[4], "rewards": row[5]})

    return {
        "q1": q1,
        "q2": q2,
        "all": q2,
        "bonusProgram": bonus,
        "stats": {
            "totalEvents": sum(m["total"] for m in q2),
            "targetEvents": 160,
            "engagedMentors": sum(1 for m in q2 if m["total"] > 0),
            "targetMentors": 40,
            "q1Events": sum(m["total"] for m in q1),
            "q2Events": sum(m["total"] for m in q2),
        },
    }


def patch_index_html(data):
    if not INDEX_HTML.exists():
        return
    html = INDEX_HTML.read_text(encoding="utf-8")
    json_text = json.dumps(data, ensure_ascii=False, indent=2)
    start = html.index(DATA_SCRIPT_OPEN) + len(DATA_SCRIPT_OPEN)
    end = html.index(DATA_SCRIPT_CLOSE, start)
    html = html[:start] + "\n" + json_text + "\n" + html[end:]
    INDEX_HTML.write_text(html, encoding="utf-8")


def main():
    data = build_data()
    DATA_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    patch_index_html(data)

    fixes = [(m["name"], m["excelLevel"], m["level"]) for m in data["q2"] if m["excelLevel"] != m["level"]]
    if fixes:
        print("Fixed Q2 levels:")
        for name, old, new in fixes:
            print(f"  {name}: {old} -> {new}")

    s = data["stats"]
    print(f"Updated {DATA_JSON.name} and {INDEX_HTML.name}")
    print(f"Stats: {s['totalEvents']}/160 events, {s['engagedMentors']}/40 mentors")


if __name__ == "__main__":
    main()
