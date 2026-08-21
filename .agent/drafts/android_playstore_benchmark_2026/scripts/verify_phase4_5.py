import json
import os
import re

DATA_DIR = "/Users/coelhotv/.gemini/antigravity/worktrees/dosiq/aso_ranking_benchmark_analysis/.agent/drafts/android_playstore_benchmark_2026/data"
BASE_DIR = "/Users/coelhotv/.gemini/antigravity/worktrees/dosiq/aso_ranking_benchmark_analysis/.agent/drafts/android_playstore_benchmark_2026"

with open(os.path.join(DATA_DIR, "playstore_competitors_raw.json")) as f:
    competitors_data = json.load(f)
competitors = competitors_data.get("competitors", {})

print("="*80)
print("TEST 6: CROSS-VERIFICATION OF PHASE 4 & PHASE 5 REPORTS")
print("="*80)

# Check Phase 4
p4_file = os.path.join(BASE_DIR, "PLAYSTORE_FASE_4_TEARDOWN_VISUAL_SCREENSHOTS_PLAYSTORE.md")
with open(p4_file) as f:
    p4_text = f.read()

# Check Phase 5
p5_file = os.path.join(BASE_DIR, "PLAYSTORE_FASE_5_DIAGNOSTICO_E_BENCHMARK_CONSOLIDADO.md")
with open(p5_file) as f:
    p5_text = f.read()

for report_name, text in [("Phase 4", p4_text), ("Phase 5", p5_text)]:
    print(f"\n--- Checking {report_name} Mentions of Competitors & Stats ---")
    # Find all mentions of package IDs in backticks `com.xxx`
    pkg_mentions = set(re.findall(r'`([a-z0-9_\.]+?\.[a-z0-9_\.]+)`', text))
    print(f"Found {len(pkg_mentions)} distinct package IDs in {report_name}:")
    for pkg in sorted(pkg_mentions):
        if pkg in competitors:
            c = competitors[pkg]
            print(f"  - [{pkg}] -> '{c.get('title')}' ({c.get('score')}★, {c.get('installs')}) [VERIFIED IN RAW JSON]")
        else:
            # Check if it is a code keyword like android.permission or similar
            if any(k in pkg for k in ['android', 'permission', 'intent', 'service', 'dosiq', 'github', 'pt_BR', 'schema']):
                print(f"  - [{pkg}] (System/Android identifier or app schema)")
            else:
                print(f"  - [{pkg}] [UNKNOWN/NOT IN COMPETITORS]")

