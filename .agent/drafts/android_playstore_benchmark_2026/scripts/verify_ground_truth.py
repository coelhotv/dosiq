import json
import os
import re

BASE_DIR = "/Users/coelhotv/.gemini/antigravity/worktrees/dosiq/aso_ranking_benchmark_analysis/.agent/drafts/android_playstore_benchmark_2026"
p6_file = os.path.join(BASE_DIR, "PLAYSTORE_FASE_6_PLANO_DE_ACAO_TATICO_ASO_PLAYSTORE.md")

with open(p6_file) as f:
    p6_text = f.read()

print("="*80)
print("TEST 5: PHASE 6 METADATA & ALGORITHM CONSTRAINT VERIFICATION")
print("="*80)

# 1. Extract Proposed App Title
# Format often: **Título do App (Title - Max 30 chars):** `Dosiq: Lembrete de Remédios`
title_match = re.search(r'\*\*Título Proposto.*?\*\*:\s*`([^`]+)`', p6_text)
if not title_match:
    title_match = re.search(r'Título.*?:.*?`([^`]+)`', p6_text)

# Let's search for Title proposals in Phase 6
titles = re.findall(r'(?:Título|Title).*?:?\s*`([^`]+)`', p6_text)
print("Titles found in Phase 6:")
for t in titles[:5]:
    print(f"  - '{t}' (Length: {len(t)} chars) -> {'PASS (<=30)' if len(t) <= 30 else 'FAIL (>30)'}")

# 2. Extract Short Description
short_descs = re.findall(r'(?:Breve Descrição|Short Description).*?:?\s*`([^`]+)`', p6_text)
print("\nShort Descriptions found in Phase 6:")
for s in short_descs[:5]:
    print(f"  - '{s}' (Length: {len(s)} chars) -> {'PASS (<=80)' if len(s) <= 80 else 'FAIL (>80)'}")

# 3. Extract Full Description
# Let's find code blocks or sections with the Full Description
full_desc_match = re.search(r'```(?:text|markdown)?\n(Dosiq - Lembrete de Remédios.*?)```', p6_text, re.DOTALL)
if not full_desc_match:
    full_desc_match = re.search(r'### 3\.3\. Texto Integral da Descrição Completa.*?\n```(?:text|markdown)?\n(.*?)```', p6_text, re.DOTALL)

if full_desc_match:
    full_desc = full_desc_match.group(1).strip()
    full_len = len(full_desc)
    print(f"\nFull Description extracted (Length: {full_len} chars):")
    print(f"  - Constraint Check (<= 4000 chars): {'PASS' if full_len <= 4000 else 'FAIL'}")
    
    # Check for emojis in full description
    # Play Store metadata guidelines recommend no emojis in metadata text
    emojis = re.findall(r'[\U00010000-\U0010ffff]', full_desc)
    print(f"  - Prohibited Emojis in Full Description: {len(emojis)} emojis found ({set(emojis) if emojis else 'None'})")
    
    # Keyword density in full description
    words = re.findall(r'\b\w+\b', full_desc.lower())
    total_words = len(words)
    print(f"  - Total words in Full Description: {total_words}")
    
    kw_to_check = [
        "lembrete de remédios",
        "alarme de remédio",
        "remédio",
        "medicamento",
        "medicamentos",
        "sus",
        "farmácia popular",
        "receita médica",
        "grátis",
        "offline"
    ]
    
    for kw in kw_to_check:
        cnt = len(re.findall(re.escape(kw), full_desc.lower()))
        pct = (cnt / total_words) * 100 if total_words > 0 else 0
        print(f"    * '{kw}': {cnt} occurrences ({pct:.2f}% word density)")
else:
    print("\nCould not automatically locate Full Description code block.")

