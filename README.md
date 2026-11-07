# OpsLens | IT Service Desk Intelligence

**Independent IT operations, ITSM and SQL analytics portfolio demonstration**

**[Open the live demo](https://opslens-hjsarkers-projects.vercel.app/)** | [Technical architecture](docs/ARCHITECTURE.md) | [Metric definitions](docs/METHODOLOGY.md)

OpsLens uses **3,200 synthetic incidents** and their full event histories to investigate SLA compliance, service workloads, ticket escalations, historical backlog and recurring issues. A deterministic Python pipeline creates the data and a real SQL aggregation step produces the reporting model. No employer, customer or employee records are used.

## Features

- Operations dashboard: SQL-derived KPIs, incident activity and daily as-of backlog.
- Clickable KPI and service/team drill-downs to individual incidents.
- Searchable, sortable and filterable incident explorer with CSV export.
- Incident timelines containing assignments, pauses, escalations and resolution events.
- SLA monitor with business-hour and holiday handling, risk bands and isolated policy what-if lab.
- SQL-aggregated service/team performance and recurring issue investigations.
- Seven independent data validation rules and seven deliberately broken mock fixtures.
- Responsive UI, direct incident links, keyboard interaction and reduced-motion support.

## Rebuild locally (Python 3.10+)

```bash
python -m pipeline.build_release
python -m unittest discover -s tests -p 'test_pipeline.py' -v
python -m unittest discover -s tests -p 'test_analytics.py' -v
python -m http.server 8000
# Open http://localhost:8000
```

No Python libraries are needed for the default SQL build because it uses the built-in SQLite engine. To verify the same analytics against DuckDB when available:

```bash
python -m pip install duckdb
python -m pipeline.build_analytics --engine duckdb
```

The public build is verified with SQLite; do not claim the optional DuckDB path is tested unless it has been run in your environment.

To run desktop, tablet and mobile browser checks, install Playwright and Chromium then run `python tests/test_browser.py`. A GitHub Actions workflow is included for when the project is placed in its dedicated repository.

## Repository structure

| Path | Contents |
|---|---|
| `pipeline/generate_data.py` | Seeded synthetic generator and SLA calendar |
| `pipeline/build_analytics.py` | Executable SQL aggregation, backlog, team/service reporting and data quality fixtures |
| `pipeline/build_release.py` | One-command reproducible data and asset generation |
| `pipeline/validate_data.py` | Source record validation |
| `sql/incident_metrics.sql` | SQL reporting definitions and interview examples |
| `data/analytics.json` | Published SQL aggregates used by the dashboard |
| `data/incidents.json.gz` | Compressed synthetic fact and event data |
| `config/calendar.json` | Configurable regional example working calendar |
| `app.js`, `index.html`, `styles.css` | Responsive interactive application |
| `tests/` | Unit tests, reconciliation checks and browser smoke tests |
| `.github/workflows/ci.yml` | Prepared GitHub CI (runs once repository exists) |
| `docs/` | Methodology and architecture |

## Important boundaries

All data is fictional. The demo does not access a real ITSM instance and does not claim machine-learning predictions. The "Policy lab" is an illustrative sensitivity test, not a live recalculation of stored incident history. The frontend is dependency-free JavaScript rather than React/TypeScript; this is an intentional performance and reproducibility choice for the portfolio MVP. A dedicated GitHub repository and automatic Git-to-Vercel deployment still require connecting the code to GitHub.

## License

MIT for application source. Third-party names are included only as synthetic incident categories.
