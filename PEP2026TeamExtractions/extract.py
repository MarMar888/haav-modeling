#!/usr/bin/env python3
"""Download PEP team white papers and write one raw JSON per PDF.

Usage: python3 extract.py            (from anywhere; writes next to this file)
       python3 extract.py --year 2025 (uses ../PEP2025TeamExtractions/sources.json)
Needs: poppler (pdftotext, pdfinfo, pdfimages). PDFs are cached in <repo>/.context/pep26_pdfs (gitignored).
"""
import argparse
import hashlib
import html
import json
import re
import shutil
import subprocess
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = "https://www.navalengineers.org"
HERE = Path(__file__).resolve().parent
CACHE = HERE.parent / ".context" / "pep26_pdfs"
UA = {"User-Agent": "Mozilla/5.0"}

# (rank, team, page slug, division, official score from /Education/PEP26, notes, [(doc type, pdf path)])
AUTONOMY = "Autonomy (2 miles, fully autonomous, 30 lb payload)"
UNCREWED = "Uncrewed Open (2 miles, remote controlled, 60 lb payload)"
P = "/Portals/16/PEP/2026/"
TEAMS = [
    (1, "William & Mary", "WilliamMary", AUTONOMY, 88.7, "", [("white_paper", P + "WM/WilliamMary_White_Paper_2026.pdf")]),
    (2, "Virginia Commonwealth University", "VCU", AUTONOMY, 73.0, "", [("white_paper", P + "VCU/VCU PEP26 White Paper.pdf")]),
    (3, "Johns Hopkins University", "JHU", AUTONOMY, 51.5, "", [("white_paper", P + "JHU/JHU_PEP26_WHITE_PAPER.pdf")]),
    (4, "North Carolina State", "NCState", AUTONOMY, 41.3, "Page also lists an 'UPDATED White Papers' file, but it is the Over-the-Horizon RC boat paper (Flying Dutchman), so it is excluded.", [("white_paper", P + "NCstate/NCSU_Autonomy_White_Paper.pdf")]),
    (5, "Univ. of Illinois", "Illinois", AUTONOMY, 40.8, "", [("white_paper", P + "UIUC/University of Illinois White Paper.pdf")]),
    (6, "Longwood University", "Longwood", AUTONOMY, 40.5, "No white paper posted. Team page has an empty href for its 2026 PPT.", []),
    (7, "UVA Autonomous Watercraft Club", "UVA", AUTONOMY, 37.5, "Top Engineering Presentation. Team page labels the 37.5 entry 'Over-the-Horizon/Uncrewed'.", [("white_paper", P + "UVa/UVA - PEP26 White Paper Submission.pdf")]),
    (8, "Univ. of Pittsburgh", "PITT", AUTONOMY, 34.0, "Tied. Document is titled a technical report.", [("white_paper", P + "PITT/PITT_PEP_ASNE_Technical_Report.pdf")]),
    (9, "Stevens Institute", "Stevens", AUTONOMY, 34.0, "Tied. Using the Unmanned paper, not the Manned/Planing one.", [("white_paper", P + "Stevens/Stevens FINAL PEP 2026 Unmanned White Paper.pdf")]),
    (10, "Univ. of Kentucky", "Kentucky", AUTONOMY, 33.3, "Using the Aquanomous paper, not the Over-the-Horizon 'Project Ripple' paper.", [("white_paper", P + "UK/UK-Aquanomous-PEP26 Whitepaper.pdf")]),
    (11, "Virginia Tech", "VT", AUTONOMY, 24.0, "", [("white_paper", P + "VT/VT-Autoboat-PEP 2026 WhitePaper.pdf")]),
    (12, "Princeton Electric Speedboating", "Princeton", AUTONOMY, 20.0, "Using the Unmanned_Autonomous paper only.", [("white_paper", P + "Princeton/PES_Unmanned_Autonomous_PEP26_White Paper.pdf")]),
    (1, "Mass Maritime", "MassMaritime", UNCREWED, 97.8, "Tied Top Overall Paper.", [("white_paper", P + "MassMaritime/Mass Maritime - Birddoggers White Paper PEP26.pdf")]),
    (2, "East Carolina University", "ECU", UNCREWED, 93.0, "", [("white_paper", P + "ECU/ECU PEP BOAT WHITE PAPER.pdf")]),
    (3, "Madison College", "MadisonCollege", UNCREWED, 83.7, "Tied Top Overall Paper.", [("white_paper", P + "Madison/MATC PEP26 White Paper.pdf")]),
    (4, "Robotics Club of Central Florida (UCF)", "UCF", UNCREWED, 78.5, "", [("white_paper", P + "UCF/PEP26-WhitePaper-RCCF.pdf")]),
    (5, "Norfolk State University", "NorfolkState", UNCREWED, 57.7, "", [("white_paper", P + "NorfolkState/NorfolkState-PEP26-WhitePaper.pdf")]),
    (6, "Elon University", "Elon", UNCREWED, 43.3, "", [("white_paper", P + "Elon/Elon University White Paper.pdf")]),
    (7, "Howard University", "Howard", UNCREWED, 42.0, "", [("white_paper", P + "Howard/White Paper Final Report - Howard University.pdf")]),
    (8, "Univ. of Alabama", "Alabama", UNCREWED, 36.7, "", [("white_paper", P + "AL/UA Saban's Sailors PEP 2026 White Paper.pdf")]),
    (9, "Texas A&M", "TAMU", UNCREWED, 36.3, "", [("white_paper", P + "TAMU/PEP26 TAMU White Paper.pdf")]),
    (10, "NU Robotics (Northeastern)", "Northeastern", UNCREWED, 33.7, "", [("white_paper", P + "NUrobotics/Northeastern University - PEP 2026 White Paper.pdf")]),
    (11, "Univ. of Toledo", "Toledo", UNCREWED, 29.5, "Paper is hosted under the UK/ folder on the site. Team page shows no score block.", [("white_paper", P + "UK/Univeristy of Toledo (Uncrewed Open) PEP White Paper.pdf")]),
    (12, "Auburn", "Auburn", UNCREWED, 26.0, "", [("white_paper", P + "Auburn/Auburn University White Paper.pdf")]),
    (13, "Univ. at Buffalo", "Buffalo", UNCREWED, 24.0, "Using the Unmanned paper, not Crewed Displacement.", [("white_paper", P + "Buffalo/UB_Unmanned_PEP26_WhitePaper.pdf")]),
    (14, "UCONN", "UCONN", UNCREWED, 22.5, "", [("white_paper", P + "UCONN/UCONN- SD - White Paper.pdf")]),
    (15, "Univ. of Georgia", "Georgia", UNCREWED, 20.5, "", [("white_paper", P + "Georgia/UGA PEP26 White Paper.pdf")]),
    (16, "Univ. of Delaware", "Delaware", UNCREWED, 13.7, "", [("white_paper", P + "Delaware/University of Delaware ASNE26 White Paper.pdf")]),
]


def url_for(path):
    return urllib.parse.urljoin(BASE, urllib.parse.quote(path, safe="/:?=&%"))


def fetch(url, dest):
    if dest.exists() and dest.stat().st_size > 0:
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        data = r.read()
    if dest.suffix.lower() == ".pdf" and not data.startswith(b"%PDF-"):
        raise ValueError(f"Expected a PDF, received another format from {url}")
    partial = dest.with_suffix(dest.suffix + ".part")
    partial.write_bytes(data)
    partial.replace(dest)


def run(*cmd):
    binary = shutil.which(cmd[0])
    if not binary:
        bundled = Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/poppler/bin" / cmd[0]
        if bundled.is_file():
            binary = str(bundled)
    if not binary:
        raise FileNotFoundError(f"Missing Poppler executable: {cmd[0]}")
    return subprocess.run((binary, *cmd[1:]), capture_output=True, text=True,
                          errors="replace", check=True).stdout


def pdfinfo(pdf):
    info = {}
    for line in run("pdfinfo", str(pdf)).splitlines():
        k, _, v = line.partition(":")
        if v:
            info[k.strip()] = v.strip()
    return info


def pages_of(pdf, *flags):
    # pdftotext separates pages with form feed; the trailing one yields an empty last element
    out = run("pdftotext", *flags, str(pdf), "-")
    pages = out.split("\f")
    if pages and pages[-1] == "":
        pages.pop()
    return pages


def image_counts(pdf):
    counts = {}
    for line in run("pdfimages", "-list", str(pdf)).splitlines()[2:]:
        parts = line.split()
        if parts and parts[0].isdigit():
            counts[int(parts[0])] = counts.get(int(parts[0]), 0) + 1
    return counts


def page_scores(slug):
    """Raw per-entry score blocks from the team page, in document order."""
    t = (HERE.parent / ".context" / "pages" / f"{slug}.html")
    if not t.exists():
        fetch(f"{BASE}/{slug}", t)
    s = t.read_text(errors="ignore")
    chunks = re.split(r"<strong>Competition:</strong>", s)[1:]
    blocks = []
    for c in chunks:
        comp = re.sub(r"\s+", " ", html.unescape(re.split(r"<", c, maxsplit=1)[0])).strip()
        scores = dict(re.findall(r"<strong>([A-Za-z ]+Score):</strong>\s*([\d.]+) points", c))
        if scores:
            blocks.append({"competition": comp, **{k: float(v) for k, v in scores.items()}})
        else:
            blocks.append({"competition": comp})
    return blocks


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--year", type=int, choices=(2025, 2026), default=2026)
    parser.add_argument("--web-text", type=Path, help="Import a complete, page-indexed web PDF text bundle; unavailable layout/image fields remain null")
    args = parser.parse_args()
    year = args.year
    web_documents = None
    if args.web_text:
        bundle = json.loads(args.web_text.read_text())
        if bundle["competition_year"] != year:
            raise ValueError("Web text year does not match requested year")
        web_documents = {url_for(d["source_url"]): d for d in bundle["documents"]}
    output = HERE if year == 2026 else HERE.parent / "PEP2025TeamExtractions"
    source = f"{BASE}/Education/PEP26" if year == 2026 else f"{BASE}/PEP25"
    teams = TEAMS
    if year == 2025:
        manifest = json.loads((output / "sources.json").read_text())
        if manifest["competition_year"] != year:
            raise ValueError("Manifest competition year does not match requested year")
        teams = [(t["division_rank"], t["team"], t["slug"], t["division"],
                  t["official_score"], t["notes"],
                  [(d["document_type"], d["source_url"]) for d in t["documents"]])
                 for t in manifest["teams"]]
    output.mkdir(parents=True, exist_ok=True)
    index = []
    failures = []
    for rank, team, slug, division, score, notes, docs in teams:
        # Existing page_scores includes multiple years. Never attach it to 2025 records.
        scores = page_scores(slug) if year == 2026 else []
        base = {
            "competition_year": year,
            "team": team,
            "division": division,
            "division_rank": rank,
            "official_score": score,
            "official_score_source": source,
            "team_page": f"{BASE}/{slug.split('-')[0]}",
            "team_page_score_blocks": scores,
            "notes": notes,
        }
        if not docs:
            index.append({**base, "documents": []})
            continue
        entry_docs = []
        for doc_type, path in docs:
            url = url_for(path)
            filename = Path(urllib.parse.unquote(urllib.parse.urlsplit(url).path)).name
            if not filename.lower().endswith(".pdf"):
                filename = f"{slug}_{year}_{doc_type}.pdf"
            pdf = (CACHE if year == 2026 else HERE.parent / ".context" / "pep25_pdfs") / slug / filename
            try:
                if web_documents is not None:
                    if url not in web_documents:
                        raise ValueError("Paper text unavailable from web reader; direct download blocked by DNS")
                    web_doc = web_documents[url]
                    lines = web_doc["lines"]
                    if [line["line"] for line in lines] != list(range(web_doc["total_lines"])):
                        raise ValueError("Incomplete or unordered web source lines")
                    info = {"Pages": str(web_doc["page_count"])}
                    txt = ["" for _ in range(web_doc["page_count"])]
                    for line in lines:
                        if not 0 <= line["page_start"] <= line["page_end"] < len(txt):
                            raise ValueError("Invalid source page span")
                        txt[line["page_start"]] += line["text"] + "\n"
                    lay = [None] * len(txt)
                    imgs = {}
                else:
                    fetch(url, pdf)
                    if not pdf.read_bytes().startswith(b"%PDF-"):
                        raise ValueError("Cached file is not a PDF")
                    info = pdfinfo(pdf)
                    txt = pages_of(pdf)
                    lay = pages_of(pdf, "-layout")
                    imgs = image_counts(pdf)
                if not txt or len(txt) != int(info["Pages"]) or len(lay) != len(txt):
                    raise ValueError("Extracted page count does not match PDF metadata")
            except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as exc:
                failure = {"team": team, "source_url": url, "error": str(exc)}
                failures.append(failure)
                entry_docs.append({"document_type": doc_type, "source_url": url,
                                   "status": "failed", "error": str(exc)})
                print(f"FAILED {team}: {exc}", flush=True)
                continue
            n = max(len(txt), len(lay))
            pages = [
                {
                    "page": i + 1,
                    "text": txt[i] if i < len(txt) else "",
                    "text_layout": lay[i] if i < len(lay) else "",
                    "embedded_images": imgs.get(i + 1, 0) if web_documents is None else None,
                }
                for i in range(n)
            ]
            empty = [p["page"] for p in pages if not p["text"].strip()]
            rank_part = f"{rank:02d}_" if rank is not None else ""
            out = output / "json" / f"{division.split()[0].lower()}_{rank_part}{slugify(team)}__{doc_type}.json"
            out.parent.mkdir(exist_ok=True)
            doc = {
                **base,
                "document_type": doc_type,
                "source_url": url,
                "filename": filename,
                "sha256": hashlib.sha256(pdf.read_bytes()).hexdigest() if web_documents is None else None,
                "extracted_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "extractor": "pdftotext (poppler); text = reading order, text_layout = -layout" if web_documents is None else "Web PDF text reader; complete indexed source lines",
                "pdf_info": info,
                "page_count": n,
                "pages_without_text": empty,
                "char_count": sum(len(p["text"]) for p in pages),
                "pages": pages,
            }
            if web_documents is not None:
                doc["source_lines"] = lines
                doc["source_line_count"] = web_doc["total_lines"]
                doc["extraction_notes"] = "All web reader source lines collected. Source line page indices are zero-based; pages[].page is one-based. Lines spanning pages are assigned to their starting page. Layout, image counts, PDF hash and other PDF metadata unavailable. Image-only content is not transcribed."
            out.write_text(json.dumps(doc, indent=2, ensure_ascii=False))
            entry_docs.append({"document_type": doc_type, "status": "extracted", "json": f"json/{out.name}", "source_url": url, "page_count": n, "char_count": doc["char_count"], "pages_without_text": empty})
            print(f"{team:40s} {doc_type:20s} pages={n:3d} chars={doc['char_count']:7d} no_text={empty}")
        index.append({**base, "documents": entry_docs})
    (output / "index.json").write_text(json.dumps(index, indent=2, ensure_ascii=False))
    extracted = sum("json" in d for t in index for d in t["documents"])
    (output / "extraction-status.json").write_text(json.dumps({
        "competition_year": year,
        "attempted_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "extracted": extracted, "failed": len(failures), "failures": failures,
        "entries_without_paper_link": sum(not t["documents"] for t in index),
    }, indent=2))
    print(f"\n{extracted} extracted, {len(failures)} failed -> {output}")
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
