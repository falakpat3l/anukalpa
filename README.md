# anukalpa

*anukalpa* (अनुकल्प) means an alternative or substitute in Sanskrit.

Type a medicine brand (or a salt) and see the generic name to ask for (salts and strength), plus other brands with the same salts and strength, in India, the US, Canada and the EU.

- Web: https://falakpat3l.github.io/anukalpa/
- Android: download the APK from Releases (test build).

For information only. Do not change or stop a medicine without asking your doctor or pharmacist.

## How it fits together

```
backend/brands.csv     India: hand-made list (brand, form, salts)
backend/india_disb.csv.gz  India (zipped CSV): from C-DAC / NRCeS Drug Information Service Bundle (CC BY 4.0), see backend/disb/
backend/sources/       official public lists, downloaded as they are:
                         US FDA NDC directory, Health Canada Drug Product Database, EMA medicines list
        |  python3 backend/build_data.py
        v
docs/data/<country>.json   one compact file per country (each name stored once), plus index.json
docs/index.html            the app (website and Android app use the same page)
docs/sw.js                 offline use for the website (not used in the Android app)
docs/icon.svg, icon-*.png  web app icons (same capsule as the Android launcher icon)
app/                       small Android wrapper that shows docs/ offline
```

There is no server: the "backend" is the script that builds the data files. The app sends nothing anywhere. Pick a country (or All) to search; generic names are matched across countries, so "paracetamol" also finds US products listed as acetaminophen, and "Pantoprazole 40 mg" matches "Pantoprazole sodium 40 mg". A search stays in the page link (for example `?q=dolo%20650&c=ALL`), so it can be shared or reopened, and Back returns to the previous search.

- **Offline:** the Android app has every file inside. The website keeps the page and each country list you opened, so it works offline after the first visit.
- **Share:** each result has a Share button. It opens the phone's share sheet, or copies a link to that brand.
- **Recent searches:** the last 5 searches show under the search box when it is empty. They are kept only on your device (Clear removes them).

## Update the data

1. Download the three files listed at the top of `backend/build_data.py` (US, Canada, EU) into `backend/sources/`. The India list from DISB is rebuilt separately, see `backend/disb/README.md`.
2. Run `python3 backend/build_data.py`.
3. In `docs/sw.js`, raise `VERSION` (for example `v1` to `v2`), so website visitors who used it offline get the new lists.
4. Commit and push.

To add an Indian brand, add a line to `backend/brands.csv`, for example `Dolo 650,tablet,Paracetamol 650 mg`, and run the script again.

## Data sources and licences

| Country | Source | Licence |
|---|---|---|
| India | Drug Information Service Bundle v1.25, C-DAC Pune / NRCeS, Ministry of Health and Family Welfare | CC BY 4.0 (SNOMED CT content not used); reformatted |
| India | `backend/brands.csv`, hand-made | this repo |
| US | FDA NDC directory (openFDA) | public domain |
| Canada | Health Canada Drug Product Database | Contains information licensed under the Open Government Licence, Canada |
| EU | European Medicines Agency, list of authorised medicines | source: European Medicines Agency |

Brand and trade names belong to their owners and are shown only to identify products. The data is provided as is, for information only.

Made by [Falak Patel](https://falakpatel.com).
