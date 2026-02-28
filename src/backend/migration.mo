import Map "mo:core/Map";
import List "mo:core/List";
import Text "mo:core/Text";
import Float "mo:core/Float";
import Nat "mo:core/Nat";
import Int "mo:core/Int";

module {
  type OldEmployee = {
    id : Text;
    name : Text;
    wageRate : Float;
  };

  type OldPayrollEntry = {
    id : Text;
    employeeId : Text;
    hoursWorked : Float;
    tipsEarned : Float;
    isStudent : Bool;
    totalWages : Float;
    overtimeHours : Float;
    overtimeWageRate : Float;
    overtimeTotal : Float;
  };

  type OldPayPeriod = {
    id : Text;
    startDate : Text;
    endDate : Text;
    _label : Text;
    totalWages : Float;
    totalTips : Float;
    overtimeTotal : Float;
    grandTotal : Float;
    employeeCount : Nat;
    createdAt : Int;
  };

  type OldActor = {
    employeesByCompany : Map.Map<Text, OldEmployee>;
    payrollByCompany : Map.Map<Text, OldPayrollEntry>;
    payPeriodsByCompany : Map.Map<Text, List.List<OldPayPeriod>>;
  };

  type NewPayrollEntry = {
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

  type NewPayPeriod = {
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

  type NewActor = {
    employeesByCompany : Map.Map<Text, OldEmployee>;
    payrollByCompany : Map.Map<Text, NewPayrollEntry>;
    payPeriodsByCompany : Map.Map<Text, List.List<NewPayPeriod>>;
  };

  public func run(old : OldActor) : NewActor {
    let newPayrollByCompany = old.payrollByCompany.map<Text, OldPayrollEntry, NewPayrollEntry>(
      func(_id, oldEntry) {
        {
          oldEntry with
          isFixedSalary = false;
          fixedSalaryAmount = 0.0;
          paymentMethod = "bank";
          overtimePaymentMethod = "bank";
        };
      }
    );

    let newPayPeriodsByCompany = old.payPeriodsByCompany.map<Text, List.List<OldPayPeriod>, List.List<NewPayPeriod>>(
      func(_companyId, oldList) {
        oldList.map<OldPayPeriod, NewPayPeriod>(
          func(oldPeriod) {
            {
              oldPeriod with
              cashTotal = 0.0;
            };
          }
        );
      }
    );

    {
      old with
      payrollByCompany = newPayrollByCompany;
      payPeriodsByCompany = newPayPeriodsByCompany;
    };
  };
};
