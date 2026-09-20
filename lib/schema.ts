import { z } from "zod";

export const Severity = z.enum(["low", "medium", "high"]);

export const Category = z.enum([
  "auto_renewal",
  "lock_in_termination",
  "penalty_fee",
  "unilateral_change",
  "refund_deposit",
  "interest_rate",
  "liability_indemnity",
  "arbitration_jurisdiction",
  "data_privacy",
  "exclusion_coverage",
  "non_compete_ip",
  "hidden_charges",
  "vague_terms",
  "other",
]);

export const Trap = z.object({
  clauseId: z.string(),                  // "C7"
  quote: z.string().min(20).max(400),    // must exist in source
  category: Category,
  severity: Severity,
  why: z.string().max(280),              // plain language, Grade 6
  action: z.string().max(200),           // what to do
  question: z.string().max(200).optional(),
});

export const RelativeRule = z.object({
  n: z.number().int().positive(),
  unit: z.enum(["day", "week", "month", "year"]),
  direction: z.enum(["before", "after"]),
  anchor: z.enum(["start_date", "renewal_date", "end_date", "signing_date", "other"]),
});

export const Deadline = z.object({
  clauseId: z.string(),
  quote: z.string().min(10).max(300),
  label: z.string().max(100),            // "Cancel before auto-renewal"
  absoluteDate: z.string().nullable(),   // ISO date if the doc states one
  relative: RelativeRule.nullable(),
});

export const Loan = z.object({
  principal: z.number(),
  annualRatePct: z.number(),
  tenureMonths: z.number(),
  processingFeePct: z.number().nullable(),
  prepaymentPenaltyPct: z.number().nullable(),
});

export const Subscription = z.object({
  price: z.number(),
  billingPeriodMonths: z.number(),
  autoRenews: z.boolean(),
  cancelNoticeDays: z.number().nullable(),
  earlyExitFee: z.number().nullable(),
});

export const Rental = z.object({
  monthlyRent: z.number(),
  deposit: z.number().nullable(),
  lockInMonths: z.number().nullable(),
  noticeMonths: z.number().nullable(),
  annualEscalationPct: z.number().nullable(),
});

export const Analysis = z.object({
  docType: z.enum(["rental", "loan", "subscription", "insurance", "employment", "terms_of_service", "other"]),
  currency: z.string().default("INR"),
  summary: z.array(z.string().max(160)).max(5),
  traps: z.array(Trap).max(15),
  deadlines: z.array(Deadline).max(10),
  terms: z.object({
    loan: Loan.nullable(),
    subscription: Subscription.nullable(),
    rental: Rental.nullable(),
  }),
  questions: z.array(z.string().max(200)).max(7),
  missing: z.array(z.object({ item: z.string(), why: z.string() })).max(4), // P1
});

export type Analysis = z.infer<typeof Analysis>;
export type Trap = z.infer<typeof Trap>;
export type Deadline = z.infer<typeof Deadline>;
export type RelativeRule = z.infer<typeof RelativeRule>;
export type Loan = z.infer<typeof Loan>;
export type Subscription = z.infer<typeof Subscription>;
export type Rental = z.infer<typeof Rental>;

// What the API returns AFTER verification and scoring
export type VerifiedTrap = z.infer<typeof Trap> & {
  start: number;
  end: number;            // char offsets in source text
  source: "llm" | "rule" | "both";
};

export type AnalyzeResponse = Omit<Analysis, "traps"> & {
  traps: VerifiedTrap[];
  score: number;                         // 0..100
  band: "low" | "moderate" | "high" | "severe";
  removedUnverified: number;
};
