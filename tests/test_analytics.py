"""Independent checks of SQL aggregates, time-scoped backlogs and anomaly scenarios."""
import copy
import json
from pathlib import Path
import unittest
from datetime import datetime
from pipeline.build_analytics import build,quality_checks
from pipeline.generate_data import business_minutes,business_add,nrw_holidays,TZ

class ReportingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data=json.loads(Path('data/incidents.json').read_text(encoding='utf8'))
        cls.metrics=build(write=False)
        cls.records=cls.data['incidents']

    def test_sql_counts_match_incidents(self):
        period=self.metrics['ranges']['0']
        self.assertEqual(period['opened'],len(self.records))
        self.assertEqual(period['resolved'],sum(bool(i['resolvedAt']) for i in self.records))
        self.assertEqual(period['met'],sum(i['slaStatus']=='Met' for i in self.records))
        self.assertAlmostEqual(period['compliance'],round(100*period['met']/period['resolved'],1))

    def test_backlog_reconstructs_snapshot(self):
        points=self.metrics['backlogDaily']
        self.assertEqual(len(points),367)
        self.assertEqual(points[-1]['count'],self.metrics['current']['open'])
        self.assertTrue(all(p['count']>=0 for p in points))

    def test_team_resolution_denominators(self):
        for period in self.metrics['ranges'].values():
            self.assertEqual(sum(x['opened'] for x in period['teams']),period['opened'])
            self.assertEqual(sum(x['resolved'] for x in period['teams']),period['resolved'])
            for team in period['teams']:
                self.assertTrue(team['compliance'] is None or 0<=team['compliance']<=100)

    def test_service_kpis_reconcile(self):
        for period in self.metrics['ranges'].values():
            self.assertEqual(sum(x['opened'] for x in period['services']),period['opened'])
            self.assertEqual(sum(x['resolved'] for x in period['services']),period['resolved'])

    def test_nrwholiday_excluded(self):
        self.assertIn(datetime(2026,1,1).date(),nrw_holidays(2026))
        self.assertIn(datetime(2026,4,6).date(),nrw_holidays(2026))
        first=datetime(2025,12,24,16,tzinfo=TZ)
        final=business_add(first,120)
        self.assertEqual(final.date().isoformat(),'2025-12-29')
        self.assertEqual(final.hour,10)
        self.assertEqual(business_minutes(first,final),120)

    def test_example_anomalies_are_found(self):
        scenarios=self.metrics['qualityScenarios']
        self.assertEqual(len(scenarios),7)
        self.assertTrue(all(item['detected'] for item in scenarios))
        self.assertEqual(self.metrics['quality']['failed'],0)

    def test_bad_record_never_touches_reporting(self):
        x=copy.deepcopy(self.records[0]);x['service']=''
        result=quality_checks([x]);self.assertEqual(result['failed'],1)
        self.assertEqual(build(write=False)['ranges']['0']['opened'],len(self.records))

if __name__=='__main__':unittest.main()
