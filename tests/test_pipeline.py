import json
import unittest
from datetime import datetime,timedelta,timezone
from zoneinfo import ZoneInfo
from pipeline.generate_data import business_minutes,business_add,elapsed_sla,due_time,TZ
from pipeline.validate_data import validate

class CalendarTests(unittest.TestCase):
    def test_business_hours_ignore_weekend(self):
        fri=datetime(2026,11,6,16,0,tzinfo=TZ)
        mon=datetime(2026,11,9,10,0,tzinfo=TZ)
        self.assertAlmostEqual(business_minutes(fri,mon),120)

    def test_business_clock_crosses_weekend(self):
        fri=datetime(2026,11,6,16,0,tzinfo=TZ)
        out=business_add(fri,120)
        self.assertEqual((out.weekday(),out.hour),(0,10))

    def test_overnight_not_counted(self):
        a=datetime(2026,11,5,18,0,tzinfo=TZ)
        b=datetime(2026,11,6,8,0,tzinfo=TZ)
        self.assertEqual(business_minutes(a,b),0)

    def test_calendar_pause(self):
        a=datetime(2026,11,5,10,0,tzinfo=TZ)
        b=a+timedelta(hours=5)
        pause=(a+timedelta(hours=1),a+timedelta(hours=3))
        self.assertAlmostEqual(elapsed_sla(a,b,'24/7',[pause]),180)

    def test_business_pause(self):
        a=datetime(2026,11,6,16,0,tzinfo=TZ)
        b=datetime(2026,11,9,12,0,tzinfo=TZ)
        pause=(datetime(2026,11,9,9,0,tzinfo=TZ),datetime(2026,11,9,10,0,tzinfo=TZ))
        self.assertAlmostEqual(elapsed_sla(a,b,'business',[pause]),180)

    def test_due_with_hold_extension(self):
        a=datetime(2026,11,6,9,0,tzinfo=TZ)
        pause=(a+timedelta(hours=1),a+timedelta(hours=2))
        due=due_time(a,'P1',[pause])
        self.assertEqual(due.hour,14)

    def test_dst_transition(self):
        a=datetime(2026,3,27,16,0,tzinfo=TZ)
        b=business_add(a,120)
        self.assertEqual((b.date().isoformat(),b.hour),('2026-03-30',10))

    def test_dataset_integrity(self):
        stats=validate()
        self.assertGreater(stats['resolved'],2000)
        self.assertGreater(stats['open'],50)

if __name__=='__main__':unittest.main()
