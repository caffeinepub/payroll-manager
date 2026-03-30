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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  ArrowUpDown,
  Banknote,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  FileText,
  Heart,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import type { Employee, PayPeriod, PayrollEntry } from "./backend.d.ts";
import { useActor } from "./hooks/useActor";

// ─────────────────────────────────────────────
// Company Config
// ─────────────────────────────────────────────

type CompanyId = "bezendi" | "barn";

interface CompanyConfig {
  id: CompanyId;
  name: string;
  subtitle: string;
  primary: string;
  primaryFg: string;
  accent: string;
  headerBg: string;
  pdfPrimary: string;
  pdfAccent: string;
  pdfBorder: string;
  pdfEven: string;
}

const COMPANIES: Record<CompanyId, CompanyConfig> = {
  bezendi: {
    id: "bezendi",
    name: "Bezendi Limited",
    subtitle: "Wages Management",
    primary: "#3d2b1a",
    primaryFg: "#f5f0ec",
    accent: "#9b8578",
    headerBg: "#3d2b1a",
    pdfPrimary: "#3d2b1a",
    pdfAccent: "#7a6458",
    pdfBorder: "#d9cec9",
    pdfEven: "#faf7f5",
  },
  barn: {
    id: "barn",
    name: "The Barn",
    subtitle: "Wages Management",
    primary: "#2d5a3d",
    primaryFg: "#f0f7f2",
    accent: "#5a8a6a",
    headerBg: "#2d5a3d",
    pdfPrimary: "#2d5a3d",
    pdfAccent: "#4a7a5a",
    pdfBorder: "#c8ddd0",
    pdfEven: "#f5faf6",
  },
};

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type AppView = "dashboard" | "payroll";

interface PayrollRow {
  employee: Employee;
  payrollEntry: PayrollEntry | null;
  localHours: string;
  localTips: string;
  localWageRate: string;
  isStudent: boolean;
  localOvertimeHours: string;
  localOvertimeWageRate: string;
  isFixedSalary: boolean;
  localFixedSalaryAmount: string;
  paymentMethod: "cash" | "bank";
  overtimePaymentMethod: "cash" | "bank";
  includeInAccountantPDF: boolean;
  localManualCash: string;
  saving: boolean;
  savedAt: number | null;
}

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function calcOvertimeTotal(
  overtimeHours: string,
  overtimeWageRate: string,
): number {
  const h = Number.parseFloat(overtimeHours) || 0;
  const w = Number.parseFloat(overtimeWageRate) || 0;
  return h * w;
}

function computedCashTotalFromRows(rows: PayrollRow[]): number {
  return rows.reduce((acc, row) => {
    let rowCash = 0;
    // Main payment
    if (row.paymentMethod === "cash") {
      const mainAmount = row.isFixedSalary
        ? Number.parseFloat(row.localFixedSalaryAmount) || 0
        : (row.isStudent ? 80 : Number.parseFloat(row.localHours) || 0) *
          (Number.parseFloat(row.localWageRate) || 0);
      rowCash += mainAmount;
      // Tips follow main payment method
      rowCash += Number.parseFloat(row.localTips) || 0;
    }
    // Overtime (students only)
    if (row.isStudent && row.overtimePaymentMethod === "cash") {
      rowCash += calcOvertimeTotal(
        row.localOvertimeHours,
        row.localOvertimeWageRate,
      );
    }
    return acc + rowCash;
  }, 0);
}

function formatDateUK(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function formatPeriodLabel(startDate: string, endDate: string): string {
  return `${formatDateUK(startDate)} – ${formatDateUK(endDate)}`;
}

// ─────────────────────────────────────────────
// PDF Generators
// ─────────────────────────────────────────────

function printAccountantPDF(
  rows: PayrollRow[],
  startDate: string,
  endDate: string,
  co: CompanyConfig,
) {
  const periodLabel =
    startDate && endDate
      ? `Period: ${formatPeriodLabel(startDate, endDate)}`
      : `Date: ${formatDateUK(todayISO())}`;

  // Sort alphabetically for accountant PDF
  const sortedRows = [...rows]
    .filter((r) => r.includeInAccountantPDF)
    .sort((a, b) => a.employee.name.localeCompare(b.employee.name));

  const tableRows = sortedRows
    .map((row) => {
      // For fixed salary, show "Fixed Salary" as hours display; students show 80h
      const hoursDisplay = row.isFixedSalary
        ? `Fixed: ${formatCurrency(Number.parseFloat(row.localFixedSalaryAmount) || 0)}`
        : String(row.isStudent ? 80 : Number.parseFloat(row.localHours) || 0);
      return `
      <tr>
        <td>${row.employee.name}</td>
        <td style="text-align:right;">${hoursDisplay}</td>
      </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${co.name} — Accountant Copy</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #1a1008; background: #fff; padding: 32px; }
    .header { border-bottom: 2px solid ${co.pdfPrimary}; padding-bottom: 16px; margin-bottom: 20px; }
    h1 { font-size: 18px; font-weight: bold; color: ${co.pdfPrimary}; }
    h2 { font-size: 14px; font-weight: 600; color: ${co.pdfAccent}; margin-top: 4px; }
    .period { font-size: 12px; color: ${co.accent}; margin-top: 8px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid ${co.pdfBorder}; padding: 9px 12px; text-align: left; }
    th { background: ${co.pdfPrimary}; color: ${co.primaryFg}; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
    tr:nth-child(even) td { background: ${co.pdfEven}; }
    .footer { margin-top: 32px; font-size: 10px; color: ${co.accent}; text-align: center; border-top: 1px solid ${co.pdfBorder}; padding-top: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${co.name}</h1>
    <h2>Wages Management — Accountant Copy</h2>
    <p class="period">${periodLabel}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Employee Name</th>
        <th style="text-align:right;">Hours / Fixed Salary</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
  <div class="footer">${co.name} Wages Management — Confidential</div>
  <script>window.onafterprint = function() { window.close(); };</script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) {
    toast.error("Pop-up blocked. Please allow pop-ups to generate PDFs.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  win.onafterprint = () => win.close();
  setTimeout(() => win.print(), 500);
}

function printFullSummaryPDF(
  rows: PayrollRow[],
  totalWages: number,
  totalTips: number,
  totalOvertime: number,
  grandTotal: number,
  cashTotal: number,
  startDate: string,
  endDate: string,
  co: CompanyConfig,
  tipsOnly = false,
) {
  const periodLabel =
    startDate && endDate
      ? `Period: ${formatPeriodLabel(startDate, endDate)}`
      : `Date: ${formatDateUK(todayISO())}`;
  const docTitle = tipsOnly
    ? `${co.name} — Tips Summary`
    : `${co.name} — Full Summary`;
  const docHeading = tipsOnly
    ? "Wages Management — Tips Summary"
    : "Wages Management — Full Summary";

  const tableRows = rows
    .map((row) => {
      let mainAmount: number;
      let hoursCell: string;
      if (row.isFixedSalary) {
        mainAmount = Number.parseFloat(row.localFixedSalaryAmount) || 0;
        hoursCell = "<em>Fixed</em>";
      } else {
        const hours = row.isStudent
          ? 80
          : Number.parseFloat(row.localHours) || 0;
        mainAmount = hours * (Number.parseFloat(row.localWageRate) || 0);
        hoursCell = String(hours);
      }
      const tips = Number.parseFloat(row.localTips) || 0;
      const overtimeHrs = row.isStudent
        ? Number.parseFloat(row.localOvertimeHours) || 0
        : 0;
      const overtimeWage = row.isStudent
        ? Number.parseFloat(row.localOvertimeWageRate) || 0
        : 0;
      const overtimeTotal = overtimeHrs * overtimeWage;
      const individualTotal = mainAmount + tips + overtimeTotal;
      const paymentDisplay = row.paymentMethod === "cash" ? "Cash" : "Bank";

      const overtimeSubRow =
        row.isStudent && overtimeHrs > 0
          ? `<tr style="background:#eff6ff; font-size:11px;">
            <td style="padding-left:24px; color:#3b82f6; font-style:italic;">↳ Overtime Hours</td>
            <td style="text-align:right; color:#3b82f6;">${overtimeHrs}h @ £${overtimeWage.toFixed(2)}/h</td>
            <td style="text-align:right;"></td>
            <td style="text-align:right;"></td>
            <td style="text-align:right;"></td>
            <td style="text-align:right; color:#3b82f6;">£${overtimeTotal.toFixed(2)}</td>
            <td style="text-align:center; color:#3b82f6; font-size:10px;">${row.overtimePaymentMethod === "cash" ? "Cash" : "Bank"}</td>
            <td style="text-align:right;"></td>
          </tr>`
          : "";

      return `
      <tr>
        <td>${row.employee.name}${row.isStudent ? ' <span class="student-badge">Student</span>' : ""}${row.isFixedSalary ? ' <span class="fixed-badge">Fixed</span>' : ""}</td>
        <td style="text-align:right;">${hoursCell}</td>
        <td style="text-align:right;">${row.isFixedSalary ? "—" : `£${(Number.parseFloat(row.localWageRate) || 0).toFixed(2)}`}</td>
        <td style="text-align:right;">${row.isFixedSalary ? `£${mainAmount.toFixed(2)}` : `£${mainAmount.toFixed(2)}`}</td>
        <td style="text-align:right;">£${tips.toFixed(2)}</td>
        <td style="text-align:right;">£${overtimeTotal.toFixed(2)}</td>
        <td style="text-align:center; font-size:10px;">${paymentDisplay}</td>
        <td style="text-align:right; font-weight:600;">£${individualTotal.toFixed(2)}</td>
      </tr>
      ${overtimeSubRow}`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${docTitle}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1008; background: #fff; padding: 32px; }
    .header { border-bottom: 2px solid ${co.pdfPrimary}; padding-bottom: 16px; margin-bottom: 20px; }
    h1 { font-size: 18px; font-weight: bold; color: ${co.pdfPrimary}; }
    h2 { font-size: 14px; font-weight: 600; color: ${co.pdfAccent}; margin-top: 4px; }
    .period { font-size: 12px; color: ${co.accent}; margin-top: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th, td { border: 1px solid ${co.pdfBorder}; padding: 8px 10px; text-align: left; }
    th { background: ${co.pdfPrimary}; color: ${co.primaryFg}; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
    tr:nth-child(even) td { background: ${co.pdfEven}; }
    .student-badge { display: inline-block; font-size: 9px; background: #dbeafe; color: #1d4ed8; border-radius: 3px; padding: 1px 4px; margin-left: 4px; font-weight: 600; }
    .fixed-badge { display: inline-block; font-size: 9px; background: #fef3c7; color: #92400e; border-radius: 3px; padding: 1px 4px; margin-left: 4px; font-weight: 600; }
    .summary-box { border: 2px solid ${co.pdfPrimary}; border-radius: 6px; overflow: hidden; }
    .summary-title { background: ${co.pdfPrimary}; color: ${co.primaryFg}; padding: 10px 16px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.08em; }
    .summary-grid { display: grid; grid-template-columns: repeat(5, 1fr); }
    .summary-item { padding: 12px 14px; border-right: 1px solid ${co.pdfBorder}; }
    .summary-item:last-child { border-right: none; background: ${co.pdfEven}; }
    .summary-label { font-size: 10px; color: ${co.accent}; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .summary-value { font-size: 15px; font-weight: bold; color: #1a1008; }
    .summary-item:last-child .summary-value { color: ${co.pdfPrimary}; }
    .footer { margin-top: 24px; font-size: 10px; color: ${co.accent}; text-align: center; border-top: 1px solid ${co.pdfBorder}; padding-top: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${co.name}</h1>
    <h2>${docHeading}</h2>
    <p class="period">${periodLabel}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Employee Name</th>
        <th style="text-align:right;">Hours</th>
        <th style="text-align:right;">Wage Rate</th>
        <th style="text-align:right;">Total Wages</th>
        <th style="text-align:right;">Tips</th>
        <th style="text-align:right;">Overtime</th>
        <th style="text-align:center;">Payment</th>
        <th style="text-align:right;">Individual Total</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
  <div class="summary-box">
    <div class="summary-title">Period Summary</div>
    <div class="summary-grid">
      <div class="summary-item">
        <div class="summary-label">Total Wages</div>
        <div class="summary-value">£${totalWages.toFixed(2)}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Total Tips</div>
        <div class="summary-value">£${totalTips.toFixed(2)}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Overtime Total</div>
        <div class="summary-value">£${totalOvertime.toFixed(2)}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Cash Total</div>
        <div class="summary-value">£${cashTotal.toFixed(2)}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Grand Total</div>
        <div class="summary-value">£${grandTotal.toFixed(2)}</div>
      </div>
    </div>
  </div>
  <div class="footer">${co.name} Wages Management — Confidential</div>
  <script>window.onafterprint = function() { window.close(); };</script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) {
    toast.error("Pop-up blocked. Please allow pop-ups to generate PDFs.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  win.onafterprint = () => win.close();
  setTimeout(() => win.print(), 500);
}

// ─────────────────────────────────────────────
// Tips-Only PDF
// ─────────────────────────────────────────────
function printTipsPDF(
  rows: PayrollRow[],
  _totalWages: number,
  _totalTips: number,
  _totalOvertime: number,
  _grandTotal: number,
  _cashTotal: number,
  startDate: string,
  endDate: string,
  co: CompanyConfig,
) {
  const tipsRows = rows
    .filter((row) => (Number.parseFloat(row.localTips) || 0) > 0)
    .sort((a, b) => a.employee.name.localeCompare(b.employee.name));

  if (tipsRows.length === 0) {
    toast.error("No employees have tips this period.");
    return;
  }

  const periodLabel =
    startDate && endDate
      ? `Period: ${formatPeriodLabel(startDate, endDate)}`
      : `Date: ${formatDateUK(todayISO())}`;

  const tableRows = tipsRows
    .map(
      (row) => `
    <tr>
      <td>${row.employee.name}</td>
      <td style="text-align:right; font-weight:600;">£${(Number.parseFloat(row.localTips) || 0).toFixed(2)}</td>
    </tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${co.name} — Tips Summary</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1008; background: #fff; padding: 32px; }
    .header { border-bottom: 2px solid ${co.pdfPrimary}; padding-bottom: 16px; margin-bottom: 20px; }
    h1 { font-size: 18px; font-weight: bold; color: ${co.pdfPrimary}; }
    h2 { font-size: 14px; font-weight: 600; color: ${co.pdfAccent}; margin-top: 4px; }
    .period { font-size: 12px; color: ${co.accent}; margin-top: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th, td { border: 1px solid ${co.pdfBorder}; padding: 8px 10px; text-align: left; }
    th { background: ${co.pdfPrimary}; color: ${co.primaryFg}; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
    tr:nth-child(even) td { background: ${co.pdfEven}; }
    .footer { margin-top: 24px; font-size: 10px; color: ${co.accent}; text-align: center; border-top: 1px solid ${co.pdfBorder}; padding-top: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${co.name}</h1>
    <h2>Tips Summary</h2>
    <p class="period">${periodLabel}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Employee Name</th>
        <th style="text-align:right;">Tips Earned</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
  <div class="footer">${co.name} Wages Management — Confidential</div>
  <script>window.onafterprint = function() { window.close(); };</script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) {
    toast.error("Pop-up blocked. Please allow pop-ups to generate PDFs.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  win.onafterprint = () => win.close();
  setTimeout(() => win.print(), 500);
}

function printCashTransactionsPDF(
  rows: PayrollRow[],
  startDate: string,
  endDate: string,
  co: CompanyConfig,
  manualCashMap: Record<string, number> = {},
) {
  const regularCashRows = rows
    .filter((row) => row.paymentMethod === "cash")
    .sort((a, b) => a.employee.name.localeCompare(b.employee.name));

  const overtimeCashRows = rows
    .filter(
      (row) =>
        row.isStudent &&
        row.overtimePaymentMethod === "cash" &&
        (Number.parseFloat(row.localOvertimeHours) || 0) > 0,
    )
    .sort((a, b) => a.employee.name.localeCompare(b.employee.name));

  if (regularCashRows.length === 0 && overtimeCashRows.length === 0) {
    toast.error("No cash transactions this period.");
    return;
  }

  const periodLabel =
    startDate && endDate
      ? `Period: ${formatPeriodLabel(startDate, endDate)}`
      : `Date: ${formatDateUK(todayISO())}`;

  const regularTableRows = regularCashRows
    .map((row) => {
      let hoursDisplay: string;
      let rateDisplay: string;
      let totalDisplay: string;
      const tips = Number.parseFloat(row.localTips) || 0;
      const tipsNote = tips > 0 ? ` (+ £${tips.toFixed(2)} tips)` : "";

      if (row.isFixedSalary) {
        const fixed = Number.parseFloat(row.localFixedSalaryAmount) || 0;
        hoursDisplay = "Fixed";
        rateDisplay = "-";
        totalDisplay = `£${fixed.toFixed(2)}${tipsNote}`;
      } else if (row.isStudent) {
        const rate = Number.parseFloat(row.localWageRate) || 0;
        const total = 80 * rate;
        hoursDisplay = "80h";
        rateDisplay = `£${rate.toFixed(2)}/h`;
        totalDisplay = `£${total.toFixed(2)}${tipsNote}`;
      } else {
        const hrs = Number.parseFloat(row.localHours) || 0;
        const rate = Number.parseFloat(row.localWageRate) || 0;
        const total = hrs * rate;
        hoursDisplay = `${hrs}h`;
        rateDisplay = `£${rate.toFixed(2)}/h`;
        totalDisplay = `£${total.toFixed(2)}${tipsNote}`;
      }
      const manualCash = manualCashMap[row.employee.id] || 0;
      const manualDisplay = manualCash > 0 ? `£${manualCash.toFixed(2)}` : "-";
      return `
        <tr>
          <td>${row.employee.name}</td>
          <td style="text-align:center;">${hoursDisplay}</td>
          <td style="text-align:center;">${rateDisplay}</td>
          <td style="text-align:center;">${totalDisplay}</td>
          <td style="text-align:center;background:#fffbeb;">${manualDisplay}</td>
        </tr>`;
    })
    .join("");

  const overtimeTableRows = overtimeCashRows
    .map((row) => {
      const otHrs = Number.parseFloat(row.localOvertimeHours) || 0;
      const otRate = Number.parseFloat(row.localOvertimeWageRate) || 0;
      const otTotal = otHrs * otRate;
      const otManualCash = manualCashMap[row.employee.id] || 0;
      const otManualDisplay =
        otManualCash > 0 ? `£${otManualCash.toFixed(2)}` : "-";
      return `
        <tr>
          <td>${row.employee.name}</td>
          <td style="text-align:center;">${otHrs}h</td>
          <td style="text-align:center;">£${otRate.toFixed(2)}/h</td>
          <td style="text-align:center;">£${otTotal.toFixed(2)}</td>
          <td style="text-align:center;background:#fffbeb;">${otManualDisplay}</td>
        </tr>`;
    })
    .join("");

  const regularCalcTotal = regularCashRows.reduce((sum, row) => {
    if (row.isFixedSalary)
      return sum + (Number.parseFloat(row.localFixedSalaryAmount) || 0);
    const hrs = row.isStudent ? 80 : Number.parseFloat(row.localHours) || 0;
    return sum + hrs * (Number.parseFloat(row.localWageRate) || 0);
  }, 0);
  const regularManualTotal = regularCashRows.reduce(
    (sum, row) => sum + (manualCashMap[row.employee.id] || 0),
    0,
  );
  const regularSection =
    regularCashRows.length > 0
      ? `<h3 style="font-size:13px; font-weight:600; color:${co.pdfPrimary}; margin-bottom:8px;">Regular Cash Wages</h3>
  <table>
    <thead>
      <tr>
        <th>Employee Name</th>
        <th style="text-align:center;">Hours</th>
        <th style="text-align:center;">Wage Rate</th>
        <th style="text-align:center;">Calculated Total</th>
        <th style="text-align:center;background:#fffbeb;color:#92400e;">Manual Cash (Rounded)</th>
      </tr>
    </thead>
    <tbody>${regularTableRows}
      <tr style="font-weight:bold;background:${co.pdfEven};">
        <td colspan="3" style="text-align:right;">Totals</td>
        <td style="text-align:center;">£${regularCalcTotal.toFixed(2)}</td>
        <td style="text-align:center;background:#fffbeb;color:#92400e;">£${regularManualTotal.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>`
      : "";

  const otCalcTotal = overtimeCashRows.reduce((sum, row) => {
    const otHrs = Number.parseFloat(row.localOvertimeHours) || 0;
    const otRate = Number.parseFloat(row.localOvertimeWageRate) || 0;
    return sum + otHrs * otRate;
  }, 0);
  const otManualTotal = overtimeCashRows.reduce(
    (sum, row) => sum + (manualCashMap[row.employee.id] || 0),
    0,
  );
  const overtimeSection =
    overtimeCashRows.length > 0
      ? `<h3 style="font-size:13px; font-weight:600; color:${co.pdfPrimary}; margin-bottom:8px; margin-top:16px;">Cash Overtime</h3>
  <table>
    <thead>
      <tr>
        <th>Employee Name</th>
        <th style="text-align:center;">OT Hours</th>
        <th style="text-align:center;">OT Wage Rate</th>
        <th style="text-align:center;">OT Total</th>
        <th style="text-align:center;background:#fffbeb;color:#92400e;">Manual Cash (Rounded)</th>
      </tr>
    </thead>
    <tbody>${overtimeTableRows}
      <tr style="font-weight:bold;background:${co.pdfEven};">
        <td colspan="3" style="text-align:right;">Totals</td>
        <td style="text-align:center;">£${otCalcTotal.toFixed(2)}</td>
        <td style="text-align:center;background:#fffbeb;color:#92400e;">£${otManualTotal.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>`
      : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${co.name} — Cash Transactions</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1008; background: #fff; padding: 32px; }
    .header { border-bottom: 2px solid ${co.pdfPrimary}; padding-bottom: 16px; margin-bottom: 20px; }
    h1 { font-size: 18px; font-weight: bold; color: ${co.pdfPrimary}; }
    h2 { font-size: 14px; font-weight: 600; color: ${co.pdfAccent}; margin-top: 4px; }
    h3 { margin-bottom: 8px; }
    .period { font-size: 12px; color: ${co.accent}; margin-top: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th, td { border: 1px solid ${co.pdfBorder}; padding: 8px 10px; text-align: left; }
    th { background: ${co.pdfPrimary}; color: ${co.primaryFg}; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
    tr:nth-child(even) td { background: ${co.pdfEven}; }
    .footer { margin-top: 24px; font-size: 10px; color: ${co.accent}; text-align: center; border-top: 1px solid ${co.pdfBorder}; padding-top: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${co.name}</h1>
    <h2>Cash Transactions</h2>
    <p class="period">${periodLabel}</p>
  </div>
  ${regularSection}
  ${overtimeSection}
  <div class="footer">${co.name} Wages Management — Confidential</div>
  <script>window.onafterprint = function() { window.close(); };<\/script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) {
    toast.error("Pop-up blocked. Please allow pop-ups to generate PDFs.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  win.onafterprint = () => win.close();
  setTimeout(() => win.print(), 500);
}

// ─────────────────────────────────────────────
// Payment Method Toggle Button
// ─────────────────────────────────────────────

interface PaymentToggleProps {
  value: "cash" | "bank";
  onChange: () => void;
  label?: string;
}

function PaymentToggle({ value, onChange, label }: PaymentToggleProps) {
  return (
    <button
      type="button"
      onClick={onChange}
      title={label ?? (value === "cash" ? "Cash payment" : "Bank transfer")}
      className={`
        inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold transition-colors min-h-[36px] min-w-[52px]
        ${
          value === "cash"
            ? "bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200"
            : "bg-background text-muted-foreground border-border hover:bg-muted"
        }
      `}
    >
      {value === "cash" ? "Cash" : "Bank"}
    </button>
  );
}

// ─────────────────────────────────────────────
// Company Switcher
// ─────────────────────────────────────────────

interface CompanySwitcherProps {
  activeCompany: CompanyId;
  onSwitch: (id: CompanyId) => void;
}

function CompanySwitcher({ activeCompany, onSwitch }: CompanySwitcherProps) {
  return (
    <div
      className="flex rounded-lg overflow-hidden border border-white/20"
      style={{ backgroundColor: "rgba(0,0,0,0.15)" }}
    >
      {(Object.values(COMPANIES) as CompanyConfig[]).map((co) => (
        <button
          type="button"
          key={co.id}
          onClick={() => onSwitch(co.id)}
          className={`px-4 py-2 text-sm font-semibold transition-colors min-h-[44px] ${
            activeCompany === co.id
              ? "bg-white/20 text-white"
              : "text-white/60 hover:text-white/80 hover:bg-white/10"
          }`}
        >
          {co.name}
        </button>
      ))}
    </div>
  );
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
  const [errors, setErrors] = useState<{ name?: string; wageRate?: string }>(
    {},
  );
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
    const rate = Number.parseFloat(wageRate);
    if (!wageRate || Number.isNaN(rate) || rate <= 0)
      newErrors.wageRate = "Wage rate must be a positive number";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave(name.trim(), Number.parseFloat(wageRate));
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
              style={{ fontSize: "16px" }}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="emp-wage">Hourly Wage Rate (£)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                £
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
                style={{ fontSize: "16px" }}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>
            {errors.wageRate && (
              <p className="text-xs text-destructive">{errors.wageRate}</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="min-h-[44px]"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Quick Entry Panel
// ─────────────────────────────────────────────

interface QuickEntryUpdate {
  hours: string;
  tips: string;
  isStudent: boolean;
  overtimeHours: string;
  overtimeWageRate: string;
  isFixedSalary: boolean;
  fixedSalaryAmount: string;
  paymentMethod: "cash" | "bank";
  overtimePaymentMethod: "cash" | "bank";
}

interface QuickEntryPanelProps {
  rows: PayrollRow[];
  onUpdate: (employeeId: string, update: QuickEntryUpdate) => void;
}

function QuickEntryPanel({ rows, onUpdate }: QuickEntryPanelProps) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [hours, setHours] = useState("0");
  const [tips, setTips] = useState("0");
  const [isStudent, setIsStudent] = useState(false);
  const [overtimeHours, setOvertimeHours] = useState("0");
  const [overtimeWageRate, setOvertimeWageRate] = useState("0");
  const [isFixedSalary, setIsFixedSalary] = useState(false);
  const [fixedSalaryAmount, setFixedSalaryAmount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank">("bank");
  const [overtimePaymentMethod, setOvertimePaymentMethod] = useState<
    "cash" | "bank"
  >("bank");

  function handleSelect(id: string) {
    setSelectedId(id);
    const row = rows.find((r) => r.employee.id === id);
    if (row) {
      setHours(row.localHours);
      setTips(row.localTips);
      setIsStudent(row.isStudent);
      setOvertimeHours(row.localOvertimeHours);
      setOvertimeWageRate(row.localOvertimeWageRate);
      setIsFixedSalary(row.isFixedSalary);
      setFixedSalaryAmount(row.localFixedSalaryAmount);
      setPaymentMethod(row.paymentMethod);
      setOvertimePaymentMethod(row.overtimePaymentMethod);
    }
  }

  function handleStudentChange(checked: boolean) {
    setIsStudent(checked);
    if (checked) setHours("80");
  }

  function handleFixedSalaryChange(checked: boolean) {
    setIsFixedSalary(checked);
  }

  function handleUpdate() {
    if (!selectedId) {
      toast.error("Please select an employee first.");
      return;
    }
    onUpdate(selectedId, {
      hours: isStudent ? "80" : hours,
      tips,
      isStudent,
      overtimeHours,
      overtimeWageRate,
      isFixedSalary,
      fixedSalaryAmount,
      paymentMethod,
      overtimePaymentMethod,
    });
    toast.success("Entry updated");
  }

  return (
    <div className="mb-6 rounded-lg border border-border bg-muted/30 shadow-xs">
      <div className="border-b border-border px-5 py-3 flex items-center gap-2">
        <Zap className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Quick Entry</h2>
        <span className="text-xs text-muted-foreground ml-1 hidden sm:inline">
          — Select an employee to update their hours and tips
        </span>
      </div>
      <div className="px-5 py-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* Employee Select */}
          <div className="flex flex-col gap-1.5 min-w-[160px] flex-1">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Employee
            </Label>
            <Select value={selectedId} onValueChange={handleSelect}>
              <SelectTrigger
                className="h-11 bg-background"
                style={{ fontSize: "16px" }}
              >
                <SelectValue placeholder="Select employee…" />
              </SelectTrigger>
              <SelectContent>
                {rows.map((row) => (
                  <SelectItem key={row.employee.id} value={row.employee.id}>
                    {row.employee.name}
                    {row.isStudent ? " (Student)" : ""}
                    {row.isFixedSalary ? " (Fixed)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fixed Salary Toggle */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Fixed Salary
            </Label>
            <div className="flex h-11 items-center gap-2">
              <Checkbox
                checked={isFixedSalary}
                onCheckedChange={(checked) =>
                  handleFixedSalaryChange(checked === true)
                }
                id="quick-entry-fixed"
                className="h-5 w-5"
              />
              <label
                htmlFor="quick-entry-fixed"
                className="text-sm text-muted-foreground cursor-pointer"
              >
                Fixed
              </label>
            </div>
          </div>

          {/* Fixed Salary Amount (when fixed) */}
          {isFixedSalary && (
            <div className="flex flex-col gap-1.5 w-[120px]">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Amount (£)
              </Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none">
                  £
                </span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={fixedSalaryAmount}
                  onChange={(e) => setFixedSalaryAmount(e.target.value)}
                  className="h-11 pl-6 font-mono bg-background"
                  style={{ fontSize: "16px" }}
                />
              </div>
            </div>
          )}

          {/* Hours (disabled when fixed or student) */}
          {!isFixedSalary && (
            <div className="flex flex-col gap-1.5 w-[100px]">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Hours
              </Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={hours}
                disabled={isStudent}
                onChange={(e) => setHours(e.target.value)}
                className="h-11 font-mono bg-background text-center"
                style={{ fontSize: "16px" }}
              />
            </div>
          )}

          {/* Tips */}
          <div className="flex flex-col gap-1.5 w-[100px]">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Tips (£)
            </Label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none">
                £
              </span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={tips}
                onChange={(e) => setTips(e.target.value)}
                className="h-11 pl-6 font-mono bg-background"
                style={{ fontSize: "16px" }}
              />
            </div>
          </div>

          {/* Payment Method */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Payment
            </Label>
            <div className="flex h-11 items-center">
              <PaymentToggle
                value={paymentMethod}
                onChange={() =>
                  setPaymentMethod((p) => (p === "cash" ? "bank" : "cash"))
                }
                label="Toggle main payment method"
              />
            </div>
          </div>

          {/* Student */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Student
            </Label>
            <div className="flex h-11 items-center gap-2">
              <Checkbox
                checked={isStudent}
                onCheckedChange={(checked) =>
                  handleStudentChange(checked === true)
                }
                id="quick-entry-student"
                className="h-5 w-5"
              />
              <label
                htmlFor="quick-entry-student"
                className="text-sm text-muted-foreground cursor-pointer"
              >
                80h Fixed
              </label>
            </div>
          </div>

          {/* Overtime (only when student) */}
          {isStudent && (
            <>
              <div className="flex flex-col gap-1.5 w-[100px]">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  OT Hours
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={overtimeHours}
                  onChange={(e) => setOvertimeHours(e.target.value)}
                  className="h-11 font-mono bg-background text-center"
                  style={{ fontSize: "16px" }}
                />
              </div>
              <div className="flex flex-col gap-1.5 w-[110px]">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  OT Rate (£)
                </Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none">
                    £
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={overtimeWageRate}
                    onChange={(e) => setOvertimeWageRate(e.target.value)}
                    className="h-11 pl-6 font-mono bg-background"
                    style={{ fontSize: "16px" }}
                  />
                </div>
              </div>
              {/* OT Payment Method */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  OT Payment
                </Label>
                <div className="flex h-11 items-center">
                  <PaymentToggle
                    value={overtimePaymentMethod}
                    onChange={() =>
                      setOvertimePaymentMethod((p) =>
                        p === "cash" ? "bank" : "cash",
                      )
                    }
                    label="Toggle overtime payment method"
                  />
                </div>
              </div>
            </>
          )}

          {/* Update Button */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-transparent uppercase tracking-wide select-none">
              &nbsp;
            </Label>
            <Button
              onClick={handleUpdate}
              disabled={!selectedId}
              className="h-11 gap-1.5 min-w-[90px]"
            >
              <CheckCircle2 className="h-4 w-4" />
              Update
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Dashboard View
// ─────────────────────────────────────────────

interface DashboardProps {
  latestPeriod: PayPeriod | null;
  loadingPeriod: boolean;
  onEnterPayroll: () => void;
  company: CompanyConfig;
  activeCompany: CompanyId;
  onCompanySwitch: (id: CompanyId) => void;
  allPeriods: PayPeriod[];
  loadingAllPeriods: boolean;
}

function DashboardView({
  latestPeriod,
  loadingPeriod,
  onEnterPayroll,
  company,
  activeCompany,
  onCompanySwitch,
  allPeriods,
  loadingAllPeriods,
}: DashboardProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header
        style={{ backgroundColor: company.headerBg }}
        className="border-b border-border shadow-xs"
      >
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-md"
                style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
              >
                <Banknote
                  className="h-5 w-5"
                  style={{ color: company.primaryFg }}
                />
              </div>
              <div>
                <h1
                  className="text-xl font-bold tracking-tight"
                  style={{ color: company.primaryFg }}
                >
                  {company.name}
                </h1>
                <p
                  className="text-xs font-medium tracking-wide uppercase"
                  style={{ color: `${company.primaryFg}99` }}
                >
                  {company.subtitle}
                </p>
              </div>
            </div>
            <CompanySwitcher
              activeCompany={activeCompany}
              onSwitch={onCompanySwitch}
            />
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        {/* Welcome Section */}
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-2">
            Welcome back
          </h2>
          <p className="text-muted-foreground text-base">
            Here's a summary of your most recent pay period for{" "}
            <span className="font-semibold text-foreground">
              {company.name}
            </span>
            .
          </p>
        </div>

        {/* Last Pay Period Card */}
        {loadingPeriod ? (
          <div className="rounded-xl border border-border bg-card p-8 shadow-xs mb-8 space-y-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-12 w-48" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
              {["s1", "s2", "s3", "s4"].map((k) => (
                <Skeleton key={k} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          </div>
        ) : latestPeriod ? (
          <div className="rounded-xl border border-border bg-card shadow-xs mb-8 overflow-hidden">
            {/* Card header */}
            <div
              className="px-6 py-4"
              style={{ backgroundColor: company.primary }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p
                    className="text-xs font-semibold uppercase tracking-widest mb-1"
                    style={{ color: `${company.primaryFg}b3` }}
                  >
                    Most Recent Pay Period
                  </p>
                  <div className="flex items-center gap-2">
                    <Calendar
                      className="h-4 w-4"
                      style={{ color: `${company.primaryFg}cc` }}
                    />
                    <span
                      className="font-semibold text-sm"
                      style={{ color: company.primaryFg }}
                    >
                      {latestPeriod._label ||
                        formatPeriodLabel(
                          latestPeriod.startDate,
                          latestPeriod.endDate,
                        )}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className="text-xs uppercase tracking-widest mb-0.5"
                    style={{ color: `${company.primaryFg}b3` }}
                  >
                    Grand Total
                  </p>
                  <p
                    className="font-bold text-3xl font-mono tabular-nums"
                    style={{ color: company.primaryFg }}
                  >
                    {formatCurrency(latestPeriod.grandTotal)}
                  </p>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-border">
              <div className="px-5 py-5">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Total Wages
                  </p>
                </div>
                <p className="font-mono text-xl font-bold tabular-nums text-foreground">
                  {formatCurrency(latestPeriod.totalWages)}
                </p>
              </div>
              <div className="px-5 py-5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Heart className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Total Tips
                  </p>
                </div>
                <p className="font-mono text-xl font-bold tabular-nums text-foreground">
                  {formatCurrency(latestPeriod.totalTips)}
                </p>
              </div>
              <div className="px-5 py-5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Overtime
                  </p>
                </div>
                <p className="font-mono text-xl font-bold tabular-nums text-foreground">
                  {formatCurrency(latestPeriod.overtimeTotal)}
                </p>
              </div>
              <div className="px-5 py-5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Cash Total
                  </p>
                </div>
                <p className="font-mono text-xl font-bold tabular-nums text-amber-700">
                  {formatCurrency(latestPeriod.cashTotal ?? 0)}
                </p>
              </div>
              <div className="px-5 py-5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Employees
                  </p>
                </div>
                <p className="font-mono text-xl font-bold tabular-nums text-foreground">
                  {Number(latestPeriod.employeeCount)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-12 shadow-xs mb-8 text-center">
            <div className="flex flex-col items-center gap-4 text-muted-foreground">
              <div className="rounded-full bg-muted p-4">
                <Banknote className="h-8 w-8 opacity-50" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-lg">
                  No pay periods saved yet
                </p>
                <p className="text-sm mt-1">
                  Enter your first payroll to see a summary here.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Monthly Labour Cost Chart */}
        <div className="mb-10 rounded-xl border border-border bg-card shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Monthly Labour Cost
            </h3>
          </div>
          <div className="p-6">
            {loadingAllPeriods ? (
              <div className="flex items-center justify-center h-[300px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : allPeriods.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground gap-2">
                <TrendingUp className="h-10 w-10 opacity-20" />
                <p className="text-sm font-medium">No pay periods saved yet</p>
                <p className="text-xs">
                  Save a pay period to see labour cost trends
                </p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={[...allPeriods]
                      .sort((a, b) => a.startDate.localeCompare(b.startDate))
                      .map((p) => ({
                        name: p.startDate
                          ? `${p.startDate.slice(5, 7)}/${p.startDate.slice(2, 4)}`
                          : p._label.slice(0, 5),
                        grandTotal: p.grandTotal,
                        wages: p.totalWages,
                        tips: p.totalTips,
                      }))}
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(0,0,0,0.06)"
                    />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis
                      tickFormatter={(v) => `£${v}`}
                      tick={{ fontSize: 11 }}
                    />
                    <RechartsTooltip
                      formatter={(value: number) => [
                        `£${value.toFixed(2)}`,
                        undefined,
                      ]}
                    />
                    <Bar
                      dataKey="grandTotal"
                      name="Grand Total"
                      fill={company.primary}
                      radius={[3, 3, 0, 0]}
                    />
                    <Bar
                      dataKey="wages"
                      name="Wages"
                      fill={company.accent}
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-6 mt-3">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: company.primary }}
                    />
                    <span className="text-xs text-muted-foreground">
                      Grand Total
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: company.accent }}
                    />
                    <span className="text-xs text-muted-foreground">Wages</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={onEnterPayroll}
            className="h-14 px-10 text-base font-semibold gap-2 min-w-[220px]"
            style={{
              backgroundColor: company.primary,
              color: company.primaryFg,
            }}
          >
            <Banknote className="h-5 w-5" />
            Enter Payroll
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-5 text-center text-xs text-muted-foreground">
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
    </div>
  );
}

// ─────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────

export default function App() {
  const { actor, isFetching: actorFetching } = useActor();

  // Lock screen state
  const [locked, setLocked] = useState<boolean>(
    () => sessionStorage.getItem("unlocked") !== "true",
  );
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState(false);

  function handleUnlock() {
    if (pinValue === "0262") {
      sessionStorage.setItem("unlocked", "true");
      setLocked(false);
      setPinError(false);
    } else {
      setPinError(true);
      setPinValue("");
    }
  }

  // Company state
  const [activeCompany, setActiveCompany] = useState<CompanyId>("bezendi");
  const company = COMPANIES[activeCompany];

  // View state
  const [view, setView] = useState<AppView>("dashboard");

  // Dashboard
  const [latestPeriod, setLatestPeriod] = useState<PayPeriod | null>(null);
  const [loadingPeriod, setLoadingPeriod] = useState(true);

  const [allPeriods, setAllPeriods] = useState<PayPeriod[]>([]);
  const [loadingAllPeriods, setLoadingAllPeriods] = useState(true);
  const [savingPeriod, setSavingPeriod] = useState(false);

  // Payroll rows
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Date range for current pay period
  const [periodStart, setPeriodStart] = useState(() => {
    try {
      return localStorage.getItem("payroll_period_start_bezendi") || "";
    } catch {
      return "";
    }
  });
  const [periodEnd, setPeriodEnd] = useState(() => {
    try {
      return localStorage.getItem("payroll_period_end_bezendi") || "";
    } catch {
      return "";
    }
  });

  // Sort state
  const [sortAlpha, setSortAlpha] = useState(false);

  // Add/Edit dialogs
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(
    null,
  );

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<string | null>(
    null,
  );
  const [deleteInProgress, setDeleteInProgress] = useState(false);

  // Clear pay period
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearInProgress, setClearInProgress] = useState(false);

  // Save debounce timers
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Company switch handler ─────────────────

  function handleCompanySwitch(id: CompanyId) {
    setActiveCompany(id);
    setRows([]);
    setLatestPeriod(null);
    try {
      setPeriodStart(localStorage.getItem(`payroll_period_start_${id}`) || "");
      setPeriodEnd(localStorage.getItem(`payroll_period_end_${id}`) || "");
    } catch {
      setPeriodStart("");
      setPeriodEnd("");
    }
  }

  // ── Load data ──────────────────────────────

  const loadData = useCallback(async () => {
    if (!actor) return;
    setLoading(true);
    setLoadingPeriod(true);
    setLoadError(null);

    const delay = (ms: number) =>
      new Promise<void>((res) => setTimeout(res, ms));
    let lastErr: unknown;

    for (let attempt = 0; attempt < 6; attempt++) {
      if (attempt > 0) await delay(Math.min(attempt * 2000, 10000));
      try {
        const [employees, entries, period] = await Promise.all([
          actor.listEmployees(activeCompany),
          actor.listPayrollEntries(activeCompany),
          actor.getLatestPayPeriod(activeCompany),
        ]);

        setLatestPeriod(period);

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
              return actor.createPayrollEntry(
                activeCompany,
                id,
                emp.id,
                0,
                0,
                false,
                0,
                emp.wageRate,
                false,
                0,
                "bank",
                "bank",
              );
            }),
          );
          const updatedEntries = await actor.listPayrollEntries(activeCompany);
          for (const entry of updatedEntries) {
            entryMap.set(entry.employeeId, entry);
          }
        }

        // Also load all periods for the chart
        try {
          const periodsResult = await actor.listPayPeriods(activeCompany);
          setAllPeriods(periodsResult);
          setLoadingAllPeriods(false);
        } catch (_) {
          setLoadingAllPeriods(false);
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
            localOvertimeHours: entry ? String(entry.overtimeHours) : "0",
            localOvertimeWageRate: entry
              ? String(entry.overtimeWageRate)
              : String(emp.wageRate),
            isFixedSalary: entry ? (entry.isFixedSalary ?? false) : false,
            localFixedSalaryAmount: entry
              ? String(entry.fixedSalaryAmount ?? 0)
              : "0",
            paymentMethod: (entry?.paymentMethod as "cash" | "bank") || "bank",
            overtimePaymentMethod:
              (entry?.overtimePaymentMethod as "cash" | "bank") || "bank",
            includeInAccountantPDF: true,
            localManualCash: "",
            saving: false,
            savedAt: null,
          };
        });

        setRows(newRows);
        setLoading(false);
        setLoadingPeriod(false);
        // Save to local cache so data is available if connection fails later
        try {
          localStorage.setItem(
            `payroll_cache_${activeCompany}`,
            JSON.stringify({
              rows: newRows.map((r) => ({
                ...r,
                saving: false,
                savedAt: null,
              })),
              period,
            }),
          );
        } catch (_) {}
        return;
      } catch (err) {
        console.error(`Load attempt ${attempt + 1} failed:`, err);
        lastErr = err;
      }
    }

    // All retries exhausted -- try local cache
    console.error("All load attempts failed:", lastErr);
    let cached: { rows: PayrollRow[]; period: PayPeriod | null } | null = null;
    try {
      const raw = localStorage.getItem(`payroll_cache_${activeCompany}`);
      if (raw) cached = JSON.parse(raw);
    } catch (_) {}
    if (cached && cached.rows.length > 0) {
      setRows(
        cached.rows.map((r: PayrollRow) => ({
          ...r,
          includeInAccountantPDF: r.includeInAccountantPDF ?? true,
          localManualCash: r.localManualCash ?? "",
        })),
      );
      setLatestPeriod(cached.period);
      setLoadError(
        "Showing your last saved data (offline). Tap Retry to reconnect.",
      );
    } else {
      setLoadError(
        "Unable to connect to server. Please check your internet connection and tap Retry.",
      );
    }
    setLoading(false);
    setLoadingPeriod(false);
  }, [actor, activeCompany]);

  useEffect(() => {
    if (actor && !actorFetching) {
      loadData();
    }
  }, [actor, actorFetching, loadData]);

  // ── Persist period dates to localStorage ──

  useEffect(() => {
    try {
      localStorage.setItem(
        `payroll_period_start_${activeCompany}`,
        periodStart,
      );
      localStorage.setItem(`payroll_period_end_${activeCompany}`, periodEnd);
    } catch (_) {}
  }, [periodStart, periodEnd, activeCompany]);

  // ── Manual cash change handler ─────────────

  function handleManualCashChange(employeeId: string, value: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.employee.id === employeeId ? { ...r, localManualCash: value } : r,
      ),
    );
  }

  // ── Save Period ────────────────────────────

  async function handleSavePeriod() {
    if (!actor || !periodStart || !periodEnd) {
      toast.error("Please set a pay period date range first");
      return;
    }
    setSavingPeriod(true);
    try {
      await actor.savePayPeriod(
        activeCompany,
        crypto.randomUUID(),
        periodStart,
        periodEnd,
        formatPeriodLabel(periodStart, periodEnd),
        computedTotalWages,
        computedTotalTips,
        computedTotalOvertime,
        computedGrandTotal,
        computedCashTotal,
        BigInt(rows.length),
      );
      const [newPeriod, newAllPeriods] = await Promise.all([
        actor.getLatestPayPeriod(activeCompany),
        actor.listPayPeriods(activeCompany),
      ]);
      setLatestPeriod(
        Array.isArray(newPeriod) ? (newPeriod[0] ?? null) : (newPeriod ?? null),
      );
      setAllPeriods(newAllPeriods);
      toast.success("Pay period saved to cloud");
    } catch (err) {
      console.error("Save period failed:", err);
      toast.error("Failed to save pay period. Please try again.");
    } finally {
      setSavingPeriod(false);
    }
  }

  // ── Sorted rows ────────────────────────────

  const displayRows = sortAlpha
    ? [...rows].sort((a, b) => a.employee.name.localeCompare(b.employee.name))
    : rows;

  // ── Row update helpers ─────────────────────

  function updateRow(employeeId: string, patch: Partial<PayrollRow>) {
    setRows((prev) =>
      prev.map((r) => (r.employee.id === employeeId ? { ...r, ...patch } : r)),
    );
  }

  async function persistRow(row: PayrollRow) {
    if (!actor || !row.payrollEntry) return;
    const empId = row.employee.id;
    updateRow(empId, { saving: true });
    try {
      const hours = row.isStudent ? 80 : Number.parseFloat(row.localHours) || 0;
      const tips = Number.parseFloat(row.localTips) || 0;
      const wageRate = Number.parseFloat(row.localWageRate) || 0;
      const overtimeHours = Number.parseFloat(row.localOvertimeHours) || 0;
      const overtimeWageRate =
        Number.parseFloat(row.localOvertimeWageRate) || 0;
      const fixedSalaryAmount =
        Number.parseFloat(row.localFixedSalaryAmount) || 0;

      await Promise.all([
        actor.updatePayrollEntry(
          activeCompany,
          row.payrollEntry.id,
          empId,
          hours,
          tips,
          row.isStudent,
          overtimeHours,
          overtimeWageRate,
          row.isFixedSalary,
          fixedSalaryAmount,
          row.paymentMethod,
          row.overtimePaymentMethod,
        ),
        actor.updateEmployee(activeCompany, empId, row.employee.name, wageRate),
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

  // ── Field change handlers ──────────────────

  function handleHoursChange(employeeId: string, value: string) {
    setRows((prev) => {
      const updated = prev.map((r) =>
        r.employee.id !== employeeId ? r : { ...r, localHours: value },
      );
      const row = updated.find((r) => r.employee.id === employeeId);
      if (row) scheduleSave(row);
      return updated;
    });
  }

  function handleHoursBlur(employeeId: string) {
    const row = rows.find((r) => r.employee.id === employeeId);
    if (row) persistRow(row);
  }

  function handleWageRateChange(employeeId: string, value: string) {
    setRows((prev) => {
      const updated = prev.map((r) =>
        r.employee.id !== employeeId ? r : { ...r, localWageRate: value },
      );
      const row = updated.find((r) => r.employee.id === employeeId);
      if (row) scheduleSave(row);
      return updated;
    });
  }

  function handleWageRateBlur(employeeId: string) {
    const row = rows.find((r) => r.employee.id === employeeId);
    if (row) persistRow(row);
  }

  function handleTipsChange(employeeId: string, value: string) {
    setRows((prev) => {
      const updated = prev.map((r) =>
        r.employee.id !== employeeId ? r : { ...r, localTips: value },
      );
      const row = updated.find((r) => r.employee.id === employeeId);
      if (row) scheduleSave(row);
      return updated;
    });
  }

  function handleTipsBlur(employeeId: string) {
    const row = rows.find((r) => r.employee.id === employeeId);
    if (row) persistRow(row);
  }

  function handleOvertimeHoursChange(employeeId: string, value: string) {
    setRows((prev) => {
      const updated = prev.map((r) =>
        r.employee.id !== employeeId ? r : { ...r, localOvertimeHours: value },
      );
      const row = updated.find((r) => r.employee.id === employeeId);
      if (row) scheduleSave(row);
      return updated;
    });
  }

  function handleOvertimeHoursBlur(employeeId: string) {
    const row = rows.find((r) => r.employee.id === employeeId);
    if (row) persistRow(row);
  }

  function handleOvertimeWageRateChange(employeeId: string, value: string) {
    setRows((prev) => {
      const updated = prev.map((r) =>
        r.employee.id !== employeeId
          ? r
          : { ...r, localOvertimeWageRate: value },
      );
      const row = updated.find((r) => r.employee.id === employeeId);
      if (row) scheduleSave(row);
      return updated;
    });
  }

  function handleOvertimeWageRateBlur(employeeId: string) {
    const row = rows.find((r) => r.employee.id === employeeId);
    if (row) persistRow(row);
  }

  function handleStudentToggle(employeeId: string, checked: boolean) {
    setRows((prev) => {
      const updated = prev.map((r) => {
        if (r.employee.id !== employeeId) return r;
        return {
          ...r,
          isStudent: checked,
          localHours: checked ? "80" : r.localHours,
          // Default overtime wage rate to employee's wage rate when first enabling
          localOvertimeWageRate:
            checked && r.localOvertimeWageRate === "0"
              ? r.localWageRate
              : r.localOvertimeWageRate,
        };
      });
      const row = updated.find((r) => r.employee.id === employeeId);
      if (row) persistRow(row);
      return updated;
    });
  }

  function handleFixedSalaryToggle(employeeId: string, checked: boolean) {
    setRows((prev) => {
      const updated = prev.map((r) => {
        if (r.employee.id !== employeeId) return r;
        return { ...r, isFixedSalary: checked };
      });
      const row = updated.find((r) => r.employee.id === employeeId);
      if (row) scheduleSave(row);
      return updated;
    });
  }

  function handleFixedSalaryAmountChange(employeeId: string, value: string) {
    setRows((prev) => {
      const updated = prev.map((r) =>
        r.employee.id !== employeeId
          ? r
          : { ...r, localFixedSalaryAmount: value },
      );
      const row = updated.find((r) => r.employee.id === employeeId);
      if (row) scheduleSave(row);
      return updated;
    });
  }

  function handleFixedSalaryAmountBlur(employeeId: string) {
    const row = rows.find((r) => r.employee.id === employeeId);
    if (row) persistRow(row);
  }

  function handlePaymentMethodToggle(employeeId: string) {
    setRows((prev) => {
      const updated = prev.map((r) => {
        if (r.employee.id !== employeeId) return r;
        return {
          ...r,
          paymentMethod:
            r.paymentMethod === "cash" ? "bank" : ("cash" as "cash" | "bank"),
        };
      });
      const row = updated.find((r) => r.employee.id === employeeId);
      if (row) persistRow(row);
      return updated;
    });
  }

  function handleOvertimePaymentMethodToggle(employeeId: string) {
    setRows((prev) => {
      const updated = prev.map((r) => {
        if (r.employee.id !== employeeId) return r;
        return {
          ...r,
          overtimePaymentMethod:
            r.overtimePaymentMethod === "cash"
              ? "bank"
              : ("cash" as "cash" | "bank"),
        };
      });
      const row = updated.find((r) => r.employee.id === employeeId);
      if (row) persistRow(row);
      return updated;
    });
  }

  // ── Quick Entry update ─────────────────────

  function handleQuickEntryUpdate(
    employeeId: string,
    update: QuickEntryUpdate,
  ) {
    setRows((prev) => {
      const updated = prev.map((r) => {
        if (r.employee.id !== employeeId) return r;
        return {
          ...r,
          localHours: update.hours,
          localTips: update.tips,
          isStudent: update.isStudent,
          localOvertimeHours: update.overtimeHours,
          localOvertimeWageRate: update.overtimeWageRate,
          isFixedSalary: update.isFixedSalary,
          localFixedSalaryAmount: update.fixedSalaryAmount,
          paymentMethod: update.paymentMethod,
          overtimePaymentMethod: update.overtimePaymentMethod,
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
    const delay = (ms: number) =>
      new Promise<void>((res) => setTimeout(res, ms));
    let lastErr: unknown;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt > 0) await delay(attempt * 2000);
      try {
        await actor.createEmployee(activeCompany, empId, name, wageRate);
        await actor.createPayrollEntry(
          activeCompany,
          entryId,
          empId,
          0,
          0,
          false,
          0,
          wageRate,
          false,
          0,
          "bank",
          "bank",
        );
        const newEmployee: Employee = { id: empId, name, wageRate };
        const newEntry: PayrollEntry = {
          id: entryId,
          employeeId: empId,
          hoursWorked: 0,
          tipsEarned: 0,
          isStudent: false,
          totalWages: 0,
          overtimeHours: 0,
          overtimeWageRate: wageRate,
          overtimeTotal: 0,
          isFixedSalary: false,
          fixedSalaryAmount: 0,
          paymentMethod: "bank",
          overtimePaymentMethod: "bank",
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
            localOvertimeHours: "0",
            localOvertimeWageRate: String(wageRate),
            isFixedSalary: false,
            localFixedSalaryAmount: "0",
            paymentMethod: "bank",
            overtimePaymentMethod: "bank",
            includeInAccountantPDF: true,
            localManualCash: "",
            saving: false,
            savedAt: null,
          },
        ]);
        toast.success(`${name} added successfully`);
        return;
      } catch (err) {
        lastErr = err;
        console.error(`Add employee attempt ${attempt + 1} failed:`, err);
      }
    }
    console.error(lastErr);
    toast.error("Failed to add employee. Please try again.");
  }

  // ── Edit employee ──────────────────────────

  const editingRow = editingEmployeeId
    ? rows.find((r) => r.employee.id === editingEmployeeId)
    : null;

  async function handleEditEmployee(name: string, wageRate: number) {
    if (!actor || !editingEmployeeId) return;
    try {
      await actor.updateEmployee(
        activeCompany,
        editingEmployeeId,
        name,
        wageRate,
      );
      setRows((prev) =>
        prev.map((r) => {
          if (r.employee.id !== editingEmployeeId) return r;
          return {
            ...r,
            employee: { ...r.employee, name, wageRate },
            localWageRate: String(wageRate),
          };
        }),
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
      const deleteOps: Promise<void>[] = [
        actor.deleteEmployee(activeCompany, deletingEmployeeId),
      ];
      if (row?.payrollEntry) {
        deleteOps.push(
          actor.deletePayrollEntry(activeCompany, row.payrollEntry.id),
        );
      }
      await Promise.all(deleteOps);
      setRows((prev) =>
        prev.filter((r) => r.employee.id !== deletingEmployeeId),
      );
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

  // ── Totals ─────────────────────────────────

  const computedTotalWages = rows.reduce((sum, r) => {
    if (r.isFixedSalary) {
      return sum + (Number.parseFloat(r.localFixedSalaryAmount) || 0);
    }
    const hours = r.isStudent ? 80 : Number.parseFloat(r.localHours) || 0;
    return sum + hours * (Number.parseFloat(r.localWageRate) || 0);
  }, 0);

  const computedTotalTips = rows.reduce(
    (sum, r) => sum + (Number.parseFloat(r.localTips) || 0),
    0,
  );

  const computedTotalOvertime = rows.reduce((sum, r) => {
    if (!r.isStudent) return sum;
    return (
      sum + calcOvertimeTotal(r.localOvertimeHours, r.localOvertimeWageRate)
    );
  }, 0);

  const computedGrandTotal =
    computedTotalWages + computedTotalTips + computedTotalOvertime;

  const computedCashTotal = computedCashTotalFromRows(rows);

  // ── Clear pay period ───────────────────────

  async function handleClearPayPeriod() {
    if (!actor) return;
    setClearInProgress(true);
    try {
      // Save current period before clearing
      const periodId = crypto.randomUUID();
      const label =
        periodStart && periodEnd
          ? formatPeriodLabel(periodStart, periodEnd)
          : `Cleared ${formatDateUK(todayISO())}`;

      await actor.savePayPeriod(
        activeCompany,
        periodId,
        periodStart || todayISO(),
        periodEnd || todayISO(),
        label,
        computedTotalWages,
        computedTotalTips,
        computedTotalOvertime,
        computedGrandTotal,
        computedCashTotal,
        BigInt(rows.length),
      );

      // Clear all entries
      await actor.clearPayrollEntries(activeCompany);

      // Re-create entries at zero
      const newEntries = await Promise.all(
        rows.map(async (row) => {
          const id = crypto.randomUUID();
          await actor.createPayrollEntry(
            activeCompany,
            id,
            row.employee.id,
            0,
            0,
            false,
            0,
            row.employee.wageRate,
            false,
            0,
            "bank",
            "bank",
          );
          return { employeeId: row.employee.id, entryId: id };
        }),
      );
      const entryMap = new Map(
        newEntries.map((e) => [e.employeeId, e.entryId]),
      );

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
            overtimeHours: 0,
            overtimeWageRate: r.employee.wageRate,
            overtimeTotal: 0,
            isFixedSalary: false,
            fixedSalaryAmount: 0,
            paymentMethod: "bank",
            overtimePaymentMethod: "bank",
          },
          localHours: "0",
          localTips: "0",
          isStudent: false,
          localOvertimeHours: "0",
          localOvertimeWageRate: String(r.employee.wageRate),
          isFixedSalary: false,
          localFixedSalaryAmount: "0",
          paymentMethod: "bank" as "cash" | "bank",
          overtimePaymentMethod: "bank" as "cash" | "bank",
          includeInAccountantPDF: true,
          saving: false,
          savedAt: null,
        })),
      );

      // Refresh latest period
      const updatedPeriod = await actor.getLatestPayPeriod(activeCompany);
      setLatestPeriod(updatedPeriod);

      setPeriodStart("");
      setPeriodEnd("");
      setClearConfirmOpen(false);
      toast.success("Pay period saved and cleared — ready for next period");
      setView("dashboard");
    } catch (err) {
      console.error(err);
      toast.error("Failed to clear pay period");
    } finally {
      setClearInProgress(false);
    }
  }

  // ── Render actors loading ──────────────────

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

  // ── Dashboard View ─────────────────────────

  if (view === "dashboard") {
    return (
      <>
        <Toaster position="top-right" richColors />
        <DashboardView
          latestPeriod={latestPeriod}
          loadingPeriod={loadingPeriod}
          onEnterPayroll={() => setView("payroll")}
          company={company}
          activeCompany={activeCompany}
          onCompanySwitch={handleCompanySwitch}
          allPeriods={allPeriods}
          loadingAllPeriods={loadingAllPeriods}
        />
      </>
    );
  }

  // ── Payroll Entry View ─────────────────────

  if (locked) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#2a1c10" }}
      >
        <div
          className="w-full max-w-sm mx-4 rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-6"
          style={{ backgroundColor: "#3d2b1a" }}
        >
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mb-1"
              style={{ backgroundColor: "#9b8578" }}
            >
              <Lock size={28} stroke="#3d2b1a" strokeWidth={2.5} />
            </div>
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: "#f5ede6" }}
            >
              Payroll Manager
            </h1>
            <p className="text-sm" style={{ color: "#9b8578" }}>
              Enter your PIN to continue
            </p>
          </div>

          <div className="w-full flex flex-col gap-3">
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="• • • •"
              value={pinValue}
              onChange={(e) => {
                setPinError(false);
                setPinValue(e.target.value.replace(/\D/g, "").slice(0, 4));
              }}
              onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
              data-ocid="lock.input"
              className="w-full text-center text-2xl tracking-[0.5em] rounded-lg px-4 py-3 border outline-none focus:ring-2 transition"
              style={{
                backgroundColor: "#2a1c10",
                color: "#f5ede6",
                borderColor: pinError ? "#e05555" : "#6b4c38",
                caretColor: "#9b8578",
              }}
            />
            {pinError && (
              <p
                className="text-center text-sm font-medium"
                style={{ color: "#e05555" }}
                data-ocid="lock.error_state"
              >
                Incorrect PIN. Please try again.
              </p>
            )}
            <button
              type="button"
              onClick={handleUnlock}
              data-ocid="lock.primary_button"
              className="w-full py-3 rounded-lg font-semibold text-base transition hover:opacity-90 active:scale-95"
              style={{ backgroundColor: "#9b8578", color: "#2a1c10" }}
            >
              Unlock
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" richColors />

      {/* ── Header ── */}
      <header
        className="no-print border-b border-border shadow-xs"
        style={{ backgroundColor: company.headerBg }}
      >
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setView("dashboard")}
                className="h-9 w-9 mr-1 hover:bg-white/10"
                style={{ color: company.primaryFg }}
                aria-label="Back to Dashboard"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div
                className="flex h-9 w-9 items-center justify-center rounded-md"
                style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
              >
                <Banknote
                  className="h-5 w-5"
                  style={{ color: company.primaryFg }}
                />
              </div>
              <div>
                <h1
                  className="text-lg font-bold tracking-tight leading-tight"
                  style={{ color: company.primaryFg }}
                >
                  {company.name}
                </h1>
                <p
                  className="text-xs font-medium tracking-wide uppercase leading-tight"
                  style={{ color: `${company.primaryFg}99` }}
                >
                  {company.subtitle}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <CompanySwitcher
                activeCompany={activeCompany}
                onSwitch={handleCompanySwitch}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 action-buttons">
              <Button
                onClick={() => setAddDialogOpen(true)}
                className="gap-1.5 min-h-[44px]"
                size="sm"
                style={{
                  backgroundColor: "rgba(255,255,255,0.2)",
                  color: company.primaryFg,
                  borderColor: "rgba(255,255,255,0.3)",
                }}
                variant="outline"
              >
                <Plus className="h-4 w-4" />
                Add Employee
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 min-h-[44px]"
                style={{
                  backgroundColor: "rgba(255,255,255,0.1)",
                  color: company.primaryFg,
                  borderColor: "rgba(255,255,255,0.25)",
                }}
                onClick={() => setClearConfirmOpen(true)}
              >
                <RefreshCw className="h-4 w-4" />
                Clear Period
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 min-h-[44px]"
                style={{
                  backgroundColor: "rgba(255,255,255,0.15)",
                  color: company.primaryFg,
                  borderColor: "rgba(255,255,255,0.35)",
                }}
                onClick={handleSavePeriod}
                disabled={savingPeriod || !periodStart || !periodEnd}
                data-ocid="payroll.save_period.button"
              >
                {savingPeriod ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {savingPeriod ? "Saving…" : "Save Period"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 min-h-[44px]"
                style={{
                  backgroundColor: "rgba(255,255,255,0.1)",
                  color: company.primaryFg,
                  borderColor: "rgba(255,255,255,0.25)",
                }}
                onClick={() =>
                  printAccountantPDF(
                    displayRows,
                    periodStart,
                    periodEnd,
                    company,
                  )
                }
              >
                <BookOpen className="h-4 w-4" />
                Accountant PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 min-h-[44px]"
                style={{
                  backgroundColor: "rgba(255,255,255,0.1)",
                  color: company.primaryFg,
                  borderColor: "rgba(255,255,255,0.25)",
                }}
                onClick={() =>
                  printFullSummaryPDF(
                    displayRows,
                    computedTotalWages,
                    computedTotalTips,
                    computedTotalOvertime,
                    computedGrandTotal,
                    computedCashTotal,
                    periodStart,
                    periodEnd,
                    company,
                  )
                }
              >
                <FileText className="h-4 w-4" />
                Full Summary PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 min-h-[44px]"
                style={{
                  backgroundColor: "rgba(255,255,255,0.1)",
                  color: company.primaryFg,
                  borderColor: "rgba(255,255,255,0.25)",
                }}
                onClick={() =>
                  printTipsPDF(
                    displayRows,
                    computedTotalWages,
                    computedTotalTips,
                    computedTotalOvertime,
                    computedGrandTotal,
                    computedCashTotal,
                    periodStart,
                    periodEnd,
                    company,
                  )
                }
              >
                <Coins className="h-4 w-4" />
                Tips PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 min-h-[44px]"
                style={{
                  backgroundColor: "rgba(255,255,255,0.1)",
                  color: company.primaryFg,
                  borderColor: "rgba(255,255,255,0.25)",
                }}
                onClick={() => {
                  const manualCashMap: Record<string, number> = {};
                  for (const r of displayRows) {
                    manualCashMap[r.employee.id] =
                      Number.parseFloat(r.localManualCash) || 0;
                  }
                  printCashTransactionsPDF(
                    displayRows,
                    periodStart,
                    periodEnd,
                    company,
                    manualCashMap,
                  );
                }}
              >
                <Banknote className="h-4 w-4" />
                Cash PDF
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Error state */}
        {loadError && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-3">
            <span>{loadError}</span>
            <button
              type="button"
              onClick={loadData}
              className="ml-auto underline hover:no-underline font-medium min-h-[44px] px-2"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Date Range ── */}
        <div className="mb-5 rounded-lg border border-border bg-card shadow-xs p-4">
          <div className="flex flex-wrap items-end gap-4">
            <Calendar className="h-4 w-4 text-muted-foreground self-center mt-4 hidden sm:block" />
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="period-start"
                className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
              >
                Period From
              </Label>
              <Input
                id="period-start"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="h-11 font-mono bg-background w-[160px]"
                style={{ fontSize: "16px" }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="period-end"
                className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
              >
                Period To
              </Label>
              <Input
                id="period-end"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="h-11 font-mono bg-background w-[160px]"
                style={{ fontSize: "16px" }}
              />
            </div>
            {periodStart && periodEnd && (
              <p className="text-sm font-medium text-foreground self-end pb-2.5">
                {formatPeriodLabel(periodStart, periodEnd)}
              </p>
            )}
          </div>
        </div>

        {/* ── Quick Entry Panel ── */}
        {!loading && rows.length > 0 && (
          <QuickEntryPanel rows={rows} onUpdate={handleQuickEntryUpdate} />
        )}

        {/* ── Sort toggle ── */}
        {!loading && rows.length > 1 && (
          <div className="mb-3 flex items-center justify-end">
            <Button
              variant={sortAlpha ? "default" : "outline"}
              size="sm"
              className="gap-1.5 min-h-[44px]"
              onClick={() => setSortAlpha((v) => !v)}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Sort A–Z
            </Button>
          </div>
        )}

        {/* ── Payroll Table ── */}
        <div
          className="payroll-table-container rounded-lg border border-border bg-card shadow-xs overflow-hidden"
          style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-[50px] text-center font-semibold text-foreground no-print">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[10px] leading-tight text-muted-foreground">
                        Acct.
                      </span>
                      <Checkbox
                        checked={
                          displayRows.length > 0 &&
                          displayRows.every((r) => r.includeInAccountantPDF)
                        }
                        onCheckedChange={(checked) => {
                          setRows((prev) =>
                            prev.map((r) => ({
                              ...r,
                              includeInAccountantPDF: !!checked,
                            })),
                          );
                        }}
                        aria-label="Select all for accountant PDF"
                        data-ocid="acct_pdf.checkbox"
                      />
                    </div>
                  </TableHead>
                  <TableHead className="w-[180px] font-semibold text-foreground">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      Employee
                    </div>
                  </TableHead>
                  <TableHead className="w-[120px] text-right font-semibold text-foreground">
                    Wage Rate
                  </TableHead>
                  <TableHead className="w-[120px] text-right font-semibold text-foreground">
                    Hours
                  </TableHead>
                  <TableHead className="w-[90px] text-center font-semibold text-foreground">
                    Fixed
                  </TableHead>
                  <TableHead className="w-[100px] text-center font-semibold text-foreground">
                    Student
                  </TableHead>
                  <TableHead className="w-[90px] text-center font-semibold text-foreground">
                    Payment
                  </TableHead>
                  <TableHead className="w-[130px] text-right font-semibold text-foreground">
                    Total Wages
                  </TableHead>
                  <TableHead className="w-[120px] text-right font-semibold text-foreground bg-amber-50/50">
                    Manual £
                  </TableHead>
                  <TableHead className="w-[120px] text-right font-semibold text-foreground">
                    Tips Earned
                  </TableHead>
                  <TableHead className="w-[110px] text-center font-semibold text-foreground no-print">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  ["sk-1", "sk-2", "sk-3"].map((skKey) => (
                    <TableRow key={skKey}>
                      {[
                        "c0",
                        "c1",
                        "c2",
                        "c3",
                        "c4",
                        "c5",
                        "c6",
                        "c7",
                        "c8",
                        "c9",
                        "c10",
                      ].map((cKey) => (
                        <TableCell key={cKey}>
                          <Skeleton className="h-9 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-16 text-center">
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
                  displayRows.map((row) => {
                    const hours = row.isStudent
                      ? 80
                      : Number.parseFloat(row.localHours) || 0;
                    const totalWagesRow = row.isFixedSalary
                      ? Number.parseFloat(row.localFixedSalaryAmount) || 0
                      : hours * (Number.parseFloat(row.localWageRate) || 0);
                    const overtimeTotal = row.isStudent
                      ? calcOvertimeTotal(
                          row.localOvertimeHours,
                          row.localOvertimeWageRate,
                        )
                      : 0;

                    return (
                      <>
                        <TableRow key={row.employee.id} className="payroll-row">
                          {/* Accountant PDF inclusion checkbox */}
                          <TableCell className="text-center no-print">
                            <Checkbox
                              checked={row.includeInAccountantPDF}
                              onCheckedChange={(checked) => {
                                setRows((prev) =>
                                  prev.map((r) =>
                                    r.employee.id === row.employee.id
                                      ? {
                                          ...r,
                                          includeInAccountantPDF: !!checked,
                                        }
                                      : r,
                                  ),
                                );
                              }}
                              aria-label={`Include ${row.employee.name} in accountant PDF`}
                              data-ocid={`acct_pdf.checkbox.${displayRows.indexOf(row) + 1}`}
                            />
                          </TableCell>
                          {/* Employee Name */}
                          <TableCell>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-foreground">
                                {row.employee.name}
                              </span>
                              {row.isStudent && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 font-semibold bg-blue-100 text-blue-700 border-blue-200"
                                >
                                  Student
                                </Badge>
                              )}
                              {row.isFixedSalary && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 font-semibold bg-amber-100 text-amber-700 border-amber-200"
                                >
                                  Fixed
                                </Badge>
                              )}
                              {row.saving && (
                                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground saving-pulse" />
                              )}
                              {!row.saving && row.savedAt && (
                                <CheckCircle2 className="h-3 w-3 text-green-600 opacity-60" />
                              )}
                            </div>
                          </TableCell>

                          {/* Wage Rate */}
                          <TableCell className="text-right">
                            <div className="relative flex items-center justify-end">
                              <span className="absolute left-2 text-muted-foreground text-xs pointer-events-none">
                                £
                              </span>
                              <input
                                type="number"
                                className="table-input"
                                min="0"
                                step="0.01"
                                value={row.localWageRate}
                                disabled={row.isFixedSalary}
                                onChange={(e) =>
                                  handleWageRateChange(
                                    row.employee.id,
                                    e.target.value,
                                  )
                                }
                                onBlur={() =>
                                  handleWageRateBlur(row.employee.id)
                                }
                                aria-label={`Wage rate for ${row.employee.name}`}
                                style={{ fontSize: "16px" }}
                              />
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
                              disabled={row.isStudent || row.isFixedSalary}
                              onChange={(e) =>
                                handleHoursChange(
                                  row.employee.id,
                                  e.target.value,
                                )
                              }
                              onBlur={() => handleHoursBlur(row.employee.id)}
                              aria-label={`Hours worked for ${row.employee.name}`}
                              style={{ fontSize: "16px" }}
                            />
                          </TableCell>

                          {/* Fixed Salary Checkbox */}
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center">
                              <Checkbox
                                checked={row.isFixedSalary}
                                onCheckedChange={(checked) =>
                                  handleFixedSalaryToggle(
                                    row.employee.id,
                                    checked === true,
                                  )
                                }
                                aria-label={`Mark ${row.employee.name} as fixed salary`}
                                className="h-5 w-5"
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
                                    checked === true,
                                  )
                                }
                                aria-label={`Mark ${row.employee.name} as student`}
                                className="h-5 w-5"
                              />
                            </div>
                          </TableCell>

                          {/* Payment Method Toggle */}
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center">
                              <PaymentToggle
                                value={row.paymentMethod}
                                onChange={() =>
                                  handlePaymentMethodToggle(row.employee.id)
                                }
                                label={`Payment method for ${row.employee.name}`}
                              />
                            </div>
                          </TableCell>

                          {/* Total Wages — editable input when fixed salary, else computed */}
                          <TableCell className="text-right">
                            {row.isFixedSalary ? (
                              <div className="relative flex items-center justify-end">
                                <span className="absolute left-2 text-amber-500 text-xs pointer-events-none">
                                  £
                                </span>
                                <input
                                  type="number"
                                  className="table-input text-amber-700"
                                  min="0"
                                  step="0.01"
                                  value={row.localFixedSalaryAmount}
                                  onChange={(e) =>
                                    handleFixedSalaryAmountChange(
                                      row.employee.id,
                                      e.target.value,
                                    )
                                  }
                                  onBlur={() =>
                                    handleFixedSalaryAmountBlur(row.employee.id)
                                  }
                                  aria-label={`Fixed salary amount for ${row.employee.name}`}
                                  style={{ fontSize: "16px" }}
                                  placeholder="0.00"
                                />
                              </div>
                            ) : (
                              <span className="font-mono font-medium text-foreground tabular-nums">
                                {formatCurrency(totalWagesRow)}
                              </span>
                            )}
                          </TableCell>

                          {/* Manual Cash */}
                          <TableCell className="text-right bg-amber-50/30">
                            <div className="relative flex items-center justify-end">
                              <span className="absolute left-2 text-amber-500 text-xs pointer-events-none">
                                £
                              </span>
                              <input
                                type="number"
                                className="table-input text-amber-900"
                                style={{
                                  fontSize: "16px",
                                  backgroundColor: "rgb(255 251 235 / 0.8)",
                                  borderColor: "rgb(252 211 77 / 0.5)",
                                }}
                                min="0"
                                step="1"
                                value={row.localManualCash}
                                onChange={(e) =>
                                  handleManualCashChange(
                                    row.employee.id,
                                    e.target.value,
                                  )
                                }
                                placeholder="0"
                                aria-label={`Manual cash for ${row.employee.name}`}
                              />
                            </div>
                          </TableCell>

                          {/* Tips Earned */}
                          <TableCell className="text-right">
                            <div className="relative flex items-center justify-end">
                              <span className="absolute left-2 text-muted-foreground text-xs pointer-events-none">
                                £
                              </span>
                              <input
                                type="number"
                                className="table-input"
                                min="0"
                                step="0.01"
                                value={row.localTips}
                                onChange={(e) =>
                                  handleTipsChange(
                                    row.employee.id,
                                    e.target.value,
                                  )
                                }
                                onBlur={() => handleTipsBlur(row.employee.id)}
                                aria-label={`Tips earned for ${row.employee.name}`}
                                style={{ fontSize: "16px" }}
                              />
                            </div>
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-center no-print">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-muted-foreground hover:text-foreground"
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
                                className="h-9 w-9 text-muted-foreground hover:text-destructive"
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

                        {/* ── Student Overtime Sub-Row ── */}
                        {row.isStudent && (
                          <TableRow
                            key={`${row.employee.id}-overtime`}
                            className="bg-blue-50/50 hover:bg-blue-50/70"
                          >
                            <TableCell className="py-2 no-print" />
                            <TableCell className="py-2 pl-8">
                              <span className="text-xs font-medium text-blue-700 italic">
                                ↳ Overtime Hours
                              </span>
                            </TableCell>
                            {/* Overtime Wage Rate */}
                            <TableCell className="py-2 text-right">
                              <div className="relative flex items-center justify-end">
                                <span className="absolute left-2 text-blue-400 text-xs pointer-events-none">
                                  £
                                </span>
                                <input
                                  type="number"
                                  className="table-input text-blue-700"
                                  min="0"
                                  step="0.01"
                                  value={row.localOvertimeWageRate}
                                  onChange={(e) =>
                                    handleOvertimeWageRateChange(
                                      row.employee.id,
                                      e.target.value,
                                    )
                                  }
                                  onBlur={() =>
                                    handleOvertimeWageRateBlur(row.employee.id)
                                  }
                                  aria-label={`Overtime wage rate for ${row.employee.name}`}
                                  style={{ fontSize: "16px" }}
                                  placeholder="0.00"
                                />
                              </div>
                            </TableCell>
                            {/* Overtime Hours */}
                            <TableCell className="py-2 text-right">
                              <input
                                type="number"
                                className="table-input text-blue-700"
                                min="0"
                                step="0.5"
                                value={row.localOvertimeHours}
                                onChange={(e) =>
                                  handleOvertimeHoursChange(
                                    row.employee.id,
                                    e.target.value,
                                  )
                                }
                                onBlur={() =>
                                  handleOvertimeHoursBlur(row.employee.id)
                                }
                                aria-label={`Overtime hours for ${row.employee.name}`}
                                style={{ fontSize: "16px" }}
                                placeholder="0"
                              />
                            </TableCell>
                            {/* Empty fixed cell */}
                            <TableCell className="py-2" />
                            {/* Empty student cell */}
                            <TableCell className="py-2" />
                            {/* Overtime Payment Method */}
                            <TableCell className="py-2 text-center">
                              <div className="flex items-center justify-center">
                                <PaymentToggle
                                  value={row.overtimePaymentMethod}
                                  onChange={() =>
                                    handleOvertimePaymentMethodToggle(
                                      row.employee.id,
                                    )
                                  }
                                  label={`Overtime payment method for ${row.employee.name}`}
                                />
                              </div>
                            </TableCell>
                            {/* Overtime Total */}
                            <TableCell className="py-2 text-right">
                              <span className="font-mono font-medium text-blue-700 tabular-nums text-sm">
                                {formatCurrency(overtimeTotal)}
                              </span>
                            </TableCell>
                            {/* Empty manual cash cell */}
                            <TableCell className="py-2" />
                            {/* Empty tips cell */}
                            <TableCell className="py-2" />
                            {/* Empty actions cell */}
                            <TableCell className="py-2 no-print" />
                          </TableRow>
                        )}
                      </>
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
            <div className="grid grid-cols-2 divide-y divide-border sm:grid-cols-5 sm:divide-x sm:divide-y-0">
              <div className="px-5 py-5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Total Wages
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">
                  {formatCurrency(computedTotalWages)}
                </p>
              </div>
              <div className="px-5 py-5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Total Tips
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">
                  {formatCurrency(computedTotalTips)}
                </p>
              </div>
              <div className="px-5 py-5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Overtime Total
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">
                  {formatCurrency(computedTotalOvertime)}
                </p>
              </div>
              <div className="px-5 py-5 bg-amber-50/50">
                <p className="text-xs font-medium uppercase tracking-wider text-amber-700/70">
                  Cash Total
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-amber-700">
                  {formatCurrency(computedCashTotal)}
                </p>
              </div>
              <div className="px-5 py-5 bg-primary/5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Grand Total
                </p>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-primary">
                  {formatCurrency(computedGrandTotal)}
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

      <EmployeeDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        mode="add"
        onSave={handleAddEmployee}
      />

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
            <AlertDialogTitle>Save & Clear Pay Period</AlertDialogTitle>
            <AlertDialogDescription>
              This will save the current pay period{" "}
              {periodStart && periodEnd && (
                <strong>({formatPeriodLabel(periodStart, periodEnd)})</strong>
              )}{" "}
              with a grand total of{" "}
              <strong>{formatCurrency(computedGrandTotal)}</strong> (cash:{" "}
              <strong>{formatCurrency(computedCashTotal)}</strong>), then reset
              all hours, tips, and overtime to zero. Employee names and wage
              rates will be kept. Are you sure?
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
              {clearInProgress ? "Saving…" : "Save & Clear"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
