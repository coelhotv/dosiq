---
title: "Changelog and Release Logging"
description: "Regras e governança para versionamento de plataformas (SemVer mobile v0.x, web v1.x) e escrita do log de release no Dosiq."
version: "1.1.0"
status: active
category: standard
audience:
  - dev
  - agent
tags:
  - release
  - changelog
  - versioning
created_at: "2026-05-28"
updated_at: "2026-07-15"
---

# Changelog and Release Logging

This document defines the Dosiq release logging process. Rules are written in English for agents. Changelog and store-note text must be written in Portuguese.

## Two Files, Two Audiences

Keep the **internal change log** and the **external store releases** in separate files:

| File | Audience | Content |
|------|----------|---------|
| `CHANGELOG.md` | Internal (team / agent) | Technical log of changes, per PR/version. SemVer bumps, migrations, review notes. |
| `docs/standards/RELEASES.md` | External (end user) | **Source of truth for store notes** — the text published on Apple App Store / Google Play, per published mobile minor. |

Rules for `RELEASES.md`:
- Portuguese, warm tone, no technical jargon or internal detail.
- **No emojis** — neither store accepts them (Apple and Google strip/reject).
- Apple allows long text (~4000 chars); **Google Play has a hard 500-char limit** — keep the short variant under it.
- One store release = one mobile **minor** bump (0.x convention below). Intermediate patches fold into the next store note as "estabilidade e correções".
- When a mobile minor ships to stores, add its block to `RELEASES.md` **and** keep the technical detail in `CHANGELOG.md`.

## Canonical Version Sources

| Platform | Source of truth | Notes |
|----------|-----------------|-------|
| Web/PWA | `apps/web/package.json` `version` | Build env `VITE_APP_VERSION` must reflect this version when used. |
| Mobile | `apps/mobile/app.config.js` `APP_VERSION` | Android `versionCode` and iOS `buildNumber` are derived from `APP_VERSION` by R-182. |
| Root monorepo | `package.json` `version` | Metadata only. Do not treat as product release version unless a future ADR changes this. |

## Mobile 0.x Versioning Convention (PO decision 2026-06-12)

While the mobile app is pre-1.0, the SemVer minor acts as the de-facto major:

- **Minor (0.X.0)** = epic / store-worthy release: a delivery with a store note that end
  users perceive as a new version. One epic = one minor line (e.g. spec 012 = `0.16.x`).
- **Patch (0.16.X)** = intermediate epic phases, sub-features and fixes
  (012 Fase A = 0.16.0, Fase B = 0.16.1, Fase C = 0.16.2, ...).
- Rationale: burning a minor per sub-phase inflates the version line without matching
  user-perceived progress. `buildNumber` derivation (R-182: major*10000+minor*100+patch)
  supports up to 99 patches per minor.
- Web is post-1.0 and keeps canonical SemVer (minor per feature). When mobile reaches
  1.0.0 this convention expires and the web rule applies.

## SQP Release Checklist

Every code-changing PR must follow R-221 SQP:

1. Load DEVFLOW and R-221 before writing code.
2. Identify affected platform(s): Web/PWA, Mobile, Shared/Core, Backend/Infra.
3. Classify SemVer impact: `patch`, `minor`, `major`, or `no-user-impact`.
4. Update affected version source(s) unless impact is `no-user-impact`.
5. Add a Portuguese entry under `CHANGELOG.md` `[Unreleased]`.
6. For mobile changes, ensure App Store / Play Store notes can be derived from the changelog entry.
7. Fill PR version section from actual files.
8. Record release impact in DEVFLOW C5 journal/events.

## SemVer Classification

| Impact | Use when |
|--------|----------|
| `patch` | Bug fix, safe technical correction, copy fix, internal behavior correction. |
| `minor` | New user-facing feature, meaningful UX addition, additive API/data behavior, store-visible improvement. |
| `major` | Breaking migration, incompatible user behavior, destructive data model transition, required migration. |
| `no-user-impact` | Documentation, tests, tooling, or process-only work that does not change product behavior. |

Shared/Core changes must bump every product platform that consumes the changed behavior.

## CHANGELOG.md Template

Use this structure under `[Unreleased]`:

```markdown
## [Unreleased]

### Web/PWA
- **Changed** (`minor`, PR #TBD): Descrição em português do impacto para usuários web.

### Mobile
- **Fixed** (`patch`, PR #TBD): Descrição em português do impacto para usuários mobile.

### Shared/Core
- **Changed** (`minor`, PR #TBD): Descrição em português da mudança compartilhada.

### Backend/Infra
- **Process** (`no-user-impact`, PR #TBD): Descrição em português da mudança interna/processual.
```

Allowed categories:
- `Added`
- `Changed`
- `Fixed`
- `Security`
- `Deprecated`
- `Removed`
- `Process`

## Store Notes

Store notes live in **`docs/standards/RELEASES.md`** (the external source of truth), derived from
mobile changelog entries. Write an Apple block (long) and a Google Play block (≤500 chars), both
emoji-free. Base skeleton:

```markdown
Novidades da versão X.Y.Z:
- Texto curto e claro em português sobre melhoria visível.
- Correção importante quando usuário final percebe impacto.
- Evite detalhes internos sem impacto para usuário.
```

If a mobile release is internal-only, keep the `CHANGELOG.md` entry, mark it `no-user-impact` with a
short Portuguese justification, and do **not** add a `RELEASES.md` block.

## PR Version Section

Fill `docs/standards/PULL_REQUEST_TEMPLATE.md` with actual values:

```markdown
**Tipo:** Patch / Minor / Major / No user impact
**Plataformas afetadas:** Web/PWA / Mobile / Shared/Core / Backend/Infra
**Versão anterior:** web x.y.z / mobile a.b.c
**Versão sugerida:** web x.y.z / mobile a.b.c
**Changelog:** `CHANGELOG.md` [Unreleased] atualizado
```
