---
id: AP-H18
anti_pattern: Linting entire monorepo packages from root ('npx eslint apps/mobile/...') often fails due to global ignore patterns.
solution: Lint specific feature directories or files directly, or check package-specific lint scripts.
pack: process-hygiene
---

