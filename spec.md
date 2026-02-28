# Payroll Manager

## Current State
A dual-company payroll app for Bezendi Limited and The Barn. Features: employee management, payroll table with hours/wage/tips/student 80h toggle, overtime sub-rows for students, alphabetical sort, date range, two PDFs (Accountant and Full Summary), and a dashboard showing the last saved pay period. Data is stored permanently on-chain.

## Requested Changes (Diff)

### Add
1. **Fixed salary mode** per employee — instead of hours-based calculation, an employee can be paid a flat fixed amount (e.g. £1500). This is a per-payroll-period toggle per employee (not stored on the employee record permanently — chosen each pay period).
2. **Payment method toggle** per employee and per overtime row — Cash or Bank Transfer. Shown in the payroll table as a toggle/button. Default: Bank Transfer.
3. **Cash Total** summary at the bottom — shows the sum of all amounts marked as Cash across all employees (wages, fixed salary, overtime rows, tips).
4. Payment method column added to both Accountant PDF and Full Summary PDF.
5. Fixed salary amounts appear in both PDFs: Accountant PDF shows employee name + fixed amount (instead of hours when in fixed mode); Full Summary PDF shows the fixed amount row with payment method and individual total.

### Modify
- `PayrollEntry` backend type: add `isFixedSalary: Bool`, `fixedSalaryAmount: Float`, `paymentMethod: Text` ("cash" or "bank"), `overtimePaymentMethod: Text` ("cash" or "bank").
- `PayrollRow` frontend type: add `isFixedSalary`, `localFixedSalaryAmount`, `paymentMethod`, `overtimePaymentMethod` fields.
- `calcIndividualTotal`: when `isFixedSalary` is true, use `fixedSalaryAmount` instead of `hours * wageRate`.
- Totals section: add a 5th "Cash Total" card that sums up all cash-paid amounts.
- Both PDF generators: add "Payment Method" column; show Cash/Bank label per row.
- `savePayPeriod`: pass `cashTotal` as additional field (add to PayPeriod type).
- `QuickEntryPanel`: add fixed salary toggle + amount input, and payment method selector.
- Dashboard: show cash total from latest period.
- `handleAddEmployee`: initialise new fields to defaults.
- `loadData`: map new fields from backend entries.
- `handleClearPayPeriod`: reset new fields to defaults.

### Remove
- Nothing removed.

## Implementation Plan
1. Update Motoko backend: add `isFixedSalary`, `fixedSalaryAmount`, `paymentMethod`, `overtimePaymentMethod` to `PayrollEntry`; add `cashTotal` to `PayPeriod`; update all create/update functions to accept and persist new fields.
2. Regenerate `backend.d.ts` via `generate_motoko_code`.
3. Update frontend `App.tsx`:
   - Extend `PayrollRow` interface with new fields.
   - Update `calcIndividualTotal` to handle fixed salary.
   - Add `computedCashTotal` derived value.
   - Update table: add Payment Method toggle column (Cash/Bank button) per row and per overtime sub-row; add Fixed Salary toggle + amount input replacing hours/wages columns when enabled.
   - Update totals section: add Cash Total card.
   - Update both PDF generators: add payment method column and cash total section.
   - Update `QuickEntryPanel`: add fixed salary and payment method controls.
   - Update `loadData`, `persistRow`, `handleAddEmployee`, `handleClearPayPeriod` to handle new fields.
   - Update dashboard `PayPeriod` card to show cash total.

## UX Notes
- Fixed salary toggle: when enabled, hours input and wage rate input are disabled/hidden for that row, replaced by a single "Fixed Amount (£)" input.
- Payment method: a small toggle button "Cash | Bank" per row in the table. Default is Bank.
- The overtime sub-row also gets its own Cash/Bank toggle.
- Cash Total card sits alongside Grand Total in the totals section.
- In the Accountant PDF, for fixed salary employees: show the fixed amount instead of hours, and add a "Payment" column.
- In the Full Summary PDF: add "Payment" column for each row; show Cash Total in the summary box.
