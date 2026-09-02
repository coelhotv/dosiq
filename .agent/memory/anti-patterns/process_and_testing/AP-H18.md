---
title: AP-H18
summary: AP-H18
layer: warm
status: active
applies_to:
  paths:
    - scripts/**
    - docs/**
  keywords:
    - h18
anti_pattern: >-
  Linting entire monorepo packages from root ('npx eslint apps/mobile/...') often fails due to
  global ignore patterns.
id: AP-H18
legacy_pack: process-hygiene
solution: Lint specific feature directories or files directly, or check package-specific lint scripts.
---

