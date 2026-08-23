import re, json

raw = open('/tmp/share.html', encoding='utf-8', errors='ignore').read()

# 1) Пытаемся вытащить JSON-блок с данными диалога (server component payload)
# ChatGPT share-страницы: данные в RSC-потоке, строки экранированы в JSON-стиле.
# Собираем все "строки" длиннее 25 символов, декодируем escapes, оставляем русские.
strings = re.findall(r'\"((?:[^\"\\]|\\.){25,})\"', raw)
seen = set()
out = []
for s in strings:
    try:
        s2 = s.encode().decode('unicode_escape', errors='ignore')
    except Exception:
        s2 = s
    if any('\u0400' <= c <= '\u04FF' for c in s2) and len(s2) > 30 and s2 not in seen:
        seen.add(s2)
        out.append(s2)

with open('/tmp/share_text.txt', 'w', encoding='utf-8') as f:
    for i, s in enumerate(out):
        f.write(f'--- [{i}] ---\n{s}\n')

print('СТРОК:', len(out))
