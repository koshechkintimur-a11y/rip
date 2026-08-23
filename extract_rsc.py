import re

raw = open('/tmp/share.html', encoding='utf-8', errors='ignore').read()

# 1) Тексты внутри тегов
texts = re.findall(r'>([^<]{40,})<', raw)
rus = [t for t in texts if any('\u0400' <= c <= '\u04FF' for c in t)]
print('ТЕКСТОВ В ТЕГАХ:', len(rus))
for t in rus[:5]:
    print('РУС:', t[:200].replace('\n', ' '))

# 2) RSC-строки: ищем "role":"..." и content
# В raw могут быть: \"role\":\"user\",\"content\":\"...\"
pat = re.compile(r'role\\?"\s*:\s*\\?"(user|assistant|system)\\?"\s*,\s*\\?"content\\?"\s*:\s*\\?"((?:[^"\\]|\\.)*?)\\?"', re.S)
out = []
for m in pat.finditer(raw):
    role = m.group(1)
    c = m.group(2)
    try:
        c = c.replace('\\\\', '\\').encode().decode('unicode_escape', errors='ignore')
    except Exception:
        pass
    out.append((role, c))

print('СООБЩЕНИЙ (строгий):', len(out))
for r, c in out[:4]:
    print(f'### {r}')
    print(c[:200])

# 3) Более слабый поиск: любые фрагменты, содержащие \u04 (русские) рядом с role
weak = re.findall(r'(user|assistant)\\?"\s*:\s*\{[^}]{20,}', raw)
print('WEAK:', len(weak))
