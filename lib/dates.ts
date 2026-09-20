/**
 * lib/dates.ts - Relative deadline resolver (Phase 4)
 * Converts RelativeRule + anchor date -> ISO date string
 */

import { addDays, addWeeks, addMonths, addYears, subDays, subWeeks, subMonths, subYears, format } from "date-fns";
import type { Deadline, RelativeRule } from "./schema";

export interface ResolvedDeadline {
  clauseId: string;
  label: string;
  quote: string;
  isoDate: string | null;   // null if not resolvable
  daysFromNow: number | null;
  isPast: boolean;
  formattedDate: string | null;
}

/**
 * Resolve a single RelativeRule against anchor dates.
 * anchorDates: map of anchor name -> ISO date string (e.g. from contract)
 */
export function resolveRelativeRule(
  rule: RelativeRule,
  anchorDates: Partial<Record<RelativeRule["anchor"], string>>,
  referenceDate: Date = new Date()
): Date | null {
  const anchorStr = anchorDates[rule.anchor];
  const base: Date = anchorStr ? new Date(anchorStr) : referenceDate;

  if (isNaN(base.getTime())) return null;

  const { n, unit, direction } = rule;
  const isBefore = direction === "before";

  switch (unit) {
    case "day":
      return isBefore ? subDays(base, n) : addDays(base, n);
    case "week":
      return isBefore ? subWeeks(base, n) : addWeeks(base, n);
    case "month":
      return isBefore ? subMonths(base, n) : addMonths(base, n);
    case "year":
      return isBefore ? subYears(base, n) : addYears(base, n);
    default:
      return null;
  }
}

/**
 * Resolve all deadlines in an analysis result.
 */
export function resolveDeadlines(
  deadlines: Deadline[],
  anchorDates: Partial<Record<RelativeRule["anchor"], string>> = {},
  referenceDate: Date = new Date()
): ResolvedDeadline[] {
  return deadlines.map((d) => {
    let resolvedDate: Date | null = null;

    // 1. Use absolute date if provided
    if (d.absoluteDate) {
      const parsed = new Date(d.absoluteDate);
      if (!isNaN(parsed.getTime())) resolvedDate = parsed;
    }

    // 2. Fall back to relative resolution
    if (!resolvedDate && d.relative) {
      resolvedDate = resolveRelativeRule(d.relative, anchorDates, referenceDate);
    }

    const now = referenceDate;
    const isoDate = resolvedDate ? format(resolvedDate, "yyyy-MM-dd") : null;
    const daysFromNow = resolvedDate
      ? Math.round((resolvedDate.getTime() - now.getTime()) / 86400000)
      : null;
    const isPast = daysFromNow !== null ? daysFromNow < 0 : false;
    const formattedDate = resolvedDate ? format(resolvedDate, "dd MMM yyyy") : null;

    return {
      clauseId: d.clauseId,
      label: d.label,
      quote: d.quote,
      isoDate,
      daysFromNow,
      isPast,
      formattedDate,
    };
  });
}
