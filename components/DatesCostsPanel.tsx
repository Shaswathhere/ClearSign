"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  Calendar, Download, ChevronDown, ChevronUp, AlertTriangle, Clock, DollarSign, Info,
} from "lucide-react";
import { AnalyzeResponse } from "@/lib/schema";
import type { RelativeRule } from "@/lib/schema";
import { resolveDeadlines, ResolvedDeadline } from "@/lib/dates";
import { calcLoan, calcSubscription, calcRental } from "@/lib/costs";
import { buildIcsContent, deadlinesToIcsEvents, downloadIcs } from "@/lib/ics";

interface DatesCostsPanelProps {
  result: AnalyzeResponse;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function DaysChip({ days }: { days: number | null }) {
  if (days === null) return null;
  if (days < 0) return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{ backgroundColor: "var(--sev-high-tint)", color: "var(--sev-high)" }}>
      PAST
    </span>
  );
  if (days <= 7) return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{ backgroundColor: "var(--sev-high-tint)", color: "var(--sev-high)" }}>
      <AlertTriangle className="h-3 w-3" strokeWidth={1.75} />
      {days}d left
    </span>
  );
  if (days <= 30) return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{ backgroundColor: "var(--sev-med-tint)", color: "var(--sev-med)" }}>
      {days}d away
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{ backgroundColor: "var(--surface-2)", color: "var(--foreground-2)", border: "1px solid var(--border)" }}>
      {days}d away
    </span>
  );
}

function WorkingRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex justify-between text-xs py-1.5 border-b last:border-0"
      style={{ borderColor: "var(--border)" }}
    >
      <span style={{ color: "var(--foreground-2)" }}>{label}</span>
      <span className="font-semibold" style={{ color: "var(--foreground)" }}>{value}</span>
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
        className="flex items-center gap-1 text-[11px] font-semibold transition-colors"
        style={{ color: "var(--primary)" }}
      >
        {open ? <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.75} /> : <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} />}
        Show working
      </button>
      {open && (
        <div
          className="mt-2 rounded-xl p-3 space-y-0"
          style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }}
        >
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

  const resolved = useMemo<ResolvedDeadline[]>(
    () => resolveDeadlines(result.deadlines, anchorDates),
    [result.deadlines, anchorDates]
  );

  const handleDownloadIcs = useCallback(() => {
    const events = deadlinesToIcsEvents(resolved);
    if (events.length === 0) return;
    const content = buildIcsContent(events);
    downloadIcs(content);
  }, [resolved]);

  const icsCount = useMemo(
    () => resolved.filter((d) => d.isoDate && !d.isPast).length,
    [resolved]
  );

  if (!result.deadlines.length) {
    return (
      <div
        className="flex items-center gap-3 p-5 rounded-2xl text-sm"
        style={{
          backgroundColor: "var(--surface-2)",
          border: "1px solid var(--border)",
          color: "var(--foreground-2)",
        }}
      >
        <Calendar className="h-5 w-5 shrink-0" style={{ color: "var(--muted)" }} strokeWidth={1.75} />
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
        <div
          className="rounded-2xl p-4 space-y-3"
          style={{
            backgroundColor: "var(--primary-tint)",
            border: "1px solid var(--primary-border)",
          }}
        >
          <p
            className="text-xs font-semibold flex items-center gap-1.5"
            style={{ color: "var(--primary)" }}
          >
            <Info className="h-3.5 w-3.5" strokeWidth={1.75} />
            Set dates from your contract to resolve deadlines
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {anchorTypes.map((key) => (
              <div key={key} className="space-y-1">
                <label
                  className="text-[11px] font-semibold block"
                  style={{ color: "var(--primary)" }}
                >
                  {anchorLabels[key]}
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl px-3 py-2 text-xs outline-none transition-all"
                  style={{
                    backgroundColor: "var(--surface-2)",
                    color: "var(--foreground)",
                    border: "1px solid var(--border)",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "var(--ring)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
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
            className="rounded-2xl p-4 space-y-2"
            style={{
              backgroundColor: d.isPast ? "var(--surface-2)" : "var(--surface)",
              border: "1px solid var(--border)",
              opacity: d.isPast ? 0.6 : 1,
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Clock
                  className="h-4 w-4 shrink-0"
                  style={{ color: d.isPast ? "var(--muted)" : "var(--primary)" }}
                  strokeWidth={1.75}
                />
                <span className="text-xs font-bold truncate" style={{ color: "var(--foreground)" }}>
                  {d.label}
                </span>
                <span
                  className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full font-mono"
                  style={{
                    backgroundColor: "var(--primary-tint)",
                    color: "var(--primary)",
                    border: "1px solid var(--primary-border)",
                  }}
                >
                  {d.clauseId}
                </span>
              </div>
              <DaysChip days={d.daysFromNow} />
            </div>
            {d.formattedDate && (
              <p className="text-xs font-semibold ml-6" style={{ color: "var(--foreground)" }}>
                {d.formattedDate}
              </p>
            )}
            {!d.formattedDate && (
              <p className="text-[11px] ml-6 italic" style={{ color: "var(--muted)" }}>
                Set the anchor date above to resolve this deadline.
              </p>
            )}
            <blockquote
              className="text-[11px] italic pl-3 ml-6 leading-relaxed"
              style={{
                color: "var(--foreground-2)",
                borderLeft: "2px solid var(--border-strong)",
              }}
            >
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
        className="flex items-center gap-2 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          height: "48px",
          borderRadius: "0.75rem",
          backgroundColor: "var(--primary)",
          color: "var(--primary-foreground)",
          paddingLeft: "1rem",
          paddingRight: "1rem",
        }}
        onMouseEnter={(e) => {
          if (icsCount > 0) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--primary-hover)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = "var(--primary)";
        }}
      >
        <Download className="h-4 w-4" strokeWidth={1.75} />
        Add to calendar ({icsCount} event{icsCount !== 1 ? "s" : ""}) .ics
      </button>
    </div>
  );
}

// ─── Stat tile helper ──────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div
      className="rounded-xl p-3 text-center"
      style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
    >
      <p className="text-[11px] font-medium" style={{ color: "var(--foreground-2)" }}>
        {label}
      </p>
      <p
        className="text-lg font-extrabold"
        style={{ color: valueColor ?? "var(--foreground)" }}
      >
        {value}
      </p>
    </div>
  );
}

// ─── Cost Section ─────────────────────────────────────────────────────────────

function LoanSection({ loan }: { loan: NonNullable<AnalyzeResponse["terms"]["loan"]> }) {
  const breakdown = useMemo(() => calcLoan(loan), [loan]);
  const [exitMonth, setExitMonth] = useState(Math.floor(loan.tenureMonths / 2));
  const prepay = useMemo(
    () => breakdown.prepaymentCost(exitMonth),
    [breakdown, exitMonth]
  );
  const worstCase = Math.max(breakdown.totalInterest, prepay.outstandingPrincipal + prepay.penaltyAmount);

  return (
    <div className="space-y-4">
      {/* Worst-case headline */}
      <div
        className="rounded-2xl p-4 flex items-start gap-3"
        style={{
          backgroundColor: "var(--sev-high-tint)",
          border: "1px solid var(--sev-high)",
        }}
      >
        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "var(--sev-high)" }} strokeWidth={1.75} />
        <div>
          <p className="text-xs font-semibold" style={{ color: "var(--sev-high)" }}>Worst-case cost</p>
          <p className="text-2xl font-extrabold" style={{ color: "var(--sev-high)" }}>{formatINR(worstCase)}</p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--foreground-2)" }}>
            Estimate based on the terms found in your document.
          </p>
        </div>
      </div>

      <div
        className="rounded-2xl p-4 space-y-3 border"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2 text-sm font-bold" style={{ color: "var(--foreground)" }}>
          <DollarSign className="h-4 w-4" style={{ color: "var(--primary)" }} strokeWidth={1.75} />
          Loan Breakdown
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Monthly EMI"    value={formatINR(breakdown.emi)} />
          <StatTile label="Total Interest" value={formatINR(breakdown.totalInterest)} valueColor="var(--sev-med)" />
          <StatTile label="Total Payable"  value={formatINR(breakdown.totalPayable)} />
          <StatTile label="Processing Fee" value={formatINR(breakdown.processingFee)} />
        </div>

        {/* Prepayment slider */}
        <div className="pt-2 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
          <div className="flex justify-between items-center text-xs font-semibold">
            <span style={{ color: "var(--foreground-2)" }}>Prepay after month {exitMonth}</span>
            <span style={{ color: "var(--primary)" }}>{exitMonth} of {loan.tenureMonths} mo</span>
          </div>
          <input
            type="range"
            min={1}
            max={loan.tenureMonths - 1}
            value={exitMonth}
            onChange={(e) => setExitMonth(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: "var(--primary)" }}
          />
          <div className="grid grid-cols-2 gap-3 pt-1">
            <StatTile label="Interest saved" value={formatINR(prepay.interestSaved)} valueColor="var(--sev-low)" />
            <StatTile label="Penalty fee"    value={formatINR(prepay.penaltyAmount)} valueColor="var(--sev-high)" />
          </div>
          <p className="text-[11px] text-center" style={{ color: "var(--foreground-2)" }}>
            Net savings by prepaying:{" "}
            <strong style={{ color: "var(--sev-low)" }}>{formatINR(prepay.netSavings)}</strong>
          </p>
        </div>

        <ShowWorking>
          <WorkingRow label="Principal (P)"                       value={formatINR(loan.principal)} />
          <WorkingRow label="Annual Interest Rate (R)"            value={`${loan.annualRatePct}% p.a.`} />
          <WorkingRow label="Tenure (N)"                          value={`${loan.tenureMonths} months`} />
          <WorkingRow label="Formula: P × r × (1+r)ᴺ / ((1+r)ᴺ - 1)" value={`Monthly r = ${(loan.annualRatePct / 12).toFixed(3)}%`} />
          <WorkingRow label="Total Interest = (EMI × N) - P"     value={formatINR(breakdown.totalInterest)} />
          {loan.processingFeePct != null && (
            <WorkingRow label={`Processing fee (${loan.processingFeePct}%)`} value={formatINR(breakdown.processingFee)} />
          )}
          {loan.prepaymentPenaltyPct != null && (
            <WorkingRow label="Prepayment penalty" value={`${loan.prepaymentPenaltyPct}% of outstanding`} />
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
      <div
        className="rounded-2xl p-4 flex items-start gap-3"
        style={{ backgroundColor: "var(--sev-high-tint)", border: "1px solid var(--sev-high)" }}
      >
        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "var(--sev-high)" }} strokeWidth={1.75} />
        <div>
          <p className="text-xs font-semibold" style={{ color: "var(--sev-high)" }}>
            Worst-case cost if you miss the cancel window
          </p>
          <p className="text-2xl font-extrabold" style={{ color: "var(--sev-high)" }}>{formatINR(worstCase)}</p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--foreground-2)" }}>
            Estimate based on the terms found in your document.
          </p>
        </div>
      </div>
      <div
        className="rounded-2xl p-4 space-y-3 border"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2 text-sm font-bold" style={{ color: "var(--foreground)" }}>
          <DollarSign className="h-4 w-4" style={{ color: "var(--primary)" }} strokeWidth={1.75} />
          Subscription Breakdown
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Per Month"          value={formatINR(breakdown.pricePerMonth)} />
          <StatTile label="Annual Renewal Cost" value={formatINR(breakdown.pricePerYear)} />
          <StatTile label="Early Exit Fee"      value={formatINR(breakdown.exitCost)} valueColor="var(--sev-high)" />
          <StatTile label="Auto-Renews?"        value={sub.autoRenews ? "Yes" : "No"} valueColor={sub.autoRenews ? "var(--sev-high)" : "var(--sev-low)"} />
        </div>
        <ShowWorking>
          <WorkingRow label="Billed price"       value={formatINR(sub.price)} />
          <WorkingRow label="Billing period"     value={`${sub.billingPeriodMonths} months`} />
          <WorkingRow label="Monthly cost"       value={formatINR(breakdown.pricePerMonth)} />
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
      <div
        className="rounded-2xl p-4 flex items-start gap-3"
        style={{ backgroundColor: "var(--sev-high-tint)", border: "1px solid var(--sev-high)" }}
      >
        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "var(--sev-high)" }} strokeWidth={1.75} />
        <div>
          <p className="text-xs font-semibold" style={{ color: "var(--sev-high)" }}>Worst-case cost if you exit early</p>
          <p className="text-2xl font-extrabold" style={{ color: "var(--sev-high)" }}>{formatINR(worstCase)}</p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--foreground-2)" }}>
            Estimate based on the terms found in your document.
          </p>
        </div>
      </div>
      <div
        className="rounded-2xl p-4 space-y-3 border"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2 text-sm font-bold" style={{ color: "var(--foreground)" }}>
          <DollarSign className="h-4 w-4" style={{ color: "var(--primary)" }} strokeWidth={1.75} />
          Rental Breakdown
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Monthly Rent"    value={formatINR(rental.monthlyRent)} />
          <StatTile label="Security Deposit" value={formatINR(rental.deposit ?? 0)} />
          <StatTile label="Lock-in Period"  value={rental.lockInMonths ? `${rental.lockInMonths} mo` : "None"} />
          <StatTile label="Notice Period"   value={rental.noticeMonths ? `${rental.noticeMonths} mo` : "None"} />
        </div>

        {rental.lockInMonths && rental.lockInMonths > 0 && (
          <div
            className="rounded-xl p-3 text-xs flex justify-between items-center font-medium"
            style={{
              backgroundColor: "var(--sev-med-tint)",
              color: "var(--sev-med)",
              border: "1px solid var(--sev-med)",
            }}
          >
            <span>Guaranteed rent for lock-in ({rental.lockInMonths} months):</span>
            <span className="font-extrabold">{formatINR(breakdown.lockInTotalRent)}</span>
          </div>
        )}

        {rental.lockInMonths && rental.lockInMonths > 1 && (
          <div className="pt-2 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
            <div className="flex justify-between items-center text-xs font-semibold">
              <span style={{ color: "var(--foreground-2)" }}>Exit after month {exitMonth}</span>
              <span style={{ color: "var(--primary)" }}>{exitMonth} of {rental.lockInMonths} mo</span>
            </div>
            <input
              type="range"
              min={0}
              max={rental.lockInMonths - 1}
              value={exitMonth}
              onChange={(e) => setExitMonth(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: "var(--primary)" }}
            />
            <div className="grid grid-cols-2 gap-3 pt-1">
              <StatTile label="Rent for remaining lock-in" value={formatINR(exit.rentForRemaining)} valueColor="var(--sev-med)" />
              <StatTile label="Deposit at risk" value={formatINR(exit.deposit)} valueColor="var(--sev-high)" />
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
        <h3
          className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2"
          style={{ color: "var(--foreground)" }}
        >
          <Calendar className="h-4 w-4" style={{ color: "var(--primary)" }} strokeWidth={1.75} />
          Key Deadlines
        </h3>
        <DeadlinesSection result={result} />
      </section>

      {/* Costs */}
      <section>
        <h3
          className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2"
          style={{ color: "var(--foreground)" }}
        >
          <DollarSign className="h-4 w-4" style={{ color: "var(--primary)" }} strokeWidth={1.75} />
          Financial Summary
        </h3>
        {!hasTerms ? (
          <div
            className="flex items-center gap-3 p-5 rounded-2xl text-sm"
            style={{
              backgroundColor: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--foreground-2)",
            }}
          >
            <Info className="h-5 w-5 shrink-0" style={{ color: "var(--muted)" }} strokeWidth={1.75} />
            No financial terms (loan, subscription, or rental) were extracted from this document.
          </div>
        ) : (
          <div className="space-y-6">
            {result.terms.loan         && <LoanSection         loan={result.terms.loan} />}
            {result.terms.subscription && <SubscriptionSection sub={result.terms.subscription} />}
            {result.terms.rental       && <RentalSection       rental={result.terms.rental} />}
          </div>
        )}
      </section>

      <p className="text-[11px] text-center pb-2" style={{ color: "var(--muted)" }}>
        All figures are estimates based on terms found in the document. Verify with your lender or landlord.
      </p>
    </div>
  );
}
