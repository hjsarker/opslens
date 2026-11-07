"""Rebuild all public artifacts deterministically from the seeded generator."""
from __future__ import annotations
import gzip
from pathlib import Path
from .generate_data import main as generate
from .validate_data import validate
from .build_analytics import build
from .export_csv import main as export_csv

ROOT=Path(__file__).resolve().parent.parent

def main():
    generate()
    report=validate()
    analytics=build('sqlite')
    export_csv()
    src=(ROOT/'data'/'incidents.json').read_bytes()
    with (ROOT/'data'/'incidents.json.gz').open('wb') as dest:
        with gzip.GzipFile(filename='',mode='wb',fileobj=dest,compresslevel=9,mtime=0) as zipped:
            zipped.write(src)
    assert analytics['ranges']['0']['opened']==analytics['meta']['sourceIncidents']
    print('Release ready:',report,'synthetic incidents only')

if __name__=='__main__':main()
