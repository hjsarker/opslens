"""Validate published synthetic incident data and reconcile KPI definitions."""
from __future__ import annotations
import json
from collections import Counter
from datetime import datetime
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent

def validate(path=ROOT/'data'/'incidents.json'):
    data=json.loads(Path(path).read_text(encoding='utf-8'))
    assert data['meta']['synthetic'] is True
    assert len(data['incidents'])==data['meta']['totalIncidents']
    as_of=datetime.fromisoformat(data['meta']['asOf'].replace('Z','+00:00'))
    seen=set()
    states={'New','In Progress','On Hold','Resolved','Closed'}
    stats=Counter()
    for inc in data['incidents']:
        assert inc['id'] not in seen, inc['id'];seen.add(inc['id'])
        assert inc['priority'] in data['meta']['slaRules']
        assert inc['status'] in states
        assert inc['category'] and inc['service'] and inc['team'] and inc['summary']
        opened=datetime.fromisoformat(inc['openedAt'].replace('Z','+00:00'))
        assert opened<=as_of
        resolved=datetime.fromisoformat(inc['resolvedAt'].replace('Z','+00:00')) if inc['resolvedAt'] else None
        if resolved:assert opened<=resolved<=as_of
        else:assert inc['status'] not in {'Closed','Resolved'}
        assert inc['events'] and inc['events'][0]['type']=='created'
        prev=opened
        for event in inc['events']:
            t=datetime.fromisoformat(event['at'].replace('Z','+00:00'))
            assert opened<=t<=as_of and t>=prev,(inc['id'],event)
            prev=t
        assert inc['reassignments']==sum(e['type']=='reassigned' for e in inc['events'])
        assert 0<=inc['slaPercent']
        assert inc['slaTargetMin'] in {240,480,960,2400}
        assert inc['slaStatus'] in {'On track','At risk','Critical','Breached','Met'}
        if inc['slaStatus']=='Breached':assert inc['slaPercent']>100
        if inc['slaStatus']=='Met':assert resolved and inc['slaPercent']<=100
        if not resolved:stats['open']+=1
        stats['resolved']+=bool(resolved)
    return dict(stats)

if __name__=='__main__':print('Validation passed:',validate())
