import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Employee {
    id: string;
    name: string;
    wageRate: number;
}
export interface PayrollEntry {
    id: string;
    tipsEarned: number;
    paymentMethod: string;
    fixedSalaryAmount: number;
    isFixedSalary: boolean;
    hoursWorked: number;
    overtimeWageRate: number;
    employeeId: string;
    overtimePaymentMethod: string;
    isStudent: boolean;
    totalWages: number;
    overtimeTotal: number;
    overtimeHours: number;
}
export interface WeeklyTotals {
    tipTotal: number;
    grandTotal: number;
    wageTotal: number;
    overtimeTotal: number;
}
export interface PayPeriod {
    id: string;
    endDate: string;
    cashTotal: number;
    employeeCount: bigint;
    createdAt: bigint;
    totalTips: number;
    _label: string;
    grandTotal: number;
    totalWages: number;
    overtimeTotal: number;
    startDate: string;
}
export interface backendInterface {
    calculateWeeklyTotals(companyId: string): Promise<WeeklyTotals>;
    clearPayrollEntries(companyId: string): Promise<void>;
    createEmployee(companyId: string, id: string, name: string, wageRate: number): Promise<void>;
    createPayrollEntry(companyId: string, id: string, employeeId: string, hoursWorked: number, tipsEarned: number, isStudent: boolean, overtimeHours: number, overtimeWageRate: number, isFixedSalary: boolean, fixedSalaryAmount: number, paymentMethod: string, overtimePaymentMethod: string): Promise<void>;
    deleteEmployee(companyId: string, id: string): Promise<void>;
    deletePayrollEntry(companyId: string, id: string): Promise<void>;
    getEmployee(companyId: string, id: string): Promise<Employee>;
    getLatestPayPeriod(companyId: string): Promise<PayPeriod | null>;
    getPayrollEntriesByEmployee(companyId: string, employeeId: string): Promise<Array<PayrollEntry>>;
    getPayrollEntry(companyId: string, id: string): Promise<PayrollEntry>;
    listEmployees(companyId: string): Promise<Array<Employee>>;
    listPayPeriods(companyId: string): Promise<Array<PayPeriod>>;
    listPayrollEntries(companyId: string): Promise<Array<PayrollEntry>>;
    savePayPeriod(companyId: string, id: string, startDate: string, endDate: string, _label: string, totalWages: number, totalTips: number, overtimeTotal: number, grandTotal: number, cashTotal: number, employeeCount: bigint): Promise<void>;
    updateEmployee(companyId: string, id: string, name: string, wageRate: number): Promise<void>;
    updatePayrollEntry(companyId: string, id: string, employeeId: string, hoursWorked: number, tipsEarned: number, isStudent: boolean, overtimeHours: number, overtimeWageRate: number, isFixedSalary: boolean, fixedSalaryAmount: number, paymentMethod: string, overtimePaymentMethod: string): Promise<void>;
}
