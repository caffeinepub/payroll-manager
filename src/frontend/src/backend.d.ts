import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface PayrollEntry {
    id: string;
    tipsEarned: number;
    hoursWorked: number;
    employeeId: string;
    isStudent: boolean;
    totalWages: number;
}
export interface Employee {
    id: string;
    name: string;
    wageRate: number;
}
export interface backendInterface {
    clearPayrollEntries(): Promise<void>;
    createEmployee(id: string, name: string, wageRate: number): Promise<void>;
    createPayrollEntry(id: string, employeeId: string, hoursWorked: number, tipsEarned: number, isStudent: boolean): Promise<void>;
    deleteEmployee(id: string): Promise<void>;
    deletePayrollEntry(id: string): Promise<void>;
    getEmployee(id: string): Promise<Employee>;
    getPayrollEntriesByEmployee(employeeId: string): Promise<Array<PayrollEntry>>;
    getPayrollEntry(id: string): Promise<PayrollEntry>;
    listEmployees(): Promise<Array<Employee>>;
    listPayrollEntries(): Promise<Array<PayrollEntry>>;
    updateEmployee(id: string, name: string, wageRate: number): Promise<void>;
    updatePayrollEntry(id: string, employeeId: string, hoursWorked: number, tipsEarned: number, isStudent: boolean): Promise<void>;
}
