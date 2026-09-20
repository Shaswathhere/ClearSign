import { describe, it, expect } from "vitest";
import { calcLoan, calcSubscription, calcRental } from "../lib/costs";

describe("calcLoan", () => {
  it("standard EMI calculation", () => {
    // 10L, 10% p.a., 24 months
    const b = calcLoan({ principal: 1000000, annualRatePct: 10, tenureMonths: 24, processingFeePct: 1, prepaymentPenaltyPct: 2 });
    expect(b.emi).toBeGreaterThan(46000);
    expect(b.emi).toBeLessThan(47000);
    expect(b.totalInterest).toBeGreaterThan(0);
    expect(b.processingFee).toBe(10000);
  });

  it("zero interest loan", () => {
    const b = calcLoan({ principal: 12000, annualRatePct: 0, tenureMonths: 12, processingFeePct: null, prepaymentPenaltyPct: null });
    expect(b.emi).toBe(1000);
    expect(b.totalInterest).toBe(0);
  });

  it("prepayment after 12 months saves interest", () => {
    const b = calcLoan({ principal: 1000000, annualRatePct: 10, tenureMonths: 24, processingFeePct: null, prepaymentPenaltyPct: 2 });
    const pp = b.prepaymentCost(12);
    expect(pp.outstandingPrincipal).toBeGreaterThan(0);
    expect(pp.interestSaved).toBeGreaterThan(0);
    expect(pp.penaltyAmount).toBeGreaterThan(0);
  });
});

describe("calcSubscription", () => {
  it("monthly subscription with notice and exit fee", () => {
    const b = calcSubscription({ price: 999, billingPeriodMonths: 1, autoRenews: true, cancelNoticeDays: 30, earlyExitFee: 500 });
    expect(b.pricePerMonth).toBe(999);
    expect(b.pricePerYear).toBe(11988);
    expect(b.exitCost).toBe(500);
    expect(b.noticePeriodCost).toBeCloseTo(999, 0);
  });
});

describe("calcRental", () => {
  it("lock-in total with escalation", () => {
    const b = calcRental({ monthlyRent: 20000, deposit: 60000, lockInMonths: 12, noticeMonths: 2, annualEscalationPct: 5 });
    expect(b.lockInTotalRent).toBe(240000); // 12 x 20000 in year 1
    expect(b.deposit).toBe(60000);
  });

  it("early exit at month 6 shows remaining liability", () => {
    const b = calcRental({ monthlyRent: 20000, deposit: 60000, lockInMonths: 12, noticeMonths: 2, annualEscalationPct: 0 });
    const ex = b.earlyExitCost(6);
    expect(ex.remainingLockIn).toBe(6);
    expect(ex.rentForRemaining).toBe(120000);
    expect(ex.noticePeriodRent).toBe(40000);
  });
});
