import re, json

raw = open('/tmp/share.html', encoding='utf-8', errors='ignore').read()

# RSC-поток: сообщения диалога лежат как экранированные JSON-строки.
# Найдём все фрагменты с "content" и ролью, декодируем.
# В raw строки выглядят так: \"message\":{\"role\":\"user\",\"content\":\"...\"}

results = []
# 1) ищем все блоки вида: "role":"...","content":"..." (с escapes)
pattern = re.compile(r'"role":"(user|assistant|system)","content":"((?:[^"\\]|\\.)*)"')
for m in pattern.finditer(raw):
    role = m.group(1)
    content_raw = m.group(2)
    # декодируем двойные escapes
    try:
        content = content_raw.replace('\\\\', '\\').encode().decode('unicode_escape', errors='ignore')
    except Exception:
        content = content_raw
    results.append((role, content))

with open('/tmp/share_dialog.txt', 'w', encoding='utf-8') as f:
    for role, content in results:
        f.write(f'### {role}\n{content}\n\n')

print('СООБЩЕНИЙ:', len(results))
roles = {}
for r, _ in results:
    roles[r] = roles.get(r, 0) + 1
print(roles)
