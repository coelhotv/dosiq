---
id: AP-H20
title: Relying on iCloud to sync .git metadata before running gsync-native
summary: iCloud sync delay can cause localized git commands (like reset --hard) to not reflect in other worktrees if metadada isn't synced, causing unwanted pushes of pending commits.
applies_to:
  - process
  - sync
  - icloud
tags:
  - process
  - safe-sync
  - tooling
trigger_count: 1
last_triggered: 2026-04-15
expiry_date: 2027-04-15
status: active
related_rule: R-170
layer: warm
bootstrap_default: False
pack: process-hygiene
---

iCloud sync delay can cause localized git commands (like reset --hard) to not reflect in other worktrees if metadada isn't synced, causing unwanted pushes of pending commits.