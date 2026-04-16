---
id: AP-H22
title: Multiple React instances in monorepo mobile bundle
summary: "TypeError: Cannot read property 'useState' of null" crash caused by Metro bundling multiple versions of React.
applies_to:
  - react
  - monorepo
  - metro
  - mobile
tags:
  - crash
  - react-hooks
  - monorepo
  - dependency-duplication
trigger_count: 1
last_triggered: 2026-04-15
expiry_date: 2027-04-15
status: active
related_rule: R-174
layer: warm
bootstrap_default: False
pack: react-hooks
---

# AP-H22 — Multiple React instances in monorepo mobile bundle

## Problem
The mobile app crashes immediately on startup, showing a white screen or closing. 
In the **Logcat**, the following error appears:

```
E/ReactNativeJS: TypeError: Cannot read property 'useState' of null
E/ReactNativeJS: This error is located at:
E/ReactNativeJS:     at Navigation (...)
```

## Root Cause
In a Monorepo, the same package (e.g., `react`) may be installed in different versions or locations (root vs app). Metro, when following imports from shared packages or the root, might bundle two separate copies of React. 
**React Hooks (useState, useEffect) fail when multiple instances of React are present.**

## Symptoms
- App opens and crashes immediately.
- `adb logcat *:E` shows `useState of null`.
- Build finishes successfully, but runtime fails.

## Solution
1. **Synchronize versions**: Ensure all `package.json` in the monorepo use the same exact version of `react` and `react-native`.
2. **Apply Proxy Aliases**: Configure `metro.config.js` with `extraNodeModules` using a Proxy to force all resolutions of `react` to point to the local app's `node_modules` (see **R-174**).

## Prevention
- Always pin React versions to exact values (R-160).
- Run `npm list react` in the app directory to check for duplicates.
- Use the standardized `metro.config.js` template with Proxy support.

**Last Updated:** 2026-04-15  
**Status:** Active  
**Wave Introduced:** H5 (Hybrid Execution)
