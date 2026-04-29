# Execution Spec — Fix Notification Mode Persistence

Resolve the bug where `notification_mode` fails to persist or reflect correctly in the UI after selection in the mobile app.

## Scope and Deliverables

### [MODIFY] [NotificationPreferencesScreen.jsx](file:///Users/coelhotv/Library/Mobile%20Documents/com~apple~CloudDocs/git/dosiq/apps/mobile/src/features/profile/screens/NotificationPreferencesScreen.jsx)
- Update the initialization `useEffect` to call `setNotificationMode(settings.notification_mode ?? 'realtime')`.
- Ensure all relevant states are synchronized with the `settings` object from `useProfile()`.

## Acceptance Criteria

- [ ] When entering the Notification Preferences screen, the selected "Modo de Envio" matches the value stored in the database.
- [ ] Changing the "Modo de Envio" correctly updates the local state and triggers an update to the database via `persist()`.
- [ ] Returning to the screen after a change correctly displays the previously selected value (persistence confirmed).
- [ ] Debug logs (`if (__DEV__)`) confirm that `settings.notification_mode` is being received and applied.

## Risk Flags

- **[AP-W15]**: Avoid stale state by ensuring the `useEffect` dependencies include `settings`.
- **[R-109]**: Ensure internal state reinitalization when `settings` changes.

## Quality Gate Commands

- `npm run lint` (in `apps/mobile`)
- Manual verification in the app (UI sync check).
