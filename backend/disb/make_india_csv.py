"""Turn the medicine list from the Drug Information Service Bundle (DISB, C-DAC/NRCeS)
into backend/india_disb.csv (brand, form, salts, maker), the same layout as brands.csv.

Input: medicine.jsonl, one record per line, dumped from DISB's Data/data/medicine index
with Dump.java (see backend/disb/README.md). Only the medicine names and makers are used
(the India-specific content, licensed CC BY 4.0), not SNOMED CT International content.
"""
import csv, json, re, sys

NAME = re.compile(r"^(.*?) \((.+)\) (.+)$")
STRENGTH = re.compile(r"^([\d.,]+ \S+?(?:/[\d.,]* ?[A-Za-z]+)?)(?= |$)")

def parse(name):
    m = NAME.match(name)
    if not m:
        return None
    brand, salts_txt, rest = m.groups()
    salts = [s.strip() for s in salts_txt.split(" and ")]
    strengths = []
    while True:
        s = STRENGTH.match(rest)
        if not s:
            break
        strengths.append(s.group(1))
        rest = rest[s.end():].lstrip()
        if rest.startswith("+ "):
            rest = rest[2:]
        else:
            break
    if len(strengths) != len(salts):
        strengths = [""] * len(salts) if len(strengths) != 1 or len(salts) != 1 else strengths
    parts = [(sa[0].upper() + sa[1:] + (" " + st if st else "")) for sa, st in zip(salts, strengths)]
    return brand.strip(), rest.strip(), " + ".join(parts)

def main(src, dst):
    seen, n = set(), 0
    with open(dst, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["brand", "form", "salts", "maker"])
        for line in open(src, encoding="utf-8"):
            d = json.loads(line)
            p = parse(d.get("medicineName", ""))
            if not p:
                continue
            maker = d.get("manufacturer.manufacturerName", "").strip()
            key = (p[0].lower(), p[2].lower(), p[1].lower())
            if key in seen:
                continue
            seen.add(key)
            w.writerow([p[0], p[1], p[2], maker])
            n += 1
    print(f"wrote {n} rows to {dst}")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
