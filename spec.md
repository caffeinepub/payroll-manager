# Payroll Manager

## Current State
Fully functional payroll app for two companies (Bezendi Limited, The Barn) with employee management, payroll entries, overtime, tips, fixed salary, payment tracking, and PDF exports.

The backend uses `Map.empty()` with `let` bindings which may not persist reliably across canister upgrades, causing 'failed to add employee' errors.

## Requested Changes (Diff)

### Add
- Nothing new

### Modify
- Rewrite backend to use `stable var` with HashMap/TrieMap for reliable data persistence across upgrades
- Fix all CRUD operations to work reliably

### Remove
- Nothing removed

## Implementation Plan
1. Rewrite backend using stable vars and proper Motoko stable storage patterns
2. Keep all existing API signatures identical so frontend doesn't need changes
