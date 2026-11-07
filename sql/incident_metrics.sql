-- OpsLens: actual parameterized reporting logic is executed by
-- pipeline/build_analytics.py using SQLite (or DuckDB via --engine duckdb).
-- This file documents the core portable SQL used by the release pipeline.
-- Bind :start_epoch and :snapshot_epoch to Unix timestamps.

-- Report 1: resolution-date SLA compliance and MTTR.
SELECT COUNT(*) AS resolved,
       SUM(CASE WHEN sla_status = 'Met' THEN 1 ELSE 0 END) AS met,
       ROUND(100.0 * SUM(CASE WHEN sla_status = 'Met' THEN 1 ELSE 0 END)
             / NULLIF(COUNT(*), 0), 1) AS sla_compliance_pct,
       ROUND(AVG(resolution_minutes), 1) AS mean_resolution_minutes
FROM incidents
WHERE resolved_epoch >= :start_epoch
  AND resolved_epoch <= :snapshot_epoch;

-- Report 2: historical backlog as of any instant (not today's ticket status).
SELECT COUNT(*) AS open_as_of_date
FROM incidents
WHERE opened_epoch <= :day_end_epoch
  AND (resolved_epoch IS NULL OR resolved_epoch > :day_end_epoch);

-- Report 3: team-level SLA performance using completion-date denominator.
SELECT team,
       COUNT(*) FILTER (WHERE opened_epoch >= :start_epoch
                           AND opened_epoch <= :snapshot_epoch) AS opened,
       COUNT(*) FILTER (WHERE resolved_epoch >= :start_epoch
                           AND resolved_epoch <= :snapshot_epoch) AS resolved,
       SUM(CASE WHEN resolved_epoch >= :start_epoch
                     AND resolved_epoch <= :snapshot_epoch
                     AND sla_status = 'Met' THEN 1 ELSE 0 END) AS met
FROM incidents
GROUP BY team;

-- Report 4: recurring service and issue combinations.
SELECT service, summary, COUNT(*) AS ticket_count,
       AVG(reassignments) AS mean_reassignments
FROM incidents
WHERE opened_epoch >= :start_epoch AND opened_epoch <= :snapshot_epoch
GROUP BY service, summary
ORDER BY ticket_count DESC;
