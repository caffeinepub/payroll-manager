import { useState, useEffect, useCallback, useRef } from "react";
import { useActor } from "./hooks/useActor";
import type { Employee, PayrollEntry } from "./backend.d.ts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Printer,
  RefreshCw,
  Pencil,
  Trash2,
  DollarSign,
  Users,
  CheckCircle2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface PayrollRow {
  employee: Employee;
  payrollEntry: PayrollEntry | null;
  localHours: string;
  localTips: string;
  localWageRate: string;
  isStudent: boolean;
  saving: boolean;
  savedAt: number | null; // timestamp of last save
}

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function calcTotalWages(hours: string, wageRate: string): number {
  const h = parseFloat(hours) || 0;
  const w = parseFloat(wageRate) || 0;
  return h * w;
}

// ─────────────────────────────────────────────
// Employee Dialog
// ─────────────────────────────────────────────

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  initialName?: string;
  initialWageRate?: string;
  onSave: (name: string, wageRate: number) => Promise<void>;
}

function EmployeeDialog({
  open,
  onOpenChange,
  mode,
  initialName = "",
  initialWageRate = "",
  onSave,
}: EmployeeDialogProps) {
  const [name, setName] = useState(initialName);
  const [wageRate, setWageRate] = useState(initialWageRate);
  const [errors, setErrors] = useState<{ name?: string; wageRate?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setWageRate(initialWageRate);
      setErrors({});
      setSaving(false);
    }
  }, [open, initialName, initialWageRate]);

  function validate(): boolean {
    const newErrors: { name?: string; wageRate?: string } = {};
    if (!name.trim()) newErrors.name = "Name is required";
    const rate = parseFloat(wageRate);
    if (!wageRate || isNaN(rate) || rate <= 0)
      newErrors.wageRate = "Wage rate must be a positive number";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave(name.trim(), parseFloat(wageRate));
      onOpenChange(false);
    } catch {
      // handled upstream
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {mode === "add" ? "Add Employee" : "Edit Employee"}
          </DialogTitle>
          <DialogDescription>
            {mode === "add"
              ? "Enter the employee's name and hourly wage rate."
              : "Update the employee's name or wage rate."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="emp-name">Employee Name</Label>
            <Input
              id="emp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jane Smith"
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="emp-wage">Hourly Wage Rate ($)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                $
              </span>
              <Input
                id="emp-wage"
                type="number"
                min="0"
                step="0.01"
                value={wageRate}
                onChange={(e) => setWageRate(e.target.value)}
                placeholder="0.00"
                className="pl-7 font-mono"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>
            {errors.wageRate && (
              <p className="text-xs text-destructive">{errors.wageRate}</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────

export default function App() {
  const { actor, isFetching: actorFetching } = useActor();
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Add employee dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Edit employee dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<string | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);

  // Clear pay period confirmation
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearInProgress, setClearInProgress] = useState(false);

  // Save debounce timers per row
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Load data ──────────────────────────────

  const loadData = useCallback(async () => {
    if (!actor) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [employees, entries] = await Promise.all([
        actor.listEmployees(),
        actor.listPayrollEntries(),
      ]);

      // Map entries by employeeId
      const entryMap = new Map<string, PayrollEntry>();
      for (const entry of entries) {
        entryMap.set(entry.employeeId, entry);
      }

      // For employees with no entry, create one
      const missingEntries = employees.filter((emp) => !entryMap.has(emp.id));
      if (missingEntries.length > 0) {
        await Promise.all(
          missingEntries.map((emp) => {
            const id = crypto.randomUUID();
            return actor.createPayrollEntry(id, emp.id, 0, 0, false);
          })
        );
        // Reload entries after creating missing ones
        const updatedEntries = await actor.listPayrollEntries();
        for (const entry of updatedEntries) {
          entryMap.set(entry.employeeId, entry);
        }
      }

      const newRows: PayrollRow[] = employees.map((emp) => {
        const entry = entryMap.get(emp.id) || null;
        return {
          employee: emp,
          payrollEntry: entry,
          localHours: entry ? String(entry.hoursWorked) : "0",
          localTips: entry ? String(entry.tipsEarned) : "0",
          localWageRate: String(emp.wageRate),
          isStudent: entry ? entry.isStudent : false,
          saving: false,
          savedAt: null,
        };
      });

      setRows(newRows);
    } catch (err) {
      console.error(err);
      setLoadError("Failed to load payroll data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [actor]);

  useEffect(() => {
    if (actor && !actorFetching) {
      loadData();
    }
  }, [actor, actorFetching, loadData]);

  // ── Row update helpers ─────────────────────

  function updateRow(employeeId: string, patch: Partial<PayrollRow>) {
    setRows((prev) =>
      prev.map((r) =>
        r.employee.id === employeeId ? { ...r, ...patch } : r
      )
    );
  }

  function markSaving(employeeId: string, saving: boolean) {
    updateRow(employeeId, { saving });
  }

  async function persistRow(row: PayrollRow) {
    if (!actor || !row.payrollEntry) return;
    const empId = row.employee.id;
    markSaving(empId, true);
    try {
      const hours = parseFloat(row.localHours) || 0;
      const tips = parseFloat(row.localTips) || 0;
      const wageRate = parseFloat(row.localWageRate) || 0;

      await Promise.all([
        actor.updatePayrollEntry(
          row.payrollEntry.id,
          empId,
          hours,
          tips,
          row.isStudent
        ),
        actor.updateEmployee(empId, row.employee.name, wageRate),
      ]);

      updateRow(empId, { saving: false, savedAt: Date.now() });
    } catch (err) {
      console.error(err);
      toast.error(`Failed to save changes for ${row.employee.name}`);
      updateRow(empId, { saving: false });
    }
  }

  function scheduleSave(row: PayrollRow) {
    const empId = row.employee.id;
    if (saveTimers.current[empId]) {
      clearTimeout(saveTimers.current[empId]);
    }
    saveTimers.current[empId] = setTimeout(() => {
      persistRow(row);
    }, 600);
  }

  // ── Hours change ───────────────────────────

  function handleHoursChange(employeeId: string, value: string) {
    setRows((prev) => {
      const updated = prev.map((r) => {
        if (r.employee.id !== employeeId) return r;
        return { ...r, localHours: value };
      });
      const row = updated.find((r) => r.employee.id === employeeId);
      if (row) scheduleSave(row);
      return updated;
    });
  }

  function handleHoursBlur(employeeId: string) {
    const row = rows.find((r) => r.employee.id === employeeId);
    if (row) persistRow(row);
  }

  // ── Wage rate change ───────────────────────

  function handleWageRateChange(employeeId: string, value: string) {
    setRows((prev) => {
      const updated = prev.map((r) => {
        if (r.employee.id !== employeeId) return r;
        return { ...r, localWageRate: value };
      });
      const row = updated.find((r) => r.employee.id === employeeId);
      if (row) scheduleSave(row);
      return updated;
    });
  }

  function handleWageRateBlur(employeeId: string) {
    const row = rows.find((r) => r.employee.id === employeeId);
    if (row) persistRow(row);
  }

  // ── Tips change ────────────────────────────

  function handleTipsChange(employeeId: string, value: string) {
    setRows((prev) => {
      const updated = prev.map((r) => {
        if (r.employee.id !== employeeId) return r;
        return { ...r, localTips: value };
      });
      const row = updated.find((r) => r.employee.id === employeeId);
      if (row) scheduleSave(row);
      return updated;
    });
  }

  function handleTipsBlur(employeeId: string) {
    const row = rows.find((r) => r.employee.id === employeeId);
    if (row) persistRow(row);
  }

  // ── Student toggle ─────────────────────────

  function handleStudentToggle(employeeId: string, checked: boolean) {
    setRows((prev) => {
      const updated = prev.map((r) => {
        if (r.employee.id !== employeeId) return r;
        return {
          ...r,
          isStudent: checked,
          localHours: checked ? "80" : r.localHours,
        };
      });
      const row = updated.find((r) => r.employee.id === employeeId);
      if (row) persistRow(row);
      return updated;
    });
  }

  // ── Add employee ───────────────────────────

  async function handleAddEmployee(name: string, wageRate: number) {
    if (!actor) return;
    const empId = crypto.randomUUID();
    const entryId = crypto.randomUUID();
    try {
      await actor.createEmployee(empId, name, wageRate);
      await actor.createPayrollEntry(entryId, empId, 0, 0, false);
      const newEmployee: Employee = { id: empId, name, wageRate };
      const newEntry: PayrollEntry = {
        id: entryId,
        employeeId: empId,
        hoursWorked: 0,
        tipsEarned: 0,
        isStudent: false,
        totalWages: 0,
      };
      setRows((prev) => [
        ...prev,
        {
          employee: newEmployee,
          payrollEntry: newEntry,
          localHours: "0",
          localTips: "0",
          localWageRate: String(wageRate),
          isStudent: false,
          saving: false,
          savedAt: null,
        },
      ]);
      toast.success(`${name} added successfully`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to add employee");
      throw err;
    }
  }

  // ── Edit employee ──────────────────────────

  const editingRow = editingEmployeeId
    ? rows.find((r) => r.employee.id === editingEmployeeId)
    : null;

  async function handleEditEmployee(name: string, wageRate: number) {
    if (!actor || !editingEmployeeId) return;
    try {
      await actor.updateEmployee(editingEmployeeId, name, wageRate);
      setRows((prev) =>
        prev.map((r) => {
          if (r.employee.id !== editingEmployeeId) return r;
          return {
            ...r,
            employee: { ...r.employee, name, wageRate },
            localWageRate: String(wageRate),
          };
        })
      );
      toast.success(`${name} updated`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update employee");
      throw err;
    }
  }

  // ── Delete employee ────────────────────────

  function openDeleteConfirm(employeeId: string) {
    setDeletingEmployeeId(employeeId);
    setDeleteConfirmOpen(true);
  }

  async function handleDeleteEmployee() {
    if (!actor || !deletingEmployeeId) return;
    setDeleteInProgress(true);
    const row = rows.find((r) => r.employee.id === deletingEmployeeId);
    try {
      const deleteOps: Promise<void>[] = [actor.deleteEmployee(deletingEmployeeId)];
      if (row?.payrollEntry) {
        deleteOps.push(actor.deletePayrollEntry(row.payrollEntry.id));
      }
      await Promise.all(deleteOps);
      setRows((prev) => prev.filter((r) => r.employee.id !== deletingEmployeeId));
      toast.success(`${row?.employee.name ?? "Employee"} removed`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete employee");
    } finally {
      setDeleteInProgress(false);
      setDeleteConfirmOpen(false);
      setDeletingEmployeeId(null);
    }
  }

  // ── Clear pay period ───────────────────────

  async function handleClearPayPeriod() {
    if (!actor) return;
    setClearInProgress(true);
    try {
      await actor.clearPayrollEntries();
      const newEntries = await Promise.all(
        rows.map(async (row) => {
          const id = crypto.randomUUID();
          await actor.createPayrollEntry(id, row.employee.id, 0, 0, false);
          return { employeeId: row.employee.id, entryId: id };
        })
      );
      const entryMap = new Map(newEntries.map((e) => [e.employeeId, e.entryId]));
      setRows((prev) =>
        prev.map((r) => ({
          ...r,
          payrollEntry: {
            id: entryMap.get(r.employee.id) ?? crypto.randomUUID(),
            employeeId: r.employee.id,
            hoursWorked: 0,
            tipsEarned: 0,
            isStudent: false,
            totalWages: 0,
          },
          localHours: "0",
          localTips: "0",
          isStudent: false,
          saving: false,
          savedAt: null,
        }))
      );
      toast.success("Pay period cleared — all hours and tips reset to zero");
    } catch (err) {
      console.error(err);
      toast.error("Failed to clear pay period");
    } finally {
      setClearInProgress(false);
      setClearConfirmOpen(false);
    }
  }

  // ── Totals ─────────────────────────────────

  const totalWages = rows.reduce(
    (sum, r) => sum + calcTotalWages(r.localHours, r.localWageRate),
    0
  );
  const totalTips = rows.reduce((sum, r) => sum + (parseFloat(r.localTips) || 0), 0);
  const grandTotal = totalWages + totalTips;

  // ── Render ─────────────────────────────────

  const deletingRow = deletingEmployeeId
    ? rows.find((r) => r.employee.id === deletingEmployeeId)
    : null;

  if (!actor && actorFetching) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" richColors />

      {/* ── Header ── */}
      <header className="no-print border-b border-border bg-card shadow-xs">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
                <DollarSign className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  Payroll Manager
                </h1>
                <p className="text-xs text-muted-foreground">
                  {rows.length} employee{rows.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 action-buttons">
              <Button
                onClick={() => setAddDialogOpen(true)}
                className="gap-1.5"
                size="sm"
              >
                <Plus className="h-4 w-4" />
                Add Employee
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setClearConfirmOpen(true)}
              >
                <RefreshCw className="h-4 w-4" />
                Clear Pay Period
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => window.print()}
              >
                <Printer className="h-4 w-4" />
                Save as PDF
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Print Title ── */}
      <div className="print-title hidden mx-auto max-w-7xl px-6 pt-6">
        Payroll Report — {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      </div>

      {/* ── Main ── */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Error state */}
        {loadError && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {loadError}
            <button
              type="button"
              onClick={loadData}
              className="ml-2 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Payroll Table ── */}
        <div className="payroll-table-container rounded-lg border border-border bg-card shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-[200px] font-semibold text-foreground">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      Employee
                    </div>
                  </TableHead>
                  <TableHead className="w-[130px] text-right font-semibold text-foreground">
                    Hours Worked
                  </TableHead>
                  <TableHead className="w-[130px] text-right font-semibold text-foreground">
                    Wage Rate
                  </TableHead>
                  <TableHead className="w-[140px] text-right font-semibold text-foreground">
                    Total Wages
                  </TableHead>
                  <TableHead className="w-[130px] text-right font-semibold text-foreground">
                    Tips Earned
                  </TableHead>
                  <TableHead className="w-[110px] text-center font-semibold text-foreground">
                    Student (80h)
                  </TableHead>
                  <TableHead className="w-[120px] text-center font-semibold text-foreground no-print">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  // Loading skeletons
                  ["sk-1", "sk-2", "sk-3"].map((skKey) => (
                    <TableRow key={skKey}>
                      {["c1", "c2", "c3", "c4", "c5", "c6", "c7"].map((cKey) => (
                        <TableCell key={cKey}>
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <Users className="h-10 w-10 opacity-30" />
                        <div>
                          <p className="font-medium">No employees yet</p>
                          <p className="text-sm">
                            Click "Add Employee" to get started
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const totalWagesRow = calcTotalWages(
                      row.localHours,
                      row.localWageRate
                    );
                    return (
                      <TableRow key={row.employee.id} className="payroll-row">
                        {/* Employee Name */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">
                              {row.employee.name}
                            </span>
                            {row.saving && (
                              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground saving-pulse" />
                            )}
                            {!row.saving && row.savedAt && (
                              <CheckCircle2 className="h-3 w-3 text-green-600 opacity-60" />
                            )}
                          </div>
                        </TableCell>

                        {/* Hours Worked */}
                        <TableCell className="text-right">
                          <input
                            type="number"
                            className="table-input"
                            min="0"
                            step="0.5"
                            value={row.localHours}
                            disabled={row.isStudent}
                            onChange={(e) =>
                              handleHoursChange(row.employee.id, e.target.value)
                            }
                            onBlur={() => handleHoursBlur(row.employee.id)}
                            aria-label={`Hours worked for ${row.employee.name}`}
                          />
                        </TableCell>

                        {/* Wage Rate */}
                        <TableCell className="text-right">
                          <div className="relative flex items-center justify-end">
                            <span className="absolute left-2 text-muted-foreground text-xs pointer-events-none">
                              $
                            </span>
                            <input
                              type="number"
                              className="table-input"
                              min="0"
                              step="0.01"
                              value={row.localWageRate}
                              onChange={(e) =>
                                handleWageRateChange(
                                  row.employee.id,
                                  e.target.value
                                )
                              }
                              onBlur={() =>
                                handleWageRateBlur(row.employee.id)
                              }
                              aria-label={`Wage rate for ${row.employee.name}`}
                            />
                          </div>
                        </TableCell>

                        {/* Total Wages */}
                        <TableCell className="text-right">
                          <span className="font-mono font-medium text-foreground tabular-nums">
                            {formatCurrency(totalWagesRow)}
                          </span>
                        </TableCell>

                        {/* Tips Earned */}
                        <TableCell className="text-right">
                          <div className="relative flex items-center justify-end">
                            <span className="absolute left-2 text-muted-foreground text-xs pointer-events-none">
                              $
                            </span>
                            <input
                              type="number"
                              className="table-input"
                              min="0"
                              step="0.01"
                              value={row.localTips}
                              onChange={(e) =>
                                handleTipsChange(row.employee.id, e.target.value)
                              }
                              onBlur={() => handleTipsBlur(row.employee.id)}
                              aria-label={`Tips earned for ${row.employee.name}`}
                            />
                          </div>
                        </TableCell>

                        {/* Student Checkbox */}
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center">
                            <Checkbox
                              checked={row.isStudent}
                              onCheckedChange={(checked) =>
                                handleStudentToggle(
                                  row.employee.id,
                                  checked === true
                                )
                              }
                              aria-label={`Mark ${row.employee.name} as student`}
                            />
                          </div>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-center no-print">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setEditingEmployeeId(row.employee.id);
                                setEditDialogOpen(true);
                              }}
                              aria-label={`Edit ${row.employee.name}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() =>
                                openDeleteConfirm(row.employee.id)
                              }
                              aria-label={`Delete ${row.employee.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* ── Totals Section ── */}
        {!loading && rows.length > 0 && (
          <div className="totals-section mt-6 rounded-lg border border-border bg-card shadow-xs overflow-hidden">
            <div className="border-b border-border bg-muted/30 px-6 py-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Period Summary
              </h2>
            </div>
            <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="px-6 py-5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Total Wages
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">
                  {formatCurrency(totalWages)}
                </p>
              </div>
              <div className="px-6 py-5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Total Tips
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">
                  {formatCurrency(totalTips)}
                </p>
              </div>
              <div className="px-6 py-5 bg-primary/5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Grand Total
                </p>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-primary">
                  {formatCurrency(grandTotal)}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="app-footer no-print mt-10 border-t border-border py-6 text-center text-xs text-muted-foreground">
        © 2026. Built with{" "}
        <span className="text-destructive" role="img" aria-label="love">
          ♥
        </span>{" "}
        using{" "}
        <a
          href="https://caffeine.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          caffeine.ai
        </a>
      </footer>

      {/* ── Dialogs ── */}

      {/* Add Employee */}
      <EmployeeDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        mode="add"
        onSave={handleAddEmployee}
      />

      {/* Edit Employee */}
      {editingRow && (
        <EmployeeDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          mode="edit"
          initialName={editingRow.employee.name}
          initialWageRate={editingRow.localWageRate}
          onSave={handleEditEmployee}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{deletingRow?.employee.name}</strong>? This will also
              remove their payroll entry. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteInProgress}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEmployee}
              disabled={deleteInProgress}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteInProgress ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {deleteInProgress ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear Pay Period Confirmation */}
      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Pay Period</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset all hours worked, tips earned, and student
              settings to zero for every employee. Employee names and wage rates
              will be kept. Are you sure you want to start a new pay period?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearInProgress}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearPayPeriod}
              disabled={clearInProgress}
            >
              {clearInProgress ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {clearInProgress ? "Clearing…" : "Clear Pay Period"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
