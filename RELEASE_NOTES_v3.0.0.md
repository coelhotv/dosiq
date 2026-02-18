# Release v3.0.0 - Protocol Start/End Dates for Accurate Adherence

## Summary

This release introduces protocol start and end dates, fixing a critical issue where new protocols displayed artificially low adherence scores. The adherence calculation now respects the protocol's validity period, providing users with accurate medication tracking.

## What's New

### Protocol Start/End Dates
- **New fields**: `start_date` and `end_date` columns in protocols table
- **Accurate adherence**: Scores now consider only days from the protocol start date
- **Flexible duration**: Users can define protocol duration or leave it open-ended

### Shared Date Utilities Module
- **`parseLocalDate()`**: Converts string to date in local timezone
- **`formatLocalDate()`**: Formats date to YYYY-MM-DD string
- **`isProtocolActiveOnDate()`**: Checks if protocol is active on a given date

## Bug Fixes

- **Timezone inconsistency**: Fixed date validation in `protocolSchema.js` to use local timezone
- **Effective days calculation**: Removed extra day that was incorrectly added
- **Code duplication**: Centralized `isProtocolActiveOnDate` function in `dateUtils.js`

## Technical Details

- **3 new files**: `dateUtils.js`, migration SQL
- **5 modified files**: adherenceService, adherenceLogic, protocolSchema (x3)
- **166 tests passing**: No regressions

## Migration Required

Run the migration SQL to add the new columns:

```sql
-- .migrations/20260218_add_protocol_start_date.sql
ALTER TABLE protocols ADD COLUMN start_date DATE;
ALTER TABLE protocols ADD COLUMN end_date DATE;
```

## Breaking Changes

- Adherence calculation logic has changed to respect protocol dates
- Protocols with `end_date` set are no longer considered after their end date

## Contributors

- PR #50: Protocol Start/End Dates implementation
- Issues #51-#56: Backlog items for future improvements