# Payroll Manager

## Current State
Full payroll app with two companies (Bezendi Limited, The Barn), employee rows with hourly/fixed/student wages, cash/bank payment toggles, 4 PDF exports (Accountant, Full Summary, Tips, Cash Transactions), passcode lock, dashboard with latest period summary, A-Z sort, and auto-save per row. Pay period dates (periodStart/periodEnd) are React state only — not persisted. Periods are saved to cloud only when "Clear Period" is clicked.

## Requested Changes (Diff)

### Add
- `localManualCash: string` field to `PayrollRow` interface — editable per row, defaults to empty string (blank until user types)
- "Manual Cash" column in the main payroll table — a number input shown for all rows, labeled "Manual £", sitting next to the auto-calculated Total Wages. User types rounded cash values here (e.g. £80 when wages auto-calc to £78.89). This is NOT the same as Total Wages; it's a separate manual override column.
- In Cash Transactions PDF: show two columns — "Calculated Cash" (auto total) and "Manual Cash" (user-entered) — with both column totals at the bottom so user can compare auto vs manual totals.
- "Save Period" button in the header action bar (next to Clear Period). Clicking it saves the current period data to cloud via `actor.savePayPeriod(...)` WITHOUT clearing any entries or resetting any values. Shows a success toast. The saved period then appears on the dashboard.
- Monthly Labour Cost graph on the Dashboard page — a vertical bar chart using recharts BarChart showing grand total per saved pay period grouped/labeled by month. Use the `listPayPeriods` data already loaded on dashboard. Show bars for each period saved, x-axis = period label (shortened), y-axis = £ amount. This replaces or adds below the existing dashboard summary cards.
- `periodStart` and `periodEnd` are saved to localStorage (`payroll_period_${activeCompany}`) whenever they change (useEffect), and restored on load/company switch.

### Modify
- Dashboard: fetch `listPayPeriods` (in addition to `getLatestPayPeriod`) to populate the labour cost graph
- Cash Transactions PDF (`printCashTransactionsPDF`): accept a `manualCashMap: Record<string, number>` parameter and show two columns for cash employees: "Calculated" and "Manual Cash (Rounded)", with grand totals for both at the bottom
- `handleClearPayPeriod`: also clear `localManualCash` (set to "") for all rows after clearing
- Load data: restore `periodStart`/`periodEnd` from localStorage on load
- "Save Period" button: disabled if no period dates entered

### Remove
- Nothing removed

## Implementation Plan
1. Add `localManualCash: string` to `PayrollRow` interface; initialize to `""` in `loadData`
2. Add `handleManualCashChange(employeeId, value)` — updates `localManualCash` in state, no backend save needed (local UI only)
3. Add "Manual £" column to the table header and each row (number input, amber tinted to indicate manual override, min-width ~100px)
4. Add `localManualCashMap` computed from rows for passing to Cash PDF
5. Update `printCashTransactionsPDF` signature to accept `manualCashMap`, add second column and totals row
6. Add "Save Period" button in header, wire to new `handleSavePeriod()` async function that calls `actor.savePayPeriod` and toasts success/error; set a `savingPeriod` loading state
7. Add `useEffect` to persist `periodStart`/`periodEnd` to localStorage on change; restore in `handleCompanySwitch` and on mount
8. In Dashboard: call `actor.listPayPeriods(activeCompany)` to get all periods; render a BarChart using recharts showing `grandTotal` per period
9. `DashboardView` props: add `allPeriods: PayPeriod[]` and `loadingPeriods: boolean`
