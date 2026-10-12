"""Build the data files the app reads, one per country, from public official lists.

Inputs (put the downloaded files in backend/sources/, exactly as downloaded):
  India   backend/brands.csv                         hand-made list: brand, form, salts
  US      drug-ndc-0001-of-0001.json.zip            FDA NDC directory (public domain)
          https://download.open.fda.gov/drug/ndc/drug-ndc-0001-of-0001.json.zip
  Canada  allfiles.zip                              Health Canada Drug Product Database (Open Government Licence)
          https://www.canada.ca/content/dam/hc-sc/documents/services/drug-product-database/allfiles.zip
  EU      medicines-output-medicines-report_en.xlsx EMA list of centrally authorised medicines
          https://www.ema.europa.eu/en/documents/report/medicines-output-medicines-report_en.xlsx
A missing file is skipped, so the app works with whatever is there.

Output: docs/data/<code>.json (one list per country) and docs/data/index.json.
Each entry: {"b": brand, "s": [[salt, strength], ...], "f": form, "m": maker}

Run:  python3 backend/build_data.py
"""
import csv
import io
import json
import re
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "sources"
OUT = HERE.parent / "docs" / "data"


def tidy(text):
    """'ACETAMINOPHEN' -> 'Acetaminophen'; keeps short codes like 'D3' readable."""
    text = re.sub(r"\s+", " ", (text or "").strip())
    return text.title() if text.isupper() else text


def add(rows, seen, brand, salts, form, maker):
    """Keep one entry per brand + salts + form."""
    brand = tidy(brand)
    if not brand or not salts:
        return
    key = (brand.lower(), tuple(sorted(s[0].lower() + s[1].lower() for s in salts)), form.lower())
    if key in seen:
        return
    seen.add(key)
    rows.append({"b": brand, "s": salts, "f": tidy(form).lower(), "m": tidy(maker)})


def india():
    """Hand-made list first (checked by a pharmacist), then the DISB list (C-DAC/NRCeS, CC BY 4.0)."""
    rows, seen = [], set()
    for name in ("brands.csv", "india_disb.csv"):
      if not (HERE / name).exists():
        continue
      with open(HERE / name, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            salts = []
            for part in r["salts"].split(" + "):
                m = re.match(r"\s*(.+?)\s+([\d.,]+\s*\S.*)$", part.strip())
                salts.append([m.group(1), m.group(2)] if m else [part.strip(), ""])
            add(rows, seen, r["brand"], salts, r["form"], r.get("maker", ""))
    return rows


def usa(path):
    rows, seen = [], set()
    if path.suffix == ".zip":
        with zipfile.ZipFile(path) as z:
            data = json.loads(z.read(z.namelist()[0]))
    else:  # already unzipped
        data = json.loads(path.read_text())
    for p in data["results"]:
        if p.get("product_type") not in ("HUMAN PRESCRIPTION DRUG", "HUMAN OTC DRUG"):
            continue
        salts = [[tidy(a.get("name", "")), re.sub(r"/1$", "", (a.get("strength") or "").lower()).strip()]
                 for a in p.get("active_ingredients", [])]
        add(rows, seen, p.get("brand_name", ""), salts, p.get("dosage_form", ""), p.get("labeler_name", ""))
    return rows


def canada(path):
    """The Drug Product Database files have no header row; columns are by position."""
    if path.is_dir():  # already unzipped into a folder
        def table(_, name):
            with open(path / name, encoding="latin-1", newline="") as f:
                return list(csv.reader(f))
        z = None
    else:
        def table(z, name):
            with z.open(name) as f:
                return list(csv.reader(io.TextIOWrapper(f, encoding="latin-1")))
        z = zipfile.ZipFile(path)
    if True:
        drugs = {r[0]: r for r in table(z, "drug.txt") if len(r) > 4 and r[2].strip().lower() == "human"}
        salts, forms, makers = {}, {}, {}
        for r in table(z, "ingred.txt"):
            if r[0] in drugs:
                salts.setdefault(r[0], []).append([tidy(r[2]), f"{r[4]} {r[5]}".strip().lower()])
        for r in table(z, "form.txt"):
            forms.setdefault(r[0], tidy(r[2]))
        for r in table(z, "comp.txt"):
            makers.setdefault(r[0], tidy(r[3]))
    rows, seen = [], set()
    for code, d in drugs.items():
        add(rows, seen, d[4], salts.get(code, []), forms.get(code, ""), makers.get(code, ""))
    return rows


def europe(path):
    """EMA's report has a few title rows; the header row starts the table."""
    import openpyxl
    sheet = openpyxl.load_workbook(path, read_only=True).active
    rows_iter = sheet.iter_rows(values_only=True)
    header = None
    for r in rows_iter:
        if r and any(isinstance(c, str) and c.strip().lower().startswith("name of medicine") for c in r):
            header = [str(c or "").strip().lower() for c in r]
            break
    if not header:
        raise SystemExit("EMA file: header row not found")

    def col(*words):
        for i, h in enumerate(header):
            if all(w in h for w in words):
                return i
        return None
    i_name, i_sub, i_cat = col("name of medicine"), col("active substance"), col("category")
    i_stat, i_holder = col("status"), col("holder")
    rows, seen = [], set()
    for r in rows_iter:
        if not r or not r[i_name]:
            continue
        if i_cat is not None and str(r[i_cat]).strip().lower() != "human":
            continue
        if i_stat is not None and "authorised" != str(r[i_stat]).strip().lower():
            continue
        salts = [[tidy(s), ""] for s in re.split(r"\s*[/,;]\s*", str(r[i_sub] or "")) if s.strip()]
        add(rows, seen, r[i_name], salts, "", r[i_holder] if i_holder is not None else "")
    return rows


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    sources = [
        ("IN", "India", lambda: india()),
        ("US", "United States", lambda: usa(next(SRC.glob("drug-ndc-0001-of-0001.json*")))),
        ("CA", "Canada", lambda: canada(SRC / "allfiles" if (SRC / "allfiles").is_dir() else SRC / "allfiles.zip")),
        ("EU", "European Union", lambda: europe(SRC / "medicines-output-medicines-report_en.xlsx")),
    ]
    files = {"US": "drug-ndc-0001-of-0001.json.zip", "CA": "allfiles.zip", "EU": "medicines-output-medicines-report_en.xlsx"}
    index = []
    for code, name, load in sources:
        if code in files and not list(SRC.glob(files[code] + "*")) and not list(SRC.glob(files[code].replace(".zip", ""))):
            print(f"{name}: source file not found, skipped")
            continue
        rows = load()
        rows.sort(key=lambda r: r["b"].lower())
        (OUT / f"{code}.json").write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")))
        index.append({"code": code, "name": name, "count": len(rows)})
        print(f"{name}: {len(rows)} products")
    (OUT / "index.json").write_text(json.dumps(index, indent=1) + "\n")
    old = OUT / "medicines.json"
    if old.exists():
        old.unlink()


if __name__ == "__main__":
    main()
