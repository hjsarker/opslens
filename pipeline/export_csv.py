"""Flatten the synthetic JSON into SQL-ready incident and event CSVs."""
import csv,json
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
fields=['id','opened_at','resolved_at','status','priority','category','service','team','summary','sla_policy','sla_target_min','sla_used_min','sla_percent','sla_status','reassignments','holds','resolution_minutes']

def main():
    entries=json.loads((ROOT/'data/incidents.json').read_text())['incidents']
    with (ROOT/'data/incidents_flat.csv').open('w',newline='',encoding='utf8') as fh:
        w=csv.DictWriter(fh,fieldnames=fields);w.writeheader()
        for i in entries:
            row={k:i.get({'opened_at':'openedAt','resolved_at':'resolvedAt','sla_policy':'slaPolicy','sla_target_min':'slaTargetMin','sla_used_min':'slaUsedMin','sla_percent':'slaPercent','sla_status':'slaStatus','resolution_minutes':'resolutionMinutes'}.get(k,k)) for k in fields}
            w.writerow(row)
    with (ROOT/'data/incident_events.csv').open('w',newline='',encoding='utf8') as fh:
        w=csv.DictWriter(fh,fieldnames=['incident_id','event_id','timestamp','event_type','description','team']);w.writeheader()
        for inc in entries:
            for e in inc['events']:
                w.writerow({'incident_id':inc['id'],'event_id':e['id'],'timestamp':e['at'],'event_type':e['type'],'description':e['text'],'team':e['team']})
    print('Exported',len(entries),'incident rows and event history')

if __name__=='__main__':main()
