# Indian data from DISB

`backend/india_disb.csv.gz` is made from the Drug Information Service Bundle (DISB) v1.25 by C-DAC Pune / NRCeS (Ministry of Health and Family Welfare).

Licence: DISB content (other than SNOMED CT International Release content) is under Creative Commons Attribution 4.0 (CC BY 4.0). Only India-specific medicine names (brand, salts, strength, form) and makers are used here; no SNOMED CT codes or International Release terms are included. Brand and trade names belong to their owners. Changes made: names split into brand, salts with strengths, and form; duplicates removed.

To rebuild it from a newer DISB release (needs Java 17 or newer):

1. Unzip DISB, then take `lucene-core-*.jar` out of `disb-*.jar` (it is in `BOOT-INF/lib/`).
2. `javac -cp lucene-core.jar Dump.java`
3. `java -cp lucene-core.jar:. Dump <DISB>/Data/data/medicine medicine.jsonl`
4. `python3 make_india_csv.py medicine.jsonl ../india_disb.csv.gz`
5. `python3 ../build_data.py`
