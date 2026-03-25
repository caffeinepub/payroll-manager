import Map "mo:core/Map";
import List "mo:core/List";
import Array "mo:core/Array";
import Text "mo:core/Text";
import Float "mo:core/Float";
import Iter "mo:core/Iter";
import Int "mo:core/Int";
import Nat "mo:core/Nat";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";

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
    overtimeHours : Float;
    overtimeWageRate : Float;
    overtimeTotal : Float;
    isFixedSalary : Bool;
    fixedSalaryAmount : Float;
    paymentMethod : Text;
    overtimePaymentMethod : Text;
  };

  public type WeeklyTotals = {
    wageTotal : Float;
    tipTotal : Float;
    overtimeTotal : Float;
    grandTotal : Float;
  };

  type PayPeriod = {
    id : Text;
    startDate : Text;
    endDate : Text;
    _label : Text;
    totalWages : Float;
    totalTips : Float;
    overtimeTotal : Float;
    grandTotal : Float;
    cashTotal : Float;
    employeeCount : Nat;
    createdAt : Int;
  };

  // Stable storage to persist data across canister upgrades
  stable var stableEmployees : [(Text, Employee)] = [];
  stable var stablePayroll : [(Text, PayrollEntry)] = [];
  stable var stablePayPeriods : [(Text, [PayPeriod])] = [];

  // Runtime maps (populated from stable storage in do block below)
  let employeesByCompany = Map.empty<Text, Employee>();
  let payrollByCompany = Map.empty<Text, PayrollEntry>();
  let payPeriodsByCompany = Map.empty<Text, List.List<PayPeriod>>();

  do {
    for ((k, v) in stableEmployees.vals()) { employeesByCompany.add(k, v) };
    for ((k, v) in stablePayroll.vals()) { payrollByCompany.add(k, v) };
    for ((companyId, periods) in stablePayPeriods.vals()) {
      let list = List.empty<PayPeriod>();
      for (p in periods.vals()) { list.add(p) };
      payPeriodsByCompany.add(companyId, list);
    };
  };

  system func preupgrade() {
    stableEmployees := employeesByCompany.toArray();
    stablePayroll := payrollByCompany.toArray();
    let periodsArr = payPeriodsByCompany.toArray();
    stablePayPeriods := Array.tabulate<(Text, [PayPeriod])>(
      periodsArr.size(),
      func(i) {
        let (k, v) = periodsArr[i];
        (k, v.toArray());
      },
    );
  };

  func getCompositeKey(companyId : Text, id : Text) : Text {
    companyId # "::" # id;
  };

  public shared ({ caller }) func createEmployee(companyId : Text, id : Text, name : Text, wageRate : Float) : async () {
    employeesByCompany.add(getCompositeKey(companyId, id), { id; name; wageRate });
  };

  public shared ({ caller }) func updateEmployee(companyId : Text, id : Text, name : Text, wageRate : Float) : async () {
    employeesByCompany.add(getCompositeKey(companyId, id), { id; name; wageRate });
  };

  public query ({ caller }) func getEmployee(companyId : Text, id : Text) : async Employee {
    switch (employeesByCompany.get(getCompositeKey(companyId, id))) {
      case (null) { Runtime.trap("Employee not found") };
      case (?employee) { employee };
    };
  };

  public shared ({ caller }) func deleteEmployee(companyId : Text, id : Text) : async () {
    employeesByCompany.remove(getCompositeKey(companyId, id));
  };

  public query ({ caller }) func listEmployees(companyId : Text) : async [Employee] {
    let allEmployees = employeesByCompany.toArray();
    let filtered = allEmployees.filter(func((k, _)) { k.startsWith(#text(companyId # "::")) });
    filtered.map(func((_, v)) { v });
  };

  public shared ({ caller }) func createPayrollEntry(
    companyId : Text, id : Text, employeeId : Text,
    hoursWorked : Float, tipsEarned : Float, isStudent : Bool,
    overtimeHours : Float, overtimeWageRate : Float,
    isFixedSalary : Bool, fixedSalaryAmount : Float,
    paymentMethod : Text, overtimePaymentMethod : Text,
  ) : async () {
    let wageRate : Float = switch (employeesByCompany.get(getCompositeKey(companyId, employeeId))) {
      case (null) { overtimeWageRate };
      case (?emp) { emp.wageRate };
    };
    let totalWages = if (isFixedSalary) { fixedSalaryAmount } else { hoursWorked * wageRate };
    let overtimeTotal = overtimeHours * overtimeWageRate;
    payrollByCompany.add(getCompositeKey(companyId, id), {
      id; employeeId; hoursWorked; tipsEarned; isStudent; totalWages;
      overtimeHours; overtimeWageRate; overtimeTotal; isFixedSalary;
      fixedSalaryAmount; paymentMethod; overtimePaymentMethod;
    });
  };

  public shared ({ caller }) func updatePayrollEntry(
    companyId : Text, id : Text, employeeId : Text,
    hoursWorked : Float, tipsEarned : Float, isStudent : Bool,
    overtimeHours : Float, overtimeWageRate : Float,
    isFixedSalary : Bool, fixedSalaryAmount : Float,
    paymentMethod : Text, overtimePaymentMethod : Text,
  ) : async () {
    let wageRate : Float = switch (employeesByCompany.get(getCompositeKey(companyId, employeeId))) {
      case (null) { overtimeWageRate };
      case (?emp) { emp.wageRate };
    };
    let totalWages = if (isFixedSalary) { fixedSalaryAmount } else { hoursWorked * wageRate };
    let overtimeTotal = overtimeHours * overtimeWageRate;
    payrollByCompany.add(getCompositeKey(companyId, id), {
      id; employeeId; hoursWorked; tipsEarned; isStudent; totalWages;
      overtimeHours; overtimeWageRate; overtimeTotal; isFixedSalary;
      fixedSalaryAmount; paymentMethod; overtimePaymentMethod;
    });
  };

  public shared ({ caller }) func deletePayrollEntry(companyId : Text, id : Text) : async () {
    payrollByCompany.remove(getCompositeKey(companyId, id));
  };

  public query ({ caller }) func getPayrollEntry(companyId : Text, id : Text) : async PayrollEntry {
    switch (payrollByCompany.get(getCompositeKey(companyId, id))) {
      case (null) { Runtime.trap("Payroll entry not found") };
      case (?entry) { entry };
    };
  };

  public query ({ caller }) func getPayrollEntriesByEmployee(companyId : Text, employeeId : Text) : async [PayrollEntry] {
    let allEntries = payrollByCompany.toArray();
    let filtered = allEntries.filter(func((k, v)) {
      k.startsWith(#text(companyId # "::")) and v.employeeId == employeeId
    });
    filtered.map(func((_, v)) { v });
  };

  public query ({ caller }) func listPayrollEntries(companyId : Text) : async [PayrollEntry] {
    let allEntries = payrollByCompany.toArray();
    let filtered = allEntries.filter(func((k, _)) { k.startsWith(#text(companyId # "::")) });
    filtered.map(func((_, v)) { v });
  };

  public shared ({ caller }) func clearPayrollEntries(companyId : Text) : async () {
    let keys = payrollByCompany.keys().toArray();
    for (key in keys.vals()) {
      if (key.startsWith(#text(companyId # "::")) ) {
        payrollByCompany.remove(key);
      };
    };
  };

  public shared ({ caller }) func savePayPeriod(
    companyId : Text, id : Text, startDate : Text, endDate : Text, _label : Text,
    totalWages : Float, totalTips : Float, overtimeTotal : Float,
    grandTotal : Float, cashTotal : Float, employeeCount : Nat
  ) : async () {
    let payPeriod : PayPeriod = {
      id; startDate; endDate; _label; totalWages; totalTips; overtimeTotal;
      grandTotal; cashTotal; employeeCount; createdAt = Time.now();
    };
    switch (payPeriodsByCompany.get(companyId)) {
      case (null) {
        let newList = List.empty<PayPeriod>();
        newList.add(payPeriod);
        payPeriodsByCompany.add(companyId, newList);
      };
      case (?list) { list.add(payPeriod) };
    };
  };

  public query ({ caller }) func listPayPeriods(companyId : Text) : async [PayPeriod] {
    switch (payPeriodsByCompany.get(companyId)) {
      case (null) { [] };
      case (?periods) {
        let periodCount = periods.size();
        let periodArray = periods.toArray();
        if (periodCount > 1) {
          Array.tabulate<PayPeriod>(periodCount, func(i) { periodArray[periodCount - 1 - i] });
        } else { periodArray };
      };
    };
  };

  public query ({ caller }) func getLatestPayPeriod(companyId : Text) : async ?PayPeriod {
    switch (payPeriodsByCompany.get(companyId)) {
      case (null) { null };
      case (?periods) {
        if (periods.isEmpty()) { return null };
        let periodArray = periods.toArray();
        ?periodArray[periodArray.size() - 1];
      };
    };
  };

  public query ({ caller }) func calculateWeeklyTotals(companyId : Text) : async WeeklyTotals {
    let allEntries = payrollByCompany.toArray();
    let filtered = allEntries.filter(func((k, _)) { k.startsWith(#text(companyId # "::")) });
    var wageTotal : Float = 0.0;
    var tipTotal : Float = 0.0;
    var overtimeTotal : Float = 0.0;
    for ((_, entry) in filtered.vals()) {
      wageTotal += entry.totalWages;
      tipTotal += entry.tipsEarned;
      overtimeTotal += entry.overtimeTotal;
    };
    { wageTotal; tipTotal; overtimeTotal; grandTotal = wageTotal + tipTotal + overtimeTotal };
  };
};
