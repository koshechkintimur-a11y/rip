import re

raw = open('/tmp/share.html', encoding='utf-8', errors='ignore').read()

# RSC-поток: русские строки могут быть как экранированные (\uXXXX) так и raw.
# Ищем оба варианта.

# 1) экранированные юникод-последовательности
uni = re.findall(r'\\u[0-9a-fA-F]{4}(?:\\u[0-9a-fA-F]{4})+', raw)
decoded = []
for u in uni:
    try:
        decoded.append(u.encode().decode('unicode_escape'))
    except Exception:
        pass

# 2) raw русские фрагменты
raw_ru = re.findall(r'[\u0400-\u04FF][\s\S]{3,}?(?=[\u0400-\u04FF]{0,10})', raw)

seen = set()
out = []
for s in decoded + raw_ru:
    s = s.strip()
    if len(s) > 25 and s not in seen:
        seen.add(s)
        out.append(s)

with open('/tmp/share_text.txt', 'w', encoding='utf-8') as f:
    for i, s in enumerate(out):
        f.write(f'--- [{i}] ---\n{s}\n')

print('СТРОК:', len(out))
