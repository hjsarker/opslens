# OpsLens architecture (Version 2)

## How the demo works

`pipeline.generate_data` produces 3,200 seeded incidents and timestamped events. Each ticket is synthetic. The generator applies **configurable demonstration SLA rules**, including 24-hour policies and a Europe/Berlin weekday calendar with NRW statutory holiday exclusions.

`pipeline.validate_data` checks record integrity. `pipeline.build_analytics` loads validated incident facts and event references into an in-memory **SQL database**, runs actual parameterized analytics SQL, and exports `data/analytics.json`. SQLite is the default because it is installed with Python; an optional `--engine duckdb` adapter uses DuckDB when installed. The SQL output includes period-scoped KPIs, team and service breakdowns, recurring issue aggregates, and a date-by-date backlog reconstructed from opening and final resolution timestamps. Duplicate IDs, event-order problems, impossible timestamps, and other invalid inputs are identified by an independent validator.

`pipeline.build_release` rebuilds the source, SQL reports, flat CSV for independent analysis, and compressed incident JSON reproducibly. The public website then loads **both** the source incidents and precomputed SQL reports. Reporting aggregations come from SQL, while the browser handles filtering, interaction, chart rendering and data export.

```text
config/calendar.json ──┐
                       ├─> Python generator ──> validated incident facts ──┐
config/SLA policies ───┘                                                  ├─> SQL engine ──> analytics.json
                                                        incident events ──┘
                                                                                 │
                                      incidents.json.gz ──────────┐               │
                                                                 └─> static OpsLens interface
```

## Storage and privacy

The static deployment has no login, backend, analytics collector, enterprise integration, customer data or real employee names. It is safe to publish the synthetic source. The static Vercel production deployment currently does **not** have a connected GitHub repository; the included GitHub Actions pipeline activates when the source is committed to a dedicated repository.

## Important scope boundaries

- No live ticket creation or mutation; read-only simulation only.
- Policy-lab changes do **not** rewrite historical data or re-run the calendar engine in the browser.
- SLA results are based on the configured example rules, not production contracts.
- The historical backlog calculation uses final resolution timestamps; the generated records do not model multiple full reopen cycles.
- Public holidays follow the demo's NRW calendar configuration for the dataset period. Other regions and employer calendars need separate policies.
- Date-range analytics use one fixed snapshot in November 2026, not live system state.
- DuckDB is optional; verified default production build uses Python's SQLite engine.
