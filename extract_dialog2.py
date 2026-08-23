import re

raw = open('/tmp/share.html', encoding='utf-8', errors='ignore').read()

# Текст аудита лежит в одной гигантской JSON-строке с \\n (двойной escape)
# ищем все фрагменты в кавычках, содержащие последовательность \\\\n И русские буквы
frags = re.findall(r'\"((?:[^\"\\\\]|\\\\.){50,})\"', raw)
out = []
for f in frags:
    if '\\\\n' not in f:
        continue
    try:
        s = f.replace('\\\\', '\\').encode().decode('unicode_escape', errors='ignore')
    except Exception:
        continue
    if any('\u0400' <= c <= '\u04FF' for c in s) and len(s) > 100:
        out.append(s)

with open('/tmp/dialog_extracted.txt', 'w', encoding='utf-8') as fh:
    for i, s in enumerate(out):
        fh.write(f'\n\n@@@@@@@@@@ БЛОК {i} @@@@@@@@@@\n\n')
        fh.write(s)

print('БЛОКОВ:', len(out))
for i, s in enumerate(out):
    print(f'--- {i}: {len(s)} символов, первые 120: {s[:120]!r}')
