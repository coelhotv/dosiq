---
id: AP-H07
title: Mobile Expo dev: iCloud Cloud Documents path causes Watchman permission errors
summary: npx expo start fails with Watchman 'Operation not permitted' when repo in iCloud (~/Library/Mobile Documents/)
applies_to:
  - mobile
  - expo
  - macos
  - development
tags:
  - mobile
  - expo
  - icloud
  - watchman
  - macos
  - permissions
trigger_count: 1
last_triggered: 2026-04-12
expiry_date: 2027-04-12
status: active
related_rule: R-161
layer: warm
bootstrap_default: False
pack: adherence-reporting-mobile
---

# AP-H07 — Mobile Expo dev: iCloud Cloud Documents path causes Watchman permission errors

**Trigger count:** 1 (2026-04-12)  
**Related Rule:** R-161 (iCloud repo workarounds)  
**Wave:** H4 (Mobile Scaffold, Phase 4)  
**Pack:** adherence-reporting-mobile  

---

## Problem

When running `npx expo start` in a repository located in **iCloud Cloud Documents** (macOS path: `~/Library/Mobile Documents/com~apple~CloudDocs/git/...`), Expo fails with:

```
Error: std::__1::system_error: open: .../node_modules/expo: Operation not permitted
  watchmanResponse: {
    error: 'std::__1::system_error: open: ... Operation not permitted'
  }
```

**Why?**
- **iCloud sync constraints:** macOS restricts file system permissions in iCloud-synced directories
- **Watchman limitation:** Expo's Metro bundler uses Watchman to monitor file changes, but Watchman cannot access `node_modules/` in iCloud paths
- **No fallback flag:** Older Expo versions had `--no-watchman`, but current versions don't support it
- **Result:** Simulator validation blocked for agents (but possible for maintainers on local clones)

---

## Root Cause

**iCloud Cloud Documents path hierarchy:**
```
~/Library/Mobile Documents/
  └── com~apple~CloudDocs/
      └── git/
          └── meus-remedios/        ← Repository in iCloud
              └── apps/mobile/
                  └── node_modules/ ← Watchman can't access (permission denied)
```

**Watchman behavior:**
- Attempts to watch file changes for Metro bundler
- Fails on iCloud-synced paths (file system restrictions)
- No built-in fallback or disable option in current Expo

---

## Symptoms

```bash
$ npx expo start
Starting Metro Bundler
Logs for your project will appear below. Press Ctrl+C to exit.
metro-file-map: Watchman crawl failed. Retrying once with node crawler.
  Error: Watchman error: std::__1::system_error: open: /path/to/node_modules/expo: Operation not permitted

Error: std::__1::system_error: open: /path/to/node_modules: Operation not permitted
```

---

## Solution

### For Maintainers (With Apple/Google Accounts)

**Option 1: Clone repo locally (recommended)**
```bash
# Clone outside iCloud
git clone https://github.com/coelhotv/meus-remedios.git ~/local/meus-remedios
cd ~/local/meus-remedios/apps/mobile
npx expo start
# ✓ Works (Watchman has full access)
```

**Option 2: Create .watchmanconfig in repo root (partial)**
```bash
# In repo root: create empty .watchmanconfig
echo "{}" > .watchmanconfig

# Try again
npx expo start
# May still fail due to iCloud path restrictions (not guaranteed to work)
```

### For Agents (No Account Access)

**Gate:** Simulator validation is **maintainer-gated** per H4 acceptance criteria:
```
"Bloqueio humano: contas Expo/Apple/Google + EAS secrets pendentes. 
O agente pode implementar tudo menos EAS build e validacao em simuladores."
```

**Agent responsibility:**
- ✅ Implement scaffold (code complete)
- ✅ Ensure local web builds work (`npm run build`)
- ✅ Ensure tests pass (`npm run test:critical`)
- ❌ Simulator validation (requires Apple Developer account + local clone)

---

## Prevention

### For Future Agents Working on Mobile

1. **Know the constraint:** iCloud repos cannot run `npx expo start` reliably
2. **Workaround expectations:** Only `.watchmanconfig` is tested; might not fully resolve
3. **Gate identification:** If you're an agent without Apple/Google account access:
   - Don't spend time troubleshooting Watchman errors
   - This is a documented maintainer-gated validation step
   - Focus on code-level validation (tests, lint, build)

4. **For maintainers validating simulator:**
   - Clone repo locally (outside iCloud)
   - Run `npx expo start` from local clone
   - Test on iOS Simulator or Android Emulator

---

## Timeline (H4 Incident, 2026-04-12)

| Time | Event |
|------|-------|
| 19:35 | Wave H4 code complete + merged |
| 19:40 | Agent attempts `npx expo start` for smoke test validation |
| 19:40 | ❌ Watchman permission error (iCloud path constraint) |
| 19:40 | Identified: iCloud path is root cause, not code issue |
| 19:42 | Decision: Mark as maintainer-gated validation step |
| 19:43 | Documented: AP-H07 + R-161 (prevent future debugging waste) |

---

## Related Rules

- **R-161** (iCloud repo workarounds): local clones, .watchmanconfig, maintainer gates
- **R-090** (Vercel function budget): separate concern, web-side
- **R-091** (serverless file structure): separate concern, web-side

---

## Keywords for Future Scanning

When agent encounters:
- `Watchman crawl failed` in iCloud repo → **AP-H07**
- `Operation not permitted` on `node_modules/expo` → **AP-H07**
- `--no-watchman` flag doesn't exist → **AP-H07** (not supported in current Expo)
- Mobile simulator validation blocked → check **R-161** (likely iCloud path issue)

---

**Last Updated:** 2026-04-12  
**Status:** Active (1 trigger, documented as maintainer-gated)  
**Wave Introduced:** H4 (Mobile Scaffold)
