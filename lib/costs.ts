/**
 * lib/costs.ts - Deterministic financial calculators (Phase 4)
 * No LLM - all math is deterministic and unit-testable.
 */

import type { Loan, Subscription, Rental } from "./schema";

// -----------------------------------------------------------------------------
// LOAN
// -----------------------------------------------------------------------------

export interface LoanBreakdown {
  emi: number;
  totalPayable: number;
  totalInterest: number;
  processingFee: number;
  prepaymentCost: (afterMonths: number) => PrepaymentResult;
}

export interface PrepaymentResult {
  outstandingPrincipal: number;
  interestSaved: number;
  penaltyAmount: number;
  netSavings: number;
}

export function calcLoan(loan: Loan): LoanBreakdown {
  const { principal, annualRatePct, tenureMonths, processingFeePct, prepaymentPenaltyPct } = loan;

  const r = annualRatePct / 12 / 100;
  let emi: number;

  if (r === 0) {
    emi = principal / tenureMonths;
  } else {
    const pow = Math.pow(1 + r, tenureMonths);
    emi = (principal * r * pow) / (pow - 1);
  }

  emi = round2(emi);
  const totalPayable = round2(emi * tenureMonths);
  const totalInterest = round2(totalPayable - principal);
  const processingFee = round2(processingFeePct != null ? (principal * processingFeePct) / 100 : 0);

  const prepaymentCost = (afterMonths: number): PrepaymentResult => {
    if (afterMonths < 0 || afterMonths >= tenureMonths) {
      return { outstandingPrincipal: 0, interestSaved: 0, penaltyAmount: 0, netSavings: 0 };
    }
    const remainingMonths = tenureMonths - afterMonths;
    let outstandingPrincipal: number;
    if (r === 0) {
      outstandingPrincipal = principal - (principal / tenureMonths) * afterMonths;
    } else {
      const pow = Math.pow(1 + r, remainingMonths);
      outstandingPrincipal = round2((emi * (pow - 1)) / (r * pow));
    }

    const interestSaved = round2(emi * remainingMonths - outstandingPrincipal);
    const penaltyAmount = round2(
      prepaymentPenaltyPct != null ? (outstandingPrincipal * prepaymentPenaltyPct) / 100 : 0
    );
    const netSavings = round2(interestSaved - penaltyAmount);

    return { outstandingPrincipal, interestSaved, penaltyAmount, netSavings };
  };

  return { emi, totalPayable, totalInterest, processingFee, prepaymentCost };
}

// -----------------------------------------------------------------------------
// SUBSCRIPTION
// -----------------------------------------------------------------------------

export interface SubscriptionBreakdown {
  pricePerMonth: number;
  pricePerYear: number;
  exitCost: number;
  noticePeriodCost: number;
}

export function calcSubscription(sub: Subscription): SubscriptionBreakdown {
  const daysInPeriod = sub.billingPeriodMonths * 30;
  const pricePerDay = sub.price / daysInPeriod;
  const pricePerMonth = round2(sub.price / sub.billingPeriodMonths);
  const pricePerYear = round2(pricePerMonth * 12);
  const exitCost = sub.earlyExitFee ?? 0;
  const noticePeriodDays = sub.cancelNoticeDays ?? 0;
  const noticePeriodCost = round2(pricePerDay * noticePeriodDays);
  return { pricePerMonth, pricePerYear, exitCost, noticePeriodCost };
}

// -----------------------------------------------------------------------------
// RENTAL
// -----------------------------------------------------------------------------

export interface RentalBreakdown {
  lockInTotalRent: number;
  earlyExitCost: (exitAfterMonths: number) => EarlyExitResult;
  rentInYear: (year: number) => number;
  noticeMonths: number;
  deposit: number;
}

export interface EarlyExitResult {
  remainingLockIn: number;
  rentForRemaining: number;
  noticePeriodRent: number;
  deposit: number;
  totalLiability: number;
}

export function calcRental(rental: Rental): RentalBreakdown {
  const { monthlyRent, deposit, lockInMonths, noticeMonths, annualEscalationPct } = rental;

  const safeDeposit = deposit ?? 0;
  const safeLockIn = lockInMonths ?? 0;
  const safeNotice = noticeMonths ?? 0;
  const escalation = annualEscalationPct ?? 0;

  const rentInYear = (year: number): number =>
    round2(monthlyRent * Math.pow(1 + escalation / 100, year - 1));

  let lockInTotalRent = 0;
  for (let m = 0; m < safeLockIn; m++) {
    lockInTotalRent += rentInYear(Math.floor(m / 12) + 1);
  }
  lockInTotalRent = round2(lockInTotalRent);

  const earlyExitCost = (exitAfterMonths: number): EarlyExitResult => {
    const remaining = Math.max(0, safeLockIn - exitAfterMonths);
    let rentForRemaining = 0;
    for (let m = exitAfterMonths; m < safeLockIn; m++) {
      rentForRemaining += rentInYear(Math.floor(m / 12) + 1);
    }
    rentForRemaining = round2(rentForRemaining);

    let noticePeriodRent = 0;
    for (let m = exitAfterMonths; m < exitAfterMonths + safeNotice; m++) {
      noticePeriodRent += rentInYear(Math.floor(m / 12) + 1);
    }
    noticePeriodRent = round2(noticePeriodRent);

    return {
      remainingLockIn: remaining,
      rentForRemaining,
      noticePeriodRent,
      deposit: safeDeposit,
      totalLiability: round2(rentForRemaining + noticePeriodRent),
    };
  };

  return { lockInTotalRent, earlyExitCost, rentInYear, noticeMonths: safeNotice, deposit: safeDeposit };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
