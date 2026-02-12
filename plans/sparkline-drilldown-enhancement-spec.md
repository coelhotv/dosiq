# Technical Specification: Sparkline Drill-Down Enhancement
## Missed Doses Display Implementation

**Document Version:** 1.0  
**Date:** 2026-02-12  
**Status:** Draft - Ready for Review  
**Related Components:** DailyDoseModal, DoseListItem, SparklineAdesao  
**Priority:** High  
**Estimated Complexity:** Medium (3-4 days)

---

## 1. Feature Overview

### 1.1 Current State
The [`DailyDoseModal`](src/components/dashboard/DailyDoseModal.jsx:1) currently only displays doses that were actually taken (from logs). While users see an adherence stat like "9/12", they cannot identify which specific 3 doses were missed. The `missedDoses` array exists in the component but is never populated with actual data.

### 1.2 Desired Enhancement
Split the modal display into two distinct sections:

1. **"Doses Tomadas"** (Taken Doses) - Already implemented ✅
2. **"Doses Perdidas"** (Missing Doses) - **NEW** - Display scheduled doses that weren't logged

### 1.3 User Value
- **Transparency:** Users can see exactly which doses they missed
- **Accountability:** Clear visibility into adherence gaps
- **Actionability:** Identify patterns in missed doses (specific times, medications)
- **Trust:** The "9/12" stat becomes verifiable and meaningful

---

## 2. Data Flow Analysis

### 2.1 Data Requirements

To calculate missed doses, we need to compare:

| Data Source | Structure | Purpose |
|-------------|-----------|---------|
| **Logs** (taken doses) | `medicine_logs` table with `taken_at`, `protocol_id`, `medicine_id` | Doses actually taken |
| **Protocols** (expected doses) | `protocols` table with `time_schedule[]`, `frequency`, `active` | Scheduled doses |
| **Date Context** | Target date in Brazil timezone (GMT-3) | Accurate day boundaries |

### 2.2 Algorithm: Calculate Missed Doses

```
Input: date (YYYY-MM-DD), logs[], activeProtocols[]
Output: { takenDoses[], missedDoses[] }

1. Filter protocols that should have doses on the given date
   - Check frequency (daily, weekly, etc.)
   - Check if protocol is active
   - For weekly: check if date's weekday matches protocol.days[]

2. Generate expected dose slots for the date
   For each applicable protocol:
     For each time in protocol.time_schedule:
       Create expectedDose = {
         protocolId: protocol.id,
         medicineId: protocol.medicine_id,
         scheduledTime: time,  // "HH:mm"
         expectedQuantity: protocol.dosage_per_intake
       }

3. Match logs to expected slots
   For each log in logs:
     Find matching expectedDose where:
       - log.protocol_id === expectedDose.protocolId
       - isDoseInToleranceWindow(expectedDose.scheduledTime, log.taken_at)
     Mark as taken

4. Collect unmatched expected doses as missedDoses
   For each expectedDose not matched:
     Create missedDose = {
       ...expectedDose,
       id: `missed-${protocolId}-${time}`,  // Synthetic ID
       status: 'missed'
     }
```

### 2.3 Timezone Handling (Critical)

**Brazil Timezone (GMT-3) Requirements:**
- All date comparisons must use Brazil local time
- Day boundaries: 00:00 to 23:59 Brazil time
- Log timestamps are stored in UTC but displayed in local time
- Use existing helper: [`isDoseInToleranceWindow()`](src/utils/adherenceLogic.js:169) from [`adherenceLogic.js`](src/utils/adherenceLogic.js:1)

**Edge Cases:**
- Logs taken just after midnight (still "yesterday" in Brazil until 03:00 UTC)
- Protocols crossing DST transitions

### 2.4 Edge Cases to Handle

| Scenario | Expected Behavior |
|----------|-------------------|
| No scheduled doses for the day | Show "Nenhuma dose agendada" in both sections |
| All doses taken | Show only "Doses Tomadas" section |
| All doses missed | Show only "Doses Perdidas" section |
| Partial adherence | Show both sections with counts |
| Future date | Show expected doses as "Agendado" (not missed yet) |
| Past date before protocol start | No doses shown |
| Protocol paused/inactive | Doses not included in expected |

---

## 3. API/Service Changes

### 3.1 New Service Method

Create a new utility function in [`adherenceLogic.js`](src/utils/adherenceLogic.js:1):

```javascript
/**
 * Calculates taken and missed doses for a specific date
 * 
 * @param {string} date - Date in YYYY-MM-DD format (Brazil local)
 * @param {Array} logs - Medicine logs from that date
 * @param {Array} protocols - Active protocols
 * @returns {Object} { takenDoses[], missedDoses[] }
 */
export function calculateDosesByDate(date, logs, protocols) {
  // Implementation following algorithm in section 2.2
}
```

### 3.2 New Hook (Optional)

Consider creating [`useDrillDownData.js`](src/hooks/useDrillDownData.js:1) if data fetching becomes complex:

```javascript
export function useDrillDownData(date) {
  // Fetch logs and protocols for the date
  // Return { takenDoses, missedDoses, isLoading, error }
}
```

**Decision:** For Phase 1, calculate client-side using existing data from SparklineAdesao. If performance issues arise, add dedicated hook.

### 3.3 Props Interface Changes

**Current [`DailyDoseModal`](src/components/dashboard/DailyDoseModal.jsx:121) props:**
```javascript
{
  date: string,
  isOpen: boolean,
  onClose: Function,
  logs: Array,           // Only taken doses
  isLoading: boolean,
  error: Error,
  dailySummary: Object,
  onRetry: Function
}
```

**Enhanced Props:**
```javascript
{
  date: string,
  isOpen: boolean,
  onClose: Function,
  logs: Array,           // Taken doses (existing)
  missedDoses: Array,    // NEW: Calculated missed doses
  protocols: Array,      // NEW: Active protocols for context
  isLoading: boolean,
  error: Error,
  dailySummary: Object,  // Contains taken/expected counts
  onRetry: Function
}
```

**Alternative (Recommended):** Keep props simple, calculate `missedDoses` internally using `dailySummary.expected` and passed `protocols`.

---

## 4. Component Architecture

### 4.1 Component Hierarchy

```
SparklineAdesao
└── onDayClick(dayData) ──► Dashboard
    └── Opens DailyDoseModal
        ├── Header (adherence badge, dose count)
        ├── Loading State
        ├── Error State
        ├── Empty State
        ├── Doses Tomadas Section (existing)
        │   └── DoseListItem (taken)
        └── Doses Perdidas Section (NEW)
            └── DoseListItem (missed) - with scheduledTime prop
```

### 4.2 DoseListItem Reuse Strategy

The existing [`DoseListItem`](src/components/dashboard/DoseListItem.jsx:68) component already supports both taken and missed doses via the `isTaken` prop:

```jsx
// For taken doses
<DoseListItem 
  log={log} 
  isTaken={true} 
  index={index}
/>

// For missed doses  
<DoseListItem 
  log={missedDose} 
  isTaken={false} 
  scheduledTime={missedDose.scheduledTime}
  index={index}
/>
```

**Required Data Shape for Missed Doses:**
```javascript
{
  id: string,           // Synthetic: `missed-${protocolId}-${time}`
  protocol: Object,     // Full protocol data
  medicine: Object,     // Full medicine data
  scheduledTime: string, // "HH:mm" format
  expectedQuantity: number, // From protocol.dosage_per_intake
  status: 'missed'
}
```

### 4.3 State Management

**DailyDoseModal State:**
```javascript
// Existing - no changes needed for basic implementation
const { modalRef, handleKeyDown } = useFocusTrap(isOpen)

// Enhanced useMemo for dose separation
const { takenDoses, missedDoses } = useMemo(() => {
  if (!logs || !protocols || !date) {
    return { takenDoses: [], missedDoses: [] }
  }
  
  return calculateDosesByDate(date, logs, protocols)
}, [logs, protocols, date])
```

### 4.4 Accessibility Requirements

| Requirement | Implementation |
|-------------|----------------|
| Screen reader sections | `aria-labelledby` on each section header |
| Count announcement | `aria-live="polite"` on section titles |
| Status indication | `dose-list-item--missed` CSS class |
| Focus management | Existing focus trap in `useFocusTrap` |
| Reduced motion | Respect `prefers-reduced-motion` |

---

## 5. UI/UX Specifications

### 5.1 Layout Design

**Desktop (> 640px):**
```
┌─────────────────────────────────────┐
│  Terça-feira, 11 de Fevereiro      │
├─────────────────────────────────────┤
│  [ 85% ADESÃO ]  3 de 4 doses      │
├─────────────────────────────────────┤
│  ● DOSES TOMADAS (3)               │
│  ┌───────────────────────────────┐  │
│  │ ✓ Paracetamol    08:30 Tomada │  │
│  │ ✓ Ibuprofeno     14:00 Tomada │  │
│  │ ✓ Vitamina D     20:00 Tomada │  │
│  └───────────────────────────────┘  │
│                                     │
│  ● DOSES PERDIDAS (1)               │
│  ┌───────────────────────────────┐  │
│  │ ✕ Omeprazol      07:00 Perdida│  │
│  └───────────────────────────────┘  │
├─────────────────────────────────────┤
│  💡 Clique para ver detalhes        │
└─────────────────────────────────────┘
```

**Mobile (< 640px):**
- Stacked layout (same order)
- Full-width sections
- Adjusted padding/spacing

### 5.2 Visual Design Tokens

**Section Headers:**
- Use existing `.dose-list-section__title` class
- Taken: green dot (`--color-success`)
- Missed: red dot (`--color-error`)

**DoseListItem Variants:**
- Taken: `.dose-list-item--taken` with green left border
- Missed: `.dose-list-item--missed` with red left border, 85% opacity (already implemented)

**Empty States:**
- **No scheduled doses:** Custom message "Nenhuma dose agendada para este dia"
- **All taken:** Show "Doses Tomadas" only, hide "Doses Perdidas"
- **All missed:** Show "Doses Perdidas" only, hide "Doses Tomadas"

### 5.3 Responsive Behavior

| Breakpoint | Layout | Adjustments |
|------------|--------|-------------|
| > 640px | Single column, side-by-side summary | Default spacing |
| 480-640px | Single column, stacked summary | Reduced padding |
| < 480px | Compact single column | Smaller fonts, tighter spacing |

### 5.4 Interaction Design

- **Hover:** DoseListItem has hover state (already implemented)
- **Click:** Future enhancement - click to view protocol details
- **Keyboard:** Tab navigation through items, Enter to select
- **Animation:** Staggered entrance animation for missed doses (same as taken)

---

## 6. Implementation Plan

### Phase 1: Core Logic (Day 1)

**Tasks:**
1. [ ] Create `calculateDosesByDate()` function in [`adherenceLogic.js`](src/utils/adherenceLogic.js:1)
   - Implement algorithm from section 2.2
   - Handle all edge cases from section 2.4
   - Add JSDoc documentation

2. [ ] Add unit tests for `calculateDosesByDate()`
   - Test daily frequency
   - Test weekly frequency with day matching
   - Test tolerance window matching
   - Test edge cases

3. [ ] Update [`DailyDoseModal`](src/components/dashboard/DailyDoseModal.jsx:121)
   - Add `protocols` prop
   - Update `useMemo` to use new function
   - Remove placeholder logic

### Phase 2: UI Integration (Day 2)

**Tasks:**
4. [ ] Update parent component (Dashboard/SparklineAdesao)
   - Pass `protocols` to DailyDoseModal
   - Ensure protocols are fetched/cached

5. [ ] Enhance empty states
   - Add specific message for "no scheduled doses"
   - Handle "all taken" / "all missed" scenarios

6. [ ] CSS adjustments if needed
   - Verify spacing with two sections
   - Test on mobile devices

### Phase 3: Testing & Polish (Day 3)

**Tasks:**
7. [ ] Update existing tests
   - [`DailyDoseModal.test.jsx`](src/components/dashboard/__tests__/DailyDoseModal.test.jsx:1)
   - [`DoseListItem.test.jsx`](src/components/dashboard/__tests__/DoseListItem.test.jsx:1) (if needed)

8. [ ] Add integration tests
   - Test complete flow: click sparkline → see both sections
   - Test edge cases in UI

9. [ ] Manual testing
   - Test with real data
   - Verify timezone handling
   - Check accessibility (screen reader)

### Phase 4: Documentation (Day 4)

**Tasks:**
10. [ ] Update component documentation
    - JSDoc updates
    - PropTypes/TypeScript if applicable

11. [ ] Update user-facing documentation
    - Mention new feature in changelog

12. [ ] Code review and merge

---

## 7. Testing Strategy

### 7.1 Unit Tests (Critical)

**File:** `src/utils/__tests__/adherenceLogic.drilldown.test.js`

```javascript
describe('calculateDosesByDate', () => {
  describe('daily frequency protocols', () => {
    it('should mark all doses as missed when no logs', () => {
      // Assert all expected doses are in missedDoses
    })
    
    it('should mark dose as taken when log within tolerance window', () => {
      // Assert matching log appears in takenDoses
    })
    
    it('should mark dose as missed when log outside tolerance window', () => {
      // Assert expected dose is in missedDoses despite log existing
    })
  })
  
  describe('weekly frequency protocols', () => {
    it('should only include doses for matching weekday', () => {
      // Assert doses only on configured days
    })
  })
  
  describe('edge cases', () => {
    it('should handle empty protocols array', () => {
      // Assert no doses returned
    })
    
    it('should handle protocols with no time_schedule', () => {
      // Assert no doses for that protocol
    })
    
    it('should handle inactive protocols', () => {
      // Assert inactive protocol doses not included
    })
  })
})
```

### 7.2 Integration Tests

**File:** Update [`DailyDoseModal.test.jsx`](src/components/dashboard/__tests__/DailyDoseModal.test.jsx:1)

```javascript
describe('missed doses display', () => {
  it('should render missed doses section when doses were missed', () => {
    // Render with mock data including missed doses
    // Assert "Doses Perdidas" heading is visible
    // Assert missed dose items are rendered
  })
  
  it('should not render missed doses section when all doses taken', () => {
    // Render with 100% adherence
    // Assert "Doses Perdidas" section is not present
  })
  
  it('should pass correct props to DoseListItem for missed doses', () => {
    // Assert isTaken={false} and scheduledTime are passed
  })
})
```

### 7.3 Test Data Examples

```javascript
// Mock protocol with daily frequency
const mockProtocol = {
  id: 'proto-1',
  medicine_id: 'med-1',
  active: true,
  frequency: 'diário',
  time_schedule: ['08:00', '20:00'],
  dosage_per_intake: 1,
  medicine: { name: 'Paracetamol', type: 'comprimido' }
}

// Mock log (taken)
const mockLog = {
  id: 'log-1',
  protocol_id: 'proto-1',
  medicine_id: 'med-1',
  taken_at: '2026-02-11T08:15:00Z', // Within tolerance of 08:00
  quantity_taken: 1
}

// Expected result
const expectedResult = {
  takenDoses: [{ /* 08:00 dose matched */ }],
  missedDoses: [{ /* 20:00 dose not matched */ }]
}
```

---

## 8. File Structure

### Modified Files

| File | Changes |
|------|---------|
| [`src/utils/adherenceLogic.js`](src/utils/adherenceLogic.js:1) | Add `calculateDosesByDate()` function |
| [`src/components/dashboard/DailyDoseModal.jsx`](src/components/dashboard/DailyDoseModal.jsx:1) | Integrate missed doses calculation, add protocols prop |
| [`src/components/dashboard/DailyDoseModal.css`](src/components/dashboard/DailyDoseModal.css:1) | Minor adjustments for two-section layout |

### New Files

| File | Purpose |
|------|---------|
| `src/utils/__tests__/adherenceLogic.drilldown.test.js` | Unit tests for dose calculation logic |

### Parent Component Updates

| File | Changes |
|------|---------|
| Dashboard component (where DailyDoseModal is used) | Pass protocols prop |

---

## 9. Performance Considerations

### 9.1 Memoization Strategy

```javascript
// In DailyDoseModal - already using useMemo
const { takenDoses, missedDoses } = useMemo(
  () => calculateDosesByDate(date, logs, protocols),
  [date, logs, protocols] // Dependencies
)
```

### 9.2 Optimization Guidelines

- **Calculation complexity:** O(n*m) where n=logs, m=expected doses
- **Typical usage:** < 20 protocols × < 5 time slots = < 100 iterations
- **No API calls:** Calculate client-side from existing data
- **Cache opportunity:** Consider caching by date if recalculated frequently

### 9.3 Bundle Impact

- New function: ~2KB (estimate)
- No new dependencies
- No impact on initial load (lazy modal)

---

## 10. Rollback Plan

If issues are discovered post-deployment:

1. **Immediate:** Hide missed doses section via feature flag
2. **Short-term:** Revert to displaying only taken doses
3. **Fix:** Address issue and re-deploy

**No database changes required** - this is a pure client-side enhancement.

---

## 11. Acceptance Criteria

- [ ] User can click any day on sparkline and see both "Doses Tomadas" and "Doses Perdidas" sections
- [ ] Taken doses show actual time taken with green styling
- [ ] Missed doses show scheduled time with red styling
- [ ] Adherence percentage matches (taken / (taken + missed))
- [ ] Empty states display appropriately for each section
- [ ] All edge cases handled (no protocols, all taken, all missed, future dates)
- [ ] Unit tests for calculation logic pass (100%)
- [ ] Integration tests for UI pass (100%)
- [ ] No console errors or warnings
- [ ] Accessibility verified with screen reader
- [ ] Responsive design works on mobile and desktop

---

## 12. Open Questions

1. **Should we show the "Register Dose" action for missed doses?** (Future enhancement)
2. **Do we need to show the reason for missing?** (Out of scope for Phase 1)
3. **Should missed doses from inactive protocols be shown?** (Decision: No)

---

## Appendix A: Related Code References

- [`DailyDoseModal.jsx`](src/components/dashboard/DailyDoseModal.jsx:1) - Main component
- [`DoseListItem.jsx`](src/components/dashboard/DoseListItem.jsx:1) - List item component
- [`adherenceLogic.js`](src/utils/adherenceLogic.js:1) - Calculation utilities
- [`isDoseInToleranceWindow()`](src/utils/adherenceLogic.js:169) - Time matching logic
- [`SparklineAdesao.jsx`](src/components/dashboard/SparklineAdesao.jsx:1) - Parent sparkline component

---

*End of Specification*
