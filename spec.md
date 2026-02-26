# Payroll Manager

## Current State
New project. No existing files.

## Requested Changes (Diff)

### Add
- Employee records stored permanently (name, wage rate)
- Payroll table with: Employee Name, Hours Worked, Wage Rate, Total Wages (auto-calc), Tips Earned, 80-Hour Fixed toggle (for students)
- Add, edit, delete employee functionality
- Final totals section (total wages + total tips + grand total)
- Save as PDF export
- Persistent data storage (survives app close/reload)

### Modify
- N/A (new project)

### Remove
- N/A (new project)

## Implementation Plan
1. Backend:
   - Store employee records: id, name, wageRate
   - Store payroll sessions: per-employee hours, tips, studentFixed80 flag
   - CRUD for employees
   - CRUD for payroll entries (per pay period)
2. Frontend:
   - Main payroll table page
   - Add/Edit employee modal
   - Inline editing for hours worked, tips, wage rate
   - 80-hours toggle per row (auto-sets hours to 80)
   - Auto-calculated Total Wages column
   - Totals footer row
   - "Save as PDF" button using browser print/jsPDF
   - Clean, minimal design with clear typography

## UX Notes
- Non-technical users: large clear buttons, simple table layout
- 80-hour fixed toggle should be visually distinct (checkbox or toggle)
- PDF export should produce a clean formatted document with date and totals
- Warn before deleting an employee
