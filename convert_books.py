import csv
import json
import time
import random
import sys

def uid():
    return format(int(time.time() * 1000), 'x') + format(random.randint(0, 2**32), 'x')

csv_path = sys.argv[1] if len(sys.argv) > 1 else '/Users/ryley.johnson/Downloads/Book List - Sheet1.csv'

reading = []
with open(csv_path, newline='', encoding='utf-8-sig') as f:
    for row in csv.DictReader(f):
        title = row['Title'].strip()
        if not title:
            continue
        first = row['Author First Name'].strip()
        last  = row['Author Last Name'].strip()
        author = f'{first} {last}'.strip()
        status = 'done' if row['Check'].strip().upper() == 'TRUE' else 'todo'
        fn = row['F/NF'].strip().lower()
        genre = 'fiction' if 'fiction' in fn and 'non' not in fn else ('nonfiction' if fn else '')
        notes = row['List'].strip()
        reading.append({
            'id':        uid(),
            'createdAt': '2026-11-20T00:00:00.000Z',
            'status':    status,
            'title':     title,
            'author':    author,
            'genre':     genre,
            'notes':     notes,
        })

out = {
    'tasks':    [],
    'dining':   [],
    'upgrades': [],
    'people':   [],
    'reading':  reading,
    'media':    [],
}

out_path = csv_path.replace('.csv', '-import.json')
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(out, f, indent=2, ensure_ascii=False)

print(f'Wrote {len(reading)} books → {out_path}')
