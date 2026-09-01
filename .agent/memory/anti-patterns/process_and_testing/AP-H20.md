---
title: Relying on iCloud to sync .git metadata before running gsync-native
summary: >-
  iCloud sync delay can cause localized git commands (like reset --hard) to not reflect in other
  worktrees if metadada isn't synced, causing unwanted pushes of pending commits.
layer: warm
status: archived
applies_to:
  paths:
    - scripts/**
    - docs/**
  keywords:
    - relying
    - icloud
    - sync
    - git
    - metadata
    - before
    - running
    - gsync
legacy_tags:
  - process
  - sync
  - icloud
bootstrap_default: false
expiry_date: "2027-04-15"
id: AP-H20
last_triggered: "2026-04-15"
legacy_pack: process-hygiene
related_rule: R-170
resolution: >-
  gsync-native e worktree-bridge aposentados (projeto fora do iCloud). Sem iCloud sync delay, sem
  sync de .git entre worktrees.
resolved_on: "2026-05-24"
tags:
  - process
  - safe-sync
  - tooling
trigger_count: 1
---

> **OBSOLETO (2026-05-24):** `gsync-native.sh` e o worktree-bridge foram aposentados quando o projeto saiu do iCloud (`~/git/dosiq/`). Não há mais delay de sync do iCloud nem sync de metadados `.git` entre worktrees. Mantido só como histórico.

iCloud sync delay can cause localized git commands (like reset --hard) to not reflect in other worktrees if metadada isn't synced, causing unwanted pushes of pending commits.