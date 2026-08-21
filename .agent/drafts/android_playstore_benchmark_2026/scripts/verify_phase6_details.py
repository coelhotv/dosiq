import re

p6_file = "/Users/coelhotv/.gemini/antigravity/worktrees/dosiq/aso_ranking_benchmark_analysis/.agent/drafts/android_playstore_benchmark_2026/PLAYSTORE_FASE_6_PLANO_DE_ACAO_TATICO_ASO_PLAYSTORE.md"
with open(p6_file) as f:
    text = f.read()

# Extract Full Description text block
start_marker = "### 3.3. Descrição Completa"
end_marker = "### 3.4. Auditoria Matemática"

p6_sub = text[text.find(start_marker):text.find(end_marker)]
code_blocks = re.findall(r'```(?:text)?\n(.*?)```', p6_sub, re.DOTALL)
full_desc = code_blocks[0] if code_blocks else ""

print(f"Full Description Length: {len(full_desc)} chars (expected around 3647)")
words = [w for w in re.split(r'\s+', full_desc) if w]
total_words = len(words)
print(f"Total Words (whitespace split): {total_words}")

# Emoji check
emojis = re.findall(r'[\U00010000-\U0010ffff]', full_desc)
print(f"Emojis in Full Description: {len(emojis)}")

# Density checks
patterns = [
    ("lembrete de remédios", r'lembrete[s]? de remédio[s]?', 3),
    ("alarme de remédio", r'alarme[s]? de remédio[s]?', 3),
    ("farmácia popular", r'farmácia popular', 2),
    ("receita médica", r'receita[s]? médica[s]?', 2),
    ("remédio sus", r'remédio[s]? (?:do )?sus', 2), # or 3 if including 'do'
    ("controle de medicamentos", r'controle de medicamento[s]?', 3)
]

print("\nLexical Density Verification:")
for name, pat, words_per_term in patterns:
    matches = re.findall(pat, full_desc, re.IGNORECASE)
    count = len(matches)
    lexical_density = (count * words_per_term / 592) * 100 # using the 592 word basis
    print(f"  - '{name}': {count} occurrences | Calculated Lexical Density: {lexical_density:.2f}% | Matches: {matches}")

