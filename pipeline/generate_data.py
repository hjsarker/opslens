"""Reproducible synthetic ITSM dataset. No real employer information.

Run: python -m pipeline.generate_data
All timestamps are ISO UTC, displayed in Europe/Berlin by the frontend.
SLAs: P1 4 calendar hours, P2 8 calendar hours, P3 16 business hours,
P4 40 business hours; weekdays 09:00-17:00 Europe/Berlin; configured holidays excluded.
On-hold intervals pause SLA consumption; resolution uses the final resolution.
"""
from __future__ import annotations

import json
import math
import random
from collections import Counter, defaultdict
from datetime import datetime, timedelta, time, timezone, date
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
TZ = ZoneInfo('Europe/Berlin')
CALENDAR_CONFIG = json.loads((ROOT / 'config' / 'calendar.json').read_text())

def easter_sunday(year: int) -> date:
    """Gregorian computus (Meeus/Jones/Butcher)."""
    a=year%19; b=year//100; c=year%100; d=b//4; e=b%4; f=(b+8)//25
    g=(b-f+1)//3; h=(19*a+b-d-g+15)%30; i=c//4; k=c%4
    l=(32+2*e+2*i-h-k)%7; m=(a+11*h+22*l)//451
    month=(h+l-7*m+114)//31; day=((h+l-7*m+114)%31)+1
    return date(year,month,day)

def nrw_holidays(year: int) -> set[date]:
    easter=easter_sunday(year)
    fixed=[(1,1),(5,1),(10,3),(11,1),(12,25),(12,26)]
    movable=[-2,1,39,50,60]  # Good Friday, Easter Monday, Ascension, Pentecost Mon, Corpus Christi
    return {date(year,month,day) for month,day in fixed} | {easter+timedelta(days=n) for n in movable}

def holidays_for(year: int) -> set[date]:
    dates=nrw_holidays(year) if CALENDAR_CONFIG['excludeNrwPublicHolidays'] else set()
    dates |= {date.fromisoformat(day) for day in CALENDAR_CONFIG['extraClosures']}
    return dates

def business_day(d:date)->bool:
    return d.weekday() in CALENDAR_CONFIG['workingDays'] and d not in holidays_for(d.year)

AS_OF = datetime(2026, 11, 7, 12, 0, tzinfo=TZ)
AS_OF_UTC = AS_OF.astimezone(timezone.utc)
START = datetime(2025, 11, 1, 7, tzinfo=TZ)
RNG = random.Random(20261107)
N = 3200
CATEGORIES = {
  'Microsoft 365': {'team': 'Digital Workplace', 'service': 'Microsoft 365', 'issues': ['Outlook sign-in error', 'Teams meeting audio problem', 'SharePoint sync failure', 'OneDrive access denied', 'Mailbox delivery delay']},
  'VPN & Access': {'team': 'Network Operations', 'service': 'Corporate VPN', 'issues': ['VPN connection drops', 'Remote access authentication error', 'MFA approval fails', 'VPN gateway unavailable', 'Unable to connect from home']},
  'Business Applications': {'team': 'Application Support', 'service': 'ERP Portal', 'issues': ['ERP portal timeout', 'Application session error', 'Report export not working', 'User permissions missing', 'Unexpected API response']},
  'Network': {'team': 'Network Operations', 'service': 'Office Network', 'issues': ['Wi-Fi disconnected', 'DNS resolution failure', 'High network latency', 'Meeting room network outage', 'Ethernet port not working']},
  'Endpoints': {'team': 'Service Desk L1', 'service': 'Workplace Devices', 'issues': ['Laptop startup failure', 'Printer not responding', 'Windows update error', 'Docking station problem', 'Peripheral not detected']},
  'Identity': {'team': 'Identity & Access', 'service': 'Identity Services', 'issues': ['Account locked after sign-in', 'Password reset failure', 'Group membership missing', 'SSO token expired', 'Account provisioning delay']},
  'Data & Reporting': {'team': 'BI Platform Support', 'service': 'Analytics Platform', 'issues': ['Power BI refresh failed', 'Dashboard figures inconsistent', 'Databricks job failed', 'Dataset permission denied', 'Reporting pipeline delayed']},
  'Infrastructure': {'team': 'Infrastructure L2', 'service': 'Compute & Storage', 'issues': ['Server health alert', 'Disk threshold exceeded', 'Scheduled job failed', 'Service restart required', 'Backup verification error']},
}
GROUPS = ['Service Desk L1', 'Digital Workplace', 'Application Support', 'Network Operations', 'Identity & Access', 'BI Platform Support', 'Infrastructure L2']
PRIORITIES = {'P1': {'minutes': 240, 'schedule': '24/7'}, 'P2': {'minutes': 480, 'schedule': '24/7'}, 'P3': {'minutes': 960, 'schedule': 'business'}, 'P4': {'minutes': 2400, 'schedule': 'business'}}
PRIORITY_WEIGHTS = [0.025,0.15,0.565,0.26]

def iso(t: datetime): return t.astimezone(timezone.utc).isoformat(timespec='seconds').replace('+00:00','Z')

def in_business(t: datetime) -> bool:
    local=t.astimezone(TZ)
    return business_day(local.date()) and 9 <= local.hour < 17

def next_business(t: datetime) -> datetime:
    local=t.astimezone(TZ)
    for _ in range(15):
        if not business_day(local.date()):
            local=datetime.combine(local.date()+timedelta(days=1),time(9),TZ)
        elif local.hour >=17:
            local=datetime.combine(local.date()+timedelta(days=1),time(9),TZ)
        elif local.hour<9:
            local=datetime.combine(local.date(),time(9),TZ)
        else:
            return local
    raise RuntimeError('calendar search exceeded')

def business_add(start: datetime, minutes: float) -> datetime:
    t=next_business(start)
    remaining=minutes
    while remaining>0:
        close=t.replace(hour=17,minute=0,second=0,microsecond=0)
        budget=(close.astimezone(timezone.utc)-t.astimezone(timezone.utc)).total_seconds()/60
        if remaining <= budget:return (t.astimezone(timezone.utc)+timedelta(minutes=remaining)).astimezone(TZ)
        remaining -= budget
        t=next_business(close + timedelta(seconds=1))
    return t

def business_minutes(start:datetime,end:datetime) -> float:
    if end<=start:return 0.0
    cursor=start.astimezone(TZ)
    total=0.0
    while cursor<end:
        cursor=next_business(cursor)
        if cursor>=end:break
        close=cursor.replace(hour=17,minute=0,second=0,microsecond=0)
        until=min(end,close)
        total+=(until.astimezone(timezone.utc)-cursor.astimezone(timezone.utc)).total_seconds()/60
        cursor=close+timedelta(seconds=1)
    return total

def elapsed_sla(start,end,policy,pauses):
    def duration(a,b):
        if policy=='business':return business_minutes(a,b)
        return max(0,(b-a).total_seconds()/60)
    used=duration(start,end)
    for a,b in pauses:
        left=max(a,start)
        right=min(b,end)
        if left<right:used-=duration(left,right)
    return max(0,used)

def due_time(start, priority, pauses):
    rule=PRIORITIES[priority]
    target=rule['minutes']
    due=business_add(start,target) if rule['schedule']=='business' else start+timedelta(minutes=target)
    # Shift deadline through hold intervals that overlap the running SLA clock.
    for _ in range(5):
        consume=elapsed_sla(start,due,rule['schedule'],pauses)
        deficit=target-consume
        if deficit<=.01:break
        due=business_add(due,deficit) if rule['schedule']=='business' else due+timedelta(minutes=deficit)
    return due

def make_incident(i):
    rid=f'INC{i:06d}'
    # Higher recent volume, but a true historical spread.
    offset=RNG.betavariate(1.30,0.96)
    opened=START+(AS_OF-START)*offset
    opened=opened.replace(microsecond=0)
    cat=RNG.choices(list(CATEGORIES),weights=[21,18,14,12,11,8,10,6])[0]
    info=CATEGORIES[cat]
    issue=RNG.choice(info['issues'])
    priority=RNG.choices(list(PRIORITIES),weights=PRIORITY_WEIGHTS)[0]
    policy=PRIORITIES[priority]
    team=info['team']
    # Synthetic troubleshooting duration: usually moderate, with long-tail bottlenecks.
    base={'P1':2.8,'P2':6.3,'P3':16.0,'P4':28.0}[priority]
    work_minutes=max(12,math.exp(RNG.gauss(math.log(base),0.72))*60)
    if RNG.random()<.12:work_minutes*=2.0
    if issue in ('VPN connection drops','Power BI refresh failed','Report export not working') and opened.month in [4,9]:work_minutes*=1.34
    # Use actual hours for progression; later SLA calculation respects schedule.
    finish=opened+timedelta(minutes=work_minutes)
    # Open incidents concentrate near the snapshot, with a small older backlog.
    is_open=(finish>AS_OF
             or (opened>=AS_OF-timedelta(days=7) and RNG.random()<.45)
             or (opened>=AS_OF-timedelta(days=30) and RNG.random()<.04))
    if RNG.random()<.003:is_open=True
    if finish>=AS_OF:is_open=True
    status='Resolved'
    if is_open:status=RNG.choices(['In Progress','On Hold','New'],weights=[71,23,6])[0]
    else:status='Closed' if RNG.random()<.63 else 'Resolved'
    resolved=None if is_open else finish
    end=AS_OF if is_open else resolved
    # Never allow future events to leak into the published snapshot.
    event_count=0
    events=[]
    def event(t,kind,text,group=None):
        nonlocal event_count
        event_count+=1
        events.append({'id':f'{rid}-E{event_count:02d}','at':iso(min(t,AS_OF)),'type':kind,'text':text,'team':group or team})
    event(opened,'created','Incident reported and logged','Service Desk L1')
    first_assign=min(opened+timedelta(minutes=RNG.randint(4,46)),end)
    current_team='Service Desk L1'
    event(first_assign,'assigned','Assigned to Service Desk L1',current_team)
    if team!='Service Desk L1' and first_assign<end:
        transfer=min(first_assign+timedelta(minutes=RNG.randint(15,110)),end)
        if transfer<end:
            event(transfer,'reassigned',f'Escalated to {team}',team)
            current_team=team
    duration=(end-opened).total_seconds()
    pauses=[]
    if duration>7200 and RNG.random()<.21:
        pause_start=opened+timedelta(seconds=duration*.36)
        pause_end=min(opened+timedelta(seconds=duration*.54),end)
        if pause_start<pause_end:
            pauses.append((pause_start,pause_end))
            event(pause_start,'on_hold','Waiting for information or an external dependency',current_team)
            if pause_end<end:event(pause_end,'resumed','Investigation resumed',current_team)
    if duration>5200 and RNG.random()<.20:
        swap=opened+timedelta(seconds=duration*.67)
        if swap<end:
            new_team=RNG.choice([t for t in GROUPS if t!=current_team]);current_team=new_team
            event(swap,'reassigned',f'Escalated to {new_team} for additional investigation',new_team)
    if resolved:
        event(resolved,'resolved','Service restored; incident resolution recorded',current_team)
        if status=='Closed':event(resolved,'closed','Ticket closed following resolution',current_team)
    elif status=='On Hold' and not any(e['type']=='on_hold' for e in events):event(end,'on_hold','Incident awaiting additional information',current_team)
    events.sort(key=lambda e:(e['at'],e['id']))
    used=elapsed_sla(opened,end,policy['schedule'],pauses)
    deadline=due_time(opened,priority,pauses)
    consumption=round(used/policy['minutes']*100,1)
    breach=consumption>100.0
    sla='Breached' if breach else ('Met' if resolved else 'Critical' if consumption>=90 else 'At risk' if consumption>=75 else 'On track')
    # Some old open tickets might have resolved timestamp future incorrectly; none do.
    return {
      'id':rid,'openedAt':iso(opened),'resolvedAt':iso(resolved) if resolved else None,
      'status':status,'priority':priority,'category':cat,'service':info['service'],
      'summary':issue,'team':current_team,'slaPolicy':f'{priority} {policy["schedule"]}',
      'slaTargetMin':policy['minutes'],'slaUsedMin':round(used),
      'slaPercent':consumption,'slaStatus':sla,'slaDueAt':iso(deadline),
      'reassignments':sum(e['type']=='reassigned' for e in events),
      'holds':len(pauses),'events':events,
      'resolutionMinutes':round((resolved-opened).total_seconds()/60) if resolved else None
    }

def main():
    RNG.seed(20261107)  # Reproducible even when called repeatedly in one process.
    records=[make_incident(i) for i in range(400001,400001+N)]
    records.sort(key=lambda d:d['openedAt'],reverse=True)
    counts=Counter(r['status'] for r in records)
    out={
      'meta':{
        'name':'OpsLens','version':'2.0.0','asOf':iso(AS_OF),'timezone':'Europe/Berlin',
        'seed':20261107,'synthetic':True,'totalIncidents':len(records),
        'methodology':'Synthetic demo data, not a real employer ServiceNow/Jira export.',
        'periodStart':iso(START),'slaBusinessHours':'Monday-Friday, 09:00-17:00 Europe/Berlin; NRW statutory holidays and configured closures excluded',
        'slaPaused':'On-hold intervals subtract from SLA consumption','holidayRegion':CALENDAR_CONFIG['region'],
        'slaRules':PRIORITIES
      },
      'incidents':records
    }
    ROOT.joinpath('data').mkdir(parents=True,exist_ok=True)
    dest=ROOT/'data'/'incidents.json'
    dest.write_text(json.dumps(out,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    print('Wrote',len(records),'synthetic incidents to',dest,'bytes',dest.stat().st_size,'statuses',dict(counts))

if __name__=='__main__':main()
