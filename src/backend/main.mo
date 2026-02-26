import Map "mo:core/Map";
import Text "mo:core/Text";
import Runtime "mo:core/Runtime";

actor {
  type Employee = {
    id : Text;
    name : Text;
    wageRate : Float;
  };

  type PayrollEntry = {
    id : Text;
    employeeId : Text;
    hoursWorked : Float;
    tipsEarned : Float;
    isStudent : Bool;
    totalWages : Float;
  };

  let employeeStore = Map.empty<Text, Employee>();
  let payrollStore = Map.empty<Text, PayrollEntry>();

  // Employee Functions
  public shared ({ caller }) func createEmployee(id : Text, name : Text, wageRate : Float) : async () {
    let employee : Employee = {
      id;
      name;
      wageRate;
    };
    employeeStore.add(id, employee);
  };

  public shared ({ caller }) func updateEmployee(id : Text, name : Text, wageRate : Float) : async () {
    let employee : Employee = {
      id;
      name;
      wageRate;
    };
    employeeStore.add(id, employee);
  };

  public query ({ caller }) func getEmployee(id : Text) : async Employee {
    switch (employeeStore.get(id)) {
      case (null) { Runtime.trap("Employee not found") };
      case (?employee) { employee };
    };
  };

  public shared ({ caller }) func deleteEmployee(id : Text) : async () {
    if (not employeeStore.containsKey(id)) {
      Runtime.trap("Employee not found");
    };
    employeeStore.remove(id);
  };

  public query ({ caller }) func listEmployees() : async [Employee] {
    employeeStore.values().toArray();
  };

  // Payroll Functions
  public shared ({ caller }) func createPayrollEntry(
    id : Text,
    employeeId : Text,
    hoursWorked : Float,
    tipsEarned : Float,
    isStudent : Bool,
  ) : async () {
    let emp : Employee = switch (employeeStore.get(employeeId)) {
      case (null) { Runtime.trap("Employee not found") };
      case (?emp) { emp };
    };
    let totalWages = hoursWorked * emp.wageRate;
    let entry : PayrollEntry = {
      id;
      employeeId;
      hoursWorked;
      tipsEarned;
      isStudent;
      totalWages;
    };
    payrollStore.add(id, entry);
  };

  public shared ({ caller }) func updatePayrollEntry(
    id : Text,
    employeeId : Text,
    hoursWorked : Float,
    tipsEarned : Float,
    isStudent : Bool,
  ) : async () {
    let emp : Employee = switch (employeeStore.get(employeeId)) {
      case (null) { Runtime.trap("Employee not found") };
      case (?emp) { emp };
    };
    let totalWages = hoursWorked * emp.wageRate;
    let entry : PayrollEntry = {
      id;
      employeeId;
      hoursWorked;
      tipsEarned;
      isStudent;
      totalWages;
    };
    payrollStore.add(id, entry);
  };

  public shared ({ caller }) func deletePayrollEntry(id : Text) : async () {
    if (not payrollStore.containsKey(id)) {
      Runtime.trap("Payroll entry not found");
    };
    payrollStore.remove(id);
  };

  public query ({ caller }) func getPayrollEntry(id : Text) : async PayrollEntry {
    switch (payrollStore.get(id)) {
      case (null) { Runtime.trap("Payroll entry not found") };
      case (?entry) { entry };
    };
  };

  public query ({ caller }) func getPayrollEntriesByEmployee(employeeId : Text) : async [PayrollEntry] {
    payrollStore.values().toArray();
  };

  public query ({ caller }) func listPayrollEntries() : async [PayrollEntry] {
    payrollStore.values().toArray();
  };

  public shared ({ caller }) func clearPayrollEntries() : async () {
    payrollStore.clear();
  };
};
