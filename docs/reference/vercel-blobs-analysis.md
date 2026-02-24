# Vercel Blobs Analysis: Gemini Code Assist Integration

> **Analysis of current and potential usage of Vercel Blobs in the Gemini Code Assist integration**
> **Version:** 1.0.0 | **Date:** 2026-02-24
> **Author:** Architect Mode

---

## 📋 Executive Summary

Vercel Blobs are currently used as a **temporary transport mechanism** for JSON data between GitHub Actions jobs and Vercel serverless endpoints. The analysis reveals that blobs serve as an efficient intermediary but are **not a source of truth** — Supabase holds that role.

### Key Findings

| Finding | Impact |
|---------|--------|
| Blobs are ephemeral (7-day TTL) | No long-term storage in blobs |
| Single write, multiple reads | Efficient for job-to-job transfer |
| No duplication with Supabase | Clear separation of concerns |
| Private access enforced | Security maintained |

### Recommendation

**Maintain current blob usage** with minor optimizations. Consider expanding for caching Gemini responses and enabling historical review analytics.

---

## 🏗️ Current Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    GEMINI CODE ASSIST - DATA FLOW ARCHITECTURE                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        GITHUB ACTIONS WORKFLOW                           │   │
│  │                                                                          │   │
│  │   ┌──────────┐    ┌──────────┐    ┌───────────────┐                    │   │
│  │   │  detect  │───▶│  parse   │───▶│ upload-to-blob│                    │   │
│  │   │          │    │          │    │               │                    │   │
│  │   │ Extract  │    │ Parse    │    │ PUT JSON      │                    │   │
│  │   │ PR info  │    │ Comments │    │ to Blob       │                    │   │
│  │   └──────────┘    └──────────┘    └───────┬───────┘                    │   │
│  │                                            │                            │   │
│  │                                            │ blob_url                   │   │
│  │                                            ▼                            │   │
│  │   ┌──────────┐    ┌──────────────┐    ┌───────────────┐                │   │
│  │   │ persist  │◀───│create-issues │◀───│ blob metadata │                │   │
│  │   │          │    │              │    │  artifact     │                │   │
│  │   │ POST     │    │ POST         │    └───────────────┘                │   │
│  │   │ persist  │    │ create-issues│                                     │   │
│  │   └────┬─────┘    └──────┬───────┘                                     │   │
│  │        │                 │                                              │   │
│  └────────┼─────────────────┼──────────────────────────────────────────────┘   │
│           │                 │                                                  │
│           │ JWT Auth        │ JWT Auth                                        │
│           ▼                 ▼                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        VERCEL SERVERLESS FUNCTIONS                       │   │
│  │                                                                          │   │
│  │   ┌──────────────────┐         ┌──────────────────┐                     │   │
│  │   │   persist.js     │         │ create-issues.js │                     │   │
│  │   │                  │         │                  │                     │   │
│  │   │ 1. Verify JWT    │         │ 1. Verify JWT    │                     │   │
│  │   │ 2. GET from Blob │         │ 2. GET from Blob │                     │   │
│  │   │ 3. Calc SHA-256  │         │ 3. Query pending │                     │   │
│  │   │ 4. Dedupe        │         │ 4. Create issues │                     │   │
│  │   │ 5. INSERT        │         │ 5. UPDATE status │                     │   │
│  │   └────────┬─────────┘         └────────┬─────────┘                     │   │
│  │            │                            │                                │   │
│  │            │ Service Role Key           │ GITHUB_TOKEN                   │   │
│  │            ▼                            ▼                                │   │
│  └────────────┼────────────────────────────┼────────────────────────────────┘   │
│               │                            │                                    │
│               ▼                            ▼                                    │
│  ┌────────────────────┐         ┌────────────────────┐                         │
│  │      SUPABASE      │         │    GITHUB API      │                         │
│  │                    │         │                    │                         │
│  │ • gemini_reviews   │         │ • Issues           │                         │
│  │ • review_comments  │         │ • Comments         │                         │
│  │ • review_issues    │         │ • Labels           │                         │
│  │                    │         │                    │                         │
│  │ SOURCE OF TRUTH    │         │ EXTERNAL SYSTEM    │                         │
│  └────────────────────┘         └────────────────────┘                         │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        VERCEL BLOB STORAGE                               │   │
│  │                                                                          │   │
│  │   Path: reviews/pr-{number}/review-{timestamp}.json                     │   │
│  │   Access: Private (requires token)                                       │   │
│  │   TTL: 7 days (artifact retention)                                       │   │
│  │   Content: Parsed Gemini review JSON                                     │   │
│  │                                                                          │   │
│  │   ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │   │  {                                                              │   │   │
│  │   │    "pr_number": 144,                                            │   │   │
│  │   │    "commit_sha": "abc123...",                                   │   │   │
│  │   │    "summary": {                                                 │   │   │
│  │   │      "total_issues": 5,                                         │   │   │
│  │   │      "auto_fixable": 2,                                         │   │   │
│  │   │      "critical": 0,                                             │   │   │
│  │   │      "needs_agent": 1                                           │   │   │
│  │   │    },                                                           │   │   │
│  │   │    "issues": [...]                                              │   │   │
│  │   │  }                                                              │   │   │
│  │   └─────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                          │   │
│  │   ROLE: Temporary transport layer (NOT source of truth)                 │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Blob Usage Analysis

### What is Stored in Blobs

| Field | Type | Description |
|-------|------|-------------|
| `pr_number` | number | Pull Request number |
| `commit_sha` | string | SHA of the commit being reviewed |
| `summary.total_issues` | number | Total issues detected |
| `summary.auto_fixable` | number | Issues that can be auto-fixed |
| `summary.critical` | number | Critical priority issues |
| `summary.needs_agent` | number | Issues requiring agent intervention |
| `issues[]` | array | Array of parsed Gemini comments |
| `issues[].file_path` | string | File path of the issue |
| `issues[].line_start` | number | Start line number |
| `issues[].line_end` | number | End line number |
| `issues[].title` | string | Issue title |
| `issues[].description` | string | Detailed description |
| `issues[].suggestion` | string | Suggested fix |
| `issues[].priority` | enum | CRITICAL, HIGH, MEDIUM, LOW |
| `issues[].category` | string | Category of issue |

### Who Reads/Writes to Blobs

| Job/Endpoint | Action | Purpose |
|--------------|--------|---------|
| `upload-to-blob` (GitHub Actions) | **WRITE** | Upload parsed review JSON |
| `persist.js` (Vercel Endpoint) | **READ** | Download JSON for persistence |
| `create-issues.js` (Vercel Endpoint) | **READ** | Download JSON for issue creation |

### Blob Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BLOB LIFECYCLE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  T+0s    ┌──────────────┐                                                  │
│  ──────▶│   CREATION   │  upload-to-blob job creates blob                  │
│          │              │  Path: reviews/pr-{n}/review-{timestamp}.json     │
│          └──────┬───────┘                                                  │
│                 │                                                           │
│  T+30s   ┌──────▼───────┐                                                  │
│  ──────▶│  CONSUMPTION │  persist.js downloads blob                        │
│          │              │  create-issues.js downloads blob                  │
│          └──────┬───────┘                                                  │
│                 │                                                           │
│  T+5min  ┌──────▼───────┐                                                  │
│  ──────▶│   DORMANT    │  Blob no longer accessed                          │
│          │              │  Data persisted to Supabase                       │
│          └──────┬───────┘                                                  │
│                 │                                                           │
│  T+7days┌───────▼───────┐                                                  │
│  ──────▶│   EXPIRATION  │  Vercel automatically deletes blob               │
│          │              │  (artifact retention policy)                     │
│          └──────────────┘                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Storage Characteristics

| Characteristic | Value | Notes |
|----------------|-------|-------|
| **Access Mode** | Private | Requires `VERCEL_BLOB_TOKEN` |
| **TTL** | 7 days | Set by artifact retention |
| **Naming Pattern** | `reviews/pr-{n}/review-{ts}.json` | Unique per PR + timestamp |
| **Content-Type** | `application/json` | Auto-detected |
| **Size** | ~5-50 KB typical | Depends on number of issues |
| **Redundancy** | None | Single copy, ephemeral |

---

## 🔄 Co-existence with Supabase APIs

### Data Flow Comparison

| Aspect | Vercel Blobs | Supabase |
|--------|--------------|----------|
| **Purpose** | Temporary transport | Persistent storage |
| **Lifetime** | 7 days | Indefinite |
| **Query Capability** | None (key-value) | Full SQL |
| **Source of Truth** | ❌ No | ✅ Yes |
| **Deduplication** | ❌ No | ✅ Yes (SHA-256 hash) |
| **Analytics** | ❌ No | ✅ Yes |
| **Access Control** | Token-based | RLS + Service Role |

### Data Separation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DATA SEPARATION STRATEGY                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  VERCEL BLOB                          SUPABASE                              │
│  ────────────                         ─────────                             │
│  • Raw parsed JSON                    • Structured records                  │
│  • Ephemeral                          • Persistent                          │
│  • No relationships                   • Foreign keys                        │
│  • No indexing                        • Indexed queries                     │
│  • No constraints                     • CHECK constraints                   │
│                                                                             │
│  ┌─────────────────┐                 ┌─────────────────────────────────┐   │
│  │ review-144.json │ ──────────────▶ │ gemini_reviews                  │   │
│  │                 │   persist.js    │ ├── id (UUID)                   │   │
│  │ {               │                 │ ├── user_id (FK)                │   │
│  │   pr_number,    │                 │ ├── pr_number                   │   │
│  │   commit_sha,   │                 │ ├── commit_sha                  │   │
│  │   issues: [...] │                 │ ├── issue_hash (UNIQUE)         │   │
│  │ }               │                 │ ├── status (detected/reported...)│  │
│  └─────────────────┘                 │ ├── priority (critica/alta/...) │   │
│                                      │ ├── category (estilo/bug/...)   │   │
│                                      │ ├── title                       │   │
│                                      │ ├── description                 │   │
│                                      │ ├── suggestion                  │   │
│                                      │ ├── github_issue_number         │   │
│                                      │ ├── resolved_at                 │   │
│                                      │ └── created_at/updated_at       │   │
│                                      └─────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### No Duplication Policy

The architecture explicitly avoids data duplication:

1. **Blobs are transport-only** — Data is deleted after 7 days
2. **Supabase is the source of truth** — All queries go to Supabase
3. **Hash-based deduplication** — SHA-256 prevents duplicate records
4. **Single write path** — Only `persist.js` writes to Supabase

---

## 🚀 Opportunities Matrix

### Potential New Uses for Blobs

| Opportunity | Description | Benefit | Risk | Priority |
|------------|-------------|---------|------|----------|
| **O1: GitHub API Response Cache** | Store raw GitHub API responses (Gemini comments) | Re-parsing if parser changes | Storage cost | LOW |
| **O2: Historical Reviews** | Extend TTL for audit trail | Compliance, debugging | Storage cost | MEDIUM |
| **O3: Analytics Aggregation** | Weekly/monthly rollups | Performance metrics | Complexity | MEDIUM |
| **O4: Cross-PR Diff** | Compare reviews across PRs | Trend analysis | Implementation effort | LOW |

### Detailed Opportunity Analysis

#### O1: GitHub API Response Cache (LOW Priority)

> **Note:** The Gemini Code Assist integration happens automatically via GitHub App. We don't call Gemini API directly - we receive Gemini's comments via GitHub API (`listReviews`, `listComments`, `listReviewComments`).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GITHUB API RESPONSE CACHING                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CURRENT FLOW:                                                              │
│  GitHub API ──▶ gemini-raw-comments.json ──▶ Parse ──▶ Blob ──▶ Supabase  │
│                       (deleted after workflow)                              │
│                                                                             │
│  PROPOSED FLOW (OPTIONAL):                                                   │
│  GitHub API ──▶ raw/pr-{n}/gh-response-{ts}.json ──▶ Parse ──▶ Blob       │
│                        │                                                    │
│                        └──▶ Keep for 30 days (optional)                    │
│                                                                             │
│  BENEFITS:                                                                  │
│  • Re-parse if parser logic changes                                        │
│  • Debug parsing errors with original data                                 │
│                                                                             │
│  LIMITATION:                                                                │
│  • Limited value - parser is stable, re-parsing rarely needed              │
│  • The parsed review-{pr}.json already contains essential data             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### O2: Historical Reviews

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HISTORICAL REVIEWS ARCHIVE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CURRENT: Blob deleted after 7 days                                        │
│  PROPOSED: Archive to long-term storage after 7 days                       │
│                                                                             │
│  ARCHIVE STRATEGY:                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │
│  │ Vercel Blob  │───▶│ Archive Blob │───▶│ Supabase     │                 │
│  │ (7 days)     │    │ (90 days)    │    │ (indefinite) │                 │
│  └──────────────┘    └──────────────┘    └──────────────┘                 │
│                                                                             │
│  USE CASES:                                                                 │
│  • Compliance audits                                                        │
│  • Debugging historical issues                                              │
│  • Trend analysis over time                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### O3: Analytics Aggregation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ANALYTICS AGGREGATION                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  WEEKLY AGGREGATION JOB:                                                    │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │
│  │ Read Blobs   │───▶│ Aggregate    │───▶│ Store Report │                 │
│  │ (last 7 days)│    │ Metrics      │    │ in Blob      │                 │
│  └──────────────┘    └──────────────┘    └──────────────┘                 │
│                                                                             │
│  METRICS:                                                                   │
│  • Total issues by priority                                                 │
│  • Resolution rate                                                          │
│  • Average time to resolution                                               │
│  • Files with most issues                                                   │
│                                                                             │
│  OUTPUT:                                                                    │
│  reports/weekly/week-{n}.json                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Performance Benefits

| Scenario | Current Approach | With Blob Caching | Improvement |
|----------|------------------|-------------------|-------------|
| Re-process review | Re-fetch from GitHub API | Read from blob | ~2s vs ~10s |
| Historical query | Query Supabase | Read from blob | Similar |
| Bulk analytics | Query Supabase | Read aggregated blob | ~1s vs ~5s |

---

## 📋 Recommendations

### 1. Maintain Current Blob Usage ✅

The current architecture is sound. Blobs serve their purpose as a temporary transport layer without overstepping into Supabase's domain.

**No changes needed** for the core workflow.

### 2. Add Blob Cleanup Job (MEDIUM Priority)

Implement explicit cleanup to manage storage costs:

```yaml
# Add to workflow
cleanup-blobs:
  name: Cleanup Old Blobs
  runs-on: ubuntu-latest
  if: github.event_name == 'schedule' # Weekly
  steps:
    - name: Delete blobs older than 30 days
      uses: actions/github-script@v7
      with:
        script: |
          const { list, del } = require('@vercel/blob');
          const { blobs } = await list({ prefix: 'reviews/' });
          const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
          for (const blob of blobs) {
            if (new Date(blob.uploadedAt).getTime() < cutoff) {
              await del(blob.url);
            }
          }
```

### 3. Document Blob Schema (LOW Priority)

Create a formal schema document for blob contents:

```javascript
// src/schemas/geminiBlobSchema.js
import { z } from 'zod';

export const geminiBlobSchema = z.object({
  pr_number: z.number().int().positive(),
  commit_sha: z.string().min(1),
  summary: z.object({
    total_issues: z.number().int().nonnegative(),
    auto_fixable: z.number().int().nonnegative(),
    critical: z.number().int().nonnegative(),
    needs_agent: z.number().int().nonnegative(),
  }),
  issues: z.array(z.object({
    file_path: z.string(),
    line_start: z.number().int().optional(),
    line_end: z.number().int().optional(),
    title: z.string(),
    description: z.string().optional(),
    suggestion: z.string().optional(),
    priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
    category: z.string().optional(),
  })),
});
```

### 4. Consider Blob Analytics (FUTURE)

For Sprint 8 (Analytics Dashboard), consider storing aggregated metrics in blobs for fast loading:

```
reports/
├── daily/
│   └── 2026-02-24.json
├── weekly/
│   └── week-08.json
└── monthly/
    └── 2026-02.json
```

---

## 📊 Summary

### Current State

| Aspect | Status | Assessment |
|--------|--------|------------|
| **Architecture** | ✅ Sound | Clear separation of concerns |
| **Security** | ✅ Good | Private blobs, JWT auth |
| **Performance** | ✅ Good | Fast transport layer |
| **Cost** | ✅ Optimal | Minimal storage (7-day TTL) |
| **Maintainability** | ✅ Good | Simple, focused purpose |

### Proposed Changes

| Change | Effort | Impact | Recommendation |
|--------|--------|--------|----------------|
| GitHub API response caching | LOW | LOW | ⏳ Optional (limited value) |
| Cleanup job | LOW | MEDIUM | ✅ Implement |
| Schema documentation | LOW | LOW | ⏳ Optional |
| Analytics blobs | MEDIUM | MEDIUM | ⏳ Future (Sprint 8) |
| Extended TTL | LOW | LOW | ❌ Not needed |

### Final Verdict

**The current blob usage is well-designed and should be maintained.** The GitHub API response caching has limited value since the parser is stable and the parsed JSON already contains essential data. The primary opportunity for improvement is adding a cleanup job for cost management. All other changes are optional optimizations.

---

## 📁 Related Files

| File | Purpose |
|------|---------|
| [`.github/workflows/gemini-review.yml`](.github/workflows/gemini-review.yml) | Main workflow |
| [`.github/scripts/upload-to-vercel-blob.cjs`](.github/scripts/upload-to-vercel-blob.cjs) | Upload script |
| [`api/gemini-reviews/persist.js`](api/gemini-reviews/persist.js) | Persist endpoint |
| [`api/gemini-reviews/create-issues.js`](api/gemini-reviews/create-issues.js) | Create issues endpoint |
| [`plans/GEMINI_INTEGRATION_NEXT_PHASES.md`](plans/GEMINI_INTEGRATION_NEXT_PHASES.md) | Future phases |
| [`status-integracao-gemini.md`](status-integracao-gemini.md) | Integration status |

---

*Last updated: 2026-02-24*
*Author: Architect Mode*
