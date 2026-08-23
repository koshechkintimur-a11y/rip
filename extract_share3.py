import re, json

raw = open('/tmp/share.html', encoding='utf-8', errors='ignore').read()

# RSC-поток: текст в JSON-строках с \\n и \\uXXXX. Ищем все строки между кавычками,
# содержащие русские буквы, и декодируем двойные escapes.
# В HTML escapes выглядят как \\n (двойной слэш в raw) или \n.
# Пробуем: найти подстроки вида "текст..." с escapes, декодировать через json.loads с обёрткой.

# Стратегия: вырезаем все "..." фрагменты, где есть \\\\n или \\\\u
frags = re.findall(r'\"((?:[^\"\\\\]|\\\\.)*)\"', raw)
out = []
seen = set()
for f in frags:
    if '\\u' not in f and '\\\\' not in f:
        continue
    if not re.search(r'\\\\u04[0-9a-fA-F]{2}|\\\\n', f):
        continue
    try:
        # двойные escapes: строка в raw содержит \\n → превращаем в \n через json
        # сначала заменим \\\\ → \ (raw двойной слэш = один в данных)
        s = f.replace('\\\\', '\\')
        s = s.encode().decode('unicode_escape', errors='ignore')
    except Exception:
        continue
    if len(s) > 20 and s not in seen:
        seen.add(s)
        out.append(s)

with open('/tmp/share_full.txt', 'w', encoding='utf-8') as fh:
    for i, s in enumerate(out):
        fh.write(f'=== [{i}] ===\n{s}\n\n')

print('ФРАГМЕНТОВ:', len(out))
