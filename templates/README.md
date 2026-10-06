# Data still needed

Fill these in, save them in `raw/` under the same names, and rebuild (`python3 build/build_data.py raw data.json && python3 build/make_page.py`).
Each section of the dashboard switches on automatically when its file is present.

| File | What it unlocks | Where to get it |
|---|---|---|
| `promo_calendar.csv` | Exact sale events and dates (replaces the windows inferred from Klaviyo), sale vs messaging-only, discount depth | Your promo / trading calendar. One row per event; `type` is `sale` (a markdown) or `messaging` (not a markdown) |
| `full_price_vs_markdown_daily.csv` | Full price vs markdown split by day, per sale event and per period | Shopify: Analytics → Reports → Sales by product variant, by day, compared with each variant's compare-at price. Or your ERP/merch report with a markdown flag. `py_` columns are optional (2024 same dates) |
| `customer_type_daily.csv` | New customers per day and per event, new vs returning mix over time | Shopify: Analytics → Reports → "Sales over time" by day, broken down by **Customer type** (new / returning), 1 Oct – 31 Dec 2025 |

Optional but useful: Meta / other paid spend by day (for a blended MER), and Klaviyo campaign revenue (the current export has no revenue column).
