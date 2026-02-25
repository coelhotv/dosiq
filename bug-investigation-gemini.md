# Bug Investigation: Gemini Priority Mapping

## Problem Description
A Gemini review with `[HIGH]` severity classification resulted in an automated GitHub issue with the prefix `[Medium]` instead of `[High]`.

## Findings

### 1. Gemini Review Analysis
- PR: #204
- Gemini Comment: `![high](https://www.gstatic.com/codereviewagent/high-priority.svg)`
- The parser (`.github/scripts/parse-gemini-comments.cjs`) correctly identifies this as `HIGH` priority.

### 2. Persistence Analysis
- `api/gemini-reviews/persist.js` maps `HIGH` to `alta` (Portuguese).
- `mapPriority('HIGH')` returns `'alta'`.
- The issue should be saved in Supabase with `priority: 'alta'`.

### 3. Issue Creation Analysis
- `api/gemini-reviews/create-issues.js` (and `.github/scripts/create-issues.cjs`) has a bug in `fetchPendingIssues`:
  ```javascript
  .eq('priority', 'media')
  ```
  It only fetches issues with `media` priority.
- **Wait!** If it only fetches `media`, it should NOT have created an issue for an `alta` priority review.
- However, issue #205 was created with `[Medium]` prefix and `priority:media` label.
- This confirms that the issue was saved as `media` in Supabase, even though the comment was `high`.

## Fixes Applied

1. **`api/gemini-reviews/persist.js`**:
   - Updated `issueSchema` to include `severity`.
   - Updated `createNewIssue` to use `issue.priority || issue.severity`. This ensures that when the parser sends `severity`, it is correctly mapped to the database `priority` field.
2. **`api/gemini-reviews/create-issues.js`**:
   - Updated `fetchPendingIssues` to use `.in('priority', ['media', 'alta', 'critica'])` instead of `.eq('priority', 'media')`. This allows the script to process High and Critical issues.
   - Updated logging to reflect the new filter.
3. **`.github/scripts/persist-reviews.cjs`**:
   - Applied same changes as `api/gemini-reviews/persist.js` for parity.
4. **`.github/scripts/create-issues.cjs`**:
   - Applied same changes as `api/gemini-reviews/create-issues.js` for parity.

## Verification
- The root cause was a field name mismatch (`severity` vs `priority`) during persistence, causing all non-medium issues to default to `media`.
- Additionally, the issue creation logic was hardcoded to only fetch `media` priority issues.
- With these changes, a `HIGH` review will be saved as `alta` and then fetched and created with the `[High]` prefix.
