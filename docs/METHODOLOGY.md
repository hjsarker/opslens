# OpsLens metric definitions and assumptions

All reported records are generated and hypothetical. They do not describe a real IT support organization.

## Dates and snapshots

A fixed snapshot on 7 November 2026 provides reproducibility. Date-range tabs select a number of days backward from that snapshot. Incident creation is the basis for category/priority charts; final resolution time is the basis for SLA compliance and MTTR. Current backlog and at-risk workload are always snapshot measures.

## SQL reporting

`pipeline/build_analytics.py` executes SQL over the incident fact table, not handwritten dashboard summary values. SQLite ships with Python and is the tested default; DuckDB is an optional alternative when installed. SQL aggregates for 30, 90 and 365 days and complete history are generated into `data/analytics.json`. The frontend validates that the aggregate snapshot and number of incident facts match before rendering.

### SLA compliance

Resolved within example SLA / all incidents resolved during the reporting window. Open incidents are excluded from this denominator. Open SLA breaches are reported separately. A resolution exactly at the target is compliant; more than 100% consumption counts as a breach.

### Resolution time (MTTR)

Calendar minutes between incident creation and final resolution for incidents completed within the selected period. This is not a business-hour metric.

### Historical backlog

At the end of each selected date, count incidents with `opened_epoch <= day_end` and either `resolved_epoch IS NULL` or `resolved_epoch > day_end`. Calculated through SQL for each day. No backdating of the current incident state is involved.

### Team and service reports

Ticket opened counts are based on opening date; resolution counts and compliance denominators use final resolution date. Team attribution uses the current or last resolver group. This is not an event-sourced ownership-at-time attribution, and a team transfer history can be inspected on each incident page.

### Recurring issue patterns

Aggregate identical service name and short summary text, then show volume and average resolver-team transfers. This is a clue for investigation, not a confirmed root cause.

## SLA clocks

P1 is 4 calendar hours; P2 is 8 calendar hours; P3 is 16 business hours; P4 is 40 business hours. P3/P4 only count Monday through Friday, 09:00 to 17:00, **Europe/Berlin**, excluding public holidays configured for North Rhine-Westphalia. On-hold intervals are deducted from eligible time. The policy lab explores what-if target changes on an individual example without modifying published records. Changes to holiday calendars or full policy timings require regenerating the static dataset.

## Quality checks

Seven independent Python checks cover unique incident IDs, required fields, timestamp order, completed states, event sequences, assignment counts and SLA policy values. Seven deliberately corrupted mock examples demonstrate detection. They are never included in the published KPI denominator or ticket records.

## What this is not

No ServiceNow or Jira production access, no real cases or employer performance measures, no AI predictions and no real-time polling. The data generator is intentionally deterministic. Charts are intended for investigative navigation rather than real operational decision-making.
