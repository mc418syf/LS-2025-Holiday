# Livestock · Q4 2025 Holiday Dashboard

A single-page review of the 2025 holiday period (1 Oct – 31 Dec 2025), modelled on the JD Sports Canada Q4 planning dashboard.
Open `index.html` in a browser, or serve it with GitHub Pages.

**Tabs:** Overview · Calendar · Performance · Rhythm & ramp · BFCM · Launches · Channels · Products & brands · Paid search · Organic search · Sources & notes

## Data sources (`raw/`)
| File | Source |
|---|---|
| `shopify_total_sales_breakdown.csv` | Shopify daily net sales, discounts, reversals, sessions, CVR, AOV vs same date 2024 |
| `google_ads/*.csv` | Google Ads overview cards (daily, campaigns, devices, keywords, search terms, demographics, day × hour) |
| `gsc_performance_on_search.xlsx` | Google Search Console (daily, queries, pages, countries, devices, appearance) |
| `ga4/*.csv` | GA4 acquisition by first-user channel, and pages and screens |
| `build/launches.csv` | Release calendar, transcribed from the launch calendar screenshots |

## Rebuild
```
python3 build/build_data.py raw data.json   # needs openpyxl
python3 build/make_page.py                  # injects data.json into build/template.html -> index.html
```
To add the actual promo calendar, edit `periods` and `events` in `build/build_data.py`, then rebuild.
