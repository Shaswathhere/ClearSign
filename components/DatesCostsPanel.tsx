"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Calendar, Download, ChevronDown, ChevronUp, AlertTriangle, Clock, DollarSign, Info } from "lucide-react";
import { AnalyzeResponse } from "@/lib/schema";
import type { RelativeRule } from "@/lib/schema";
import { resolveDeadlines, ResolvedDeadline } from "@/lib/dates";
import { calcLoan, calcSubscription, calcRental } from "@/lib/costs";
import { buildIcsContent, deadlinesToIcsEvents, downloadIcs } from "@/lib/ics";

interface DatesCostsPanelProps {
  result: AnalyzeResponse;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function DaysChip({ days }: { days: number | null }) {
  if (days === null) return null;
  if (days < 0) return <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-700 px-2 py-0.5 text-[10px] font-bold">PAST</span>;
  if (days <= 7) return <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-700 px-2 py-0.5 text-[10px] font-bold">⚠ {days}d left</span>;
  if (days <= 30) return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-bold">{days}d away</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px] font-bold">{days}d away</span>;
}

function WorkingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs py-1 border-b border-slate-100 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}

function ShowWorking({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:text-teal-800 transition-colors"
      >
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        Show working
      </button>
      {open && (
        <div className="mt-2 bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-0">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Deadlines Section ─────────────────────────────────────────────────────────

type AnchorKey = RelativeRule["anchor"];

function DeadlinesSection({ result }: { result: AnalyzeResponse }) {
  const anchorTypes = useMemo<AnchorKey[]>(() => {
    if (!result.deadlines.length) return [];
    const needed = new Set<AnchorKey>();
    for (const d of result.deadlines) {
      if (d.relative?.anchor) needed.add(d.relative.anchor);
    }
    return Array.from(needed);
  }, [result.deadlines]);

  const [anchorDates, setAnchorDates] = useState<Partial<Record<AnchorKey, string>>>({});

  const resolved = useMemo<ResolvedDeadline[]>(() =>
    resolveDeadlines(result.deadlines, anchorDates),
    [result.deadlines, anchorDates]
  );

  const handleDownloadIcs = useCallback(() => {
    const events = deadlinesToIcsEvents(resolved);
    if (events.length === 0) return;
    const content = buildIcsContent(events);
    downloadIcs(content);
  }, [resolved]);

  const icsCount = useMemo(() => resolved.filter((d) => d.isoDate && !d.isPast).length, [resolved]);

  if (!result.deadlines.length) {
    return (
      <div className="flex items-center gap-3 p-5 bg-slate-50 rounded-2xl border border-slate-200 text-sm text-slate-500">
        <Calendar className="h-5 w-5 text-slate-400 shrink-0" />
        No time-sensitive deadlines were found in this document.
      </div>
    );
  }

  const anchorLabels: Record<AnchorKey, string> = {
    start_date: "Contract Start Date",
    renewal_date: "Renewal Date",
    end_date: "Contract End Date",
    signing_date: "Signing Date",
    other: "Reference Date",
  };

  return (
    <div className="space-y-4">
      {/* Anchor date pickers */}
      {anchorTypes.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5" />
            Set dates from your contract to resolve deadlines
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {anchorTypes.map((key) => (
              <div key={key} className="space-y-1">
                <label className="text-[11px] font-semibold text-blue-700 block">{anchorLabels[key]}</label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  value={anchorDates[key] || ""}
                  onChange={(e) => setAnchorDates((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deadline cards */}
      <div className="space-y-3">
        {resolved.map((d, i) => (
          <div
            key={`${d.clauseId}-${i}`}
            className={`rounded-2xl border p-4 space-y-2 ${d.isPast ? "bg-slate-50 border-slate-200 opacity-60" : "bg-white border-slate-200"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Clock className={`h-4 w-4 shrink-0 ${d.isPast ? "text-slate-400" : "text-teal-600"}`} />
                <span className="text-xs font-bold text-slate-800 truncate">{d.label}</span>
                <span className="shrink-0 text-[10px] font-bold bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full">{d.clauseId}</span>
              </div>
              <DaysChip days={d.daysFromNow} />
            </div>
            {d.formattedDate && (
              <p className="text-xs font-semibold text-slate-700 ml-6">{d.formattedDate}</p>
            )}
            {!d.formattedDate && (
              <p className="text-[11px] text-slate-400 ml-6 italic">Set the anchor date above to resolve this deadline.</p>
            )}
            <blockquote className="text-[11px] text-slate-500 italic border-l-2 border-slate-200 pl-3 ml-6 leading-relaxed">
              &ldquo;{d.quote.slice(0, 180)}{d.quote.length > 180 ? "…" : ""}&rdquo;
            </blockquote>
          </div>
        ))}
      </div>

      {/* Download .ics */}
      <button
        type="button"
        onClick={handleDownloadIcs}
        disabled={icsCount === 0}
        className="flex items-center gap-2 rounded-xl bg-teal-700 text-white text-xs font-semibold px-4 py-2.5 hover:bg-teal-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-h-[48px]"
      >
        <Download className="h-4 w-4" />
        Download Calendar Reminders ({icsCount} event{icsCount !== 1 ? "s" : ""}) .ics
      </button>
    </div>
  );
}

// ─── Cost Section ─────────────────────────────────────────────────────────────

function LoanSection({ loan }: { loan: NonNullable<AnalyzeResponse["terms"]["loan"]> }) {
  const breakdown = useMemo(() => calcLoan(loan), [loan]);
  const [exitMonth, setExitMonth] = useState(Math.floor(loan.tenureMonths / 2));
  const prepay = useMemo(() => breakdown.prepaymentCost(exitMonth), [breakdown, exitMonth]);

  const worstCase = Math.max(
    breakdown.totalInterest,
    prepay.outstandingPrincipal + prepay.penaltyAmount
  );

  return (
    <div className="space-y-4">
      {/* Worst-case headline */}
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-rose-800">Worst-case cost</p>
          <p className="text-2xl font-extrabold text-rose-700">{formatINR(worstCase)}</p>
          <p className="text-[11px] text-rose-600 mt-0.5">Estimate based on the terms found in your document.</p>
        </div>
      </div>

      {/* Monthly EMI card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <DollarSign className="h-4 w-4 text-teal-600" />
          Loan Breakdown
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-[11px] text-slate-500 font-medium">Monthly EMI</p>
            <p className="text-lg font-extrabold text-slate-900">{formatINR(breakdown.emi)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-[11px] text-slate-500 font-medium">Total Interest</p>
            <p className="text-lg font-extrabold text-amber-700">{formatINR(breakdown.totalInterest)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-[11px] text-slate-500 font-medium">Total Payable</p>
            <p className="text-lg font-extrabold text-slate-900">{formatINR(breakdown.totalPayable)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-[11px] text-slate-500 font-medium">Processing Fee</p>
            <p className="text-lg font-extrabold text-slate-700">{formatINR(breakdown.processingFee)}</p>
          </div>
        </div>

        {/* Prepayment interactive slider */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
            <span>Prepay after month {exitMonth}</span>
            <span className="text-teal-700 font-bold">{exitMonth} of {loan.tenureMonths} mo</span>
          </div>
          <input
            type="range"
            min={1}
            max={loan.tenureMonths - 1}
            value={exitMonth}
            onChange={(e) => setExitMonth(Number(e.target.value))}
            className="w-full accent-teal-600"
          />
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="bg-emerald-50 rounded-xl p-3 text-center">
              <p className="text-[11px] text-emerald-700 font-medium">Interest saved</p>
              <p className="text-base font-extrabold text-emerald-800">{formatINR(prepay.interestSaved)}</p>
            </div>
            <div className="bg-rose-50 rounded-xl p-3 text-center">
              <p className="text-[11px] text-rose-700 font-medium">Penalty fee</p>
              <p className="text-base font-extrabold text-rose-800">{formatINR(prepay.penaltyAmount)}</p>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 text-center">
            Net savings by prepaying: <strong className="text-emerald-700">{formatINR(prepay.netSavings)}</strong>
          </p>
        </div>

        {/* Show working accordion */}
        <ShowWorking>
          <WorkingRow label="Principal (P)" value={formatINR(loan.principal)} />
          <WorkingRow label="Annual Interest Rate (R)" value={`${loan.annualRatePct}% p.a.`} />
          <WorkingRow label="Tenure (N)" value={`${loan.tenureMonths} months`} />
          <WorkingRow
            label="Formula: P × r × (1+r)ᴺ / ((1+r)ᴺ - 1)"
            value={`Monthly r = ${(loan.annualRatePct / 12).toFixed(3)}%`}
          />
          <WorkingRow label="Total Interest = (EMI × N) - P" value={formatINR(breakdown.totalInterest)} />
          {loan.processingFeePct != null && (
            <WorkingRow label={`Processing fee (${loan.processingFeePct}%)`} value={formatINR(breakdown.processingFee)} />
          )}
          {loan.prepaymentPenaltyPct != null && (
            <WorkingRow label={`Prepayment penalty`} value={`${loan.prepaymentPenaltyPct}% of outstanding`} />
          )}
        </ShowWorking>
      </div>
    </div>
  );
}

function SubscriptionSection({ sub }: { sub: NonNullable<AnalyzeResponse["terms"]["subscription"]> }) {
  const breakdown = useMemo(() => calcSubscription(sub), [sub]);
  const worstCase = breakdown.exitCost + breakdown.pricePerYear;

  return (
    <div className="space-y-4">
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-rose-800">Worst-case cost if you miss the cancel window</p>
          <p className="text-2xl font-extrabold text-rose-700">{formatINR(worstCase)}</p>
          <p className="text-[11px] text-rose-600 mt-0.5">Estimate based on the terms found in your document.</p>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <DollarSign className="h-4 w-4 text-teal-600" />
          Subscription Breakdown
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-[11px] text-slate-500 font-medium">Per Month</p>
            <p className="text-lg font-extrabold text-slate-900">{formatINR(breakdown.pricePerMonth)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-[11px] text-slate-500 font-medium">Annual Renewal Cost</p>
            <p className="text-lg font-extrabold text-slate-900">{formatINR(breakdown.pricePerYear)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-[11px] text-slate-500 font-medium">Early Exit Fee</p>
            <p className="text-lg font-extrabold text-rose-700">{formatINR(breakdown.exitCost)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-[11px] text-slate-500 font-medium">Auto-Renews?</p>
            <p className="text-base font-extrabold text-slate-900">{sub.autoRenews ? "⚠ Yes" : "No"}</p>
          </div>
        </div>
        <ShowWorking>
          <WorkingRow label="Billed price" value={formatINR(sub.price)} />
          <WorkingRow label="Billing period" value={`${sub.billingPeriodMonths} months`} />
          <WorkingRow label="Monthly cost" value={formatINR(breakdown.pricePerMonth)} />
          <WorkingRow label="Annual = monthly × 12" value={formatINR(breakdown.pricePerYear)} />
          {sub.cancelNoticeDays != null && (
            <WorkingRow label="Cancel notice required" value={`${sub.cancelNoticeDays} days`} />
          )}
        </ShowWorking>
      </div>
    </div>
  );
}

function RentalSection({ rental }: { rental: NonNullable<AnalyzeResponse["terms"]["rental"]> }) {
  const breakdown = useMemo(() => calcRental(rental), [rental]);
  const [exitMonth, setExitMonth] = useState(Math.min(3, (rental.lockInMonths ?? 6) - 1));
  const exit = useMemo(() => breakdown.earlyExitCost(exitMonth), [breakdown, exitMonth]);

  const worstCase = exit.totalLiability + (rental.deposit ?? 0);

  return (
    <div className="space-y-4">
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-rose-800">Worst-case cost if you exit early</p>
          <p className="text-2xl font-extrabold text-rose-700">{formatINR(worstCase)}</p>
          <p className="text-[11px] text-rose-600 mt-0.5">Estimate based on the terms found in your document.</p>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <DollarSign className="h-4 w-4 text-teal-600" />
          Rental Breakdown
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-[11px] text-slate-500 font-medium">Monthly Rent</p>
            <p className="text-lg font-extrabold text-slate-900">{formatINR(rental.monthlyRent)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-[11px] text-slate-500 font-medium">Security Deposit</p>
            <p className="text-lg font-extrabold text-slate-900">{formatINR(rental.deposit ?? 0)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-[11px] text-slate-500 font-medium">Lock-in Period</p>
            <p className="text-lg font-extrabold text-slate-900">{rental.lockInMonths ? `${rental.lockInMonths} mo` : "None"}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-[11px] text-slate-500 font-medium">Notice Period</p>
            <p className="text-lg font-extrabold text-slate-900">{rental.noticeMonths ? `${rental.noticeMonths} mo` : "None"}</p>
          </div>
        </div>

        {/* Lock-in total */}
        {rental.lockInMonths && rental.lockInMonths > 0 && (
          <div className="bg-amber-50 rounded-xl p-3 text-xs flex justify-between items-center text-amber-900 font-medium">
            <span>Guaranteed rent for lock-in ({rental.lockInMonths} months):</span>
            <span className="font-extrabold">{formatINR(breakdown.lockInTotalRent)}</span>
          </div>
        )}

        {/* Early exit interactive slider */}
        {rental.lockInMonths && rental.lockInMonths > 1 && (
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
              <span>Exit after month {exitMonth}</span>
              <span className="text-teal-700 font-bold">{exitMonth} of {rental.lockInMonths} mo</span>
            </div>
            <input
              type="range"
              min={0}
              max={rental.lockInMonths - 1}
              value={exitMonth}
              onChange={(e) => setExitMonth(Number(e.target.value))}
              className="w-full accent-teal-600"
            />
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-amber-50 rounded-xl p-3 text-center">
                <p className="text-[11px] text-amber-700 font-medium">Rent for remaining lock-in</p>
                <p className="text-base font-extrabold text-amber-800">{formatINR(exit.rentForRemaining)}</p>
              </div>
              <div className="bg-rose-50 rounded-xl p-3 text-center">
                <p className="text-[11px] text-rose-700 font-medium">Deposit at risk</p>
                <p className="text-base font-extrabold text-rose-800">{formatINR(exit.deposit)}</p>
              </div>
            </div>
          </div>
        )}

        <ShowWorking>
          <WorkingRow label="Monthly rent" value={formatINR(rental.monthlyRent)} />
          {rental.lockInMonths != null && <WorkingRow label="Lock-in months" value={`${rental.lockInMonths}`} />}
          {rental.annualEscalationPct != null && <WorkingRow label="Annual escalation" value={`${rental.annualEscalationPct}%`} />}
          <WorkingRow label="Remaining lock-in months" value={`${exit.remainingLockIn}`} />
          <WorkingRow label="Rent for remaining" value={formatINR(exit.rentForRemaining)} />
          <WorkingRow label="Notice period rent" value={formatINR(exit.noticePeriodRent)} />
          <WorkingRow label="Total liability" value={formatINR(exit.totalLiability)} />
        </ShowWorking>
      </div>
    </div>
  );
}

// ─── Main Export ───────────────────────────────────────────────────────────────

export default function DatesCostsPanel({ result }: DatesCostsPanelProps) {
  const hasTerms = result.terms.loan || result.terms.subscription || result.terms.rental;

  return (
    <div className="space-y-8">
      {/* Deadlines */}
      <section>
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-teal-700" />
          Key Deadlines
        </h3>
        <DeadlinesSection result={result} />
      </section>

      {/* Costs */}
      <section>
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-teal-700" />
          Financial Summary
        </h3>
        {!hasTerms ? (
          <div className="flex items-center gap-3 p-5 bg-slate-50 rounded-2xl border border-slate-200 text-sm text-slate-500">
            <Info className="h-5 w-5 text-slate-400 shrink-0" />
            No financial terms (loan, subscription, or rental) were extracted from this document.
          </div>
        ) : (
          <div className="space-y-6">
            {result.terms.loan && <LoanSection loan={result.terms.loan} />}
            {result.terms.subscription && <SubscriptionSection sub={result.terms.subscription} />}
            {result.terms.rental && <RentalSection rental={result.terms.rental} />}
          </div>
        )}
      </section>

      <p className="text-[11px] text-slate-400 text-center pb-2">
        All figures are estimates based on terms found in the document. Verify with your lender or landlord.
      </p>
    </div>
  );
}
