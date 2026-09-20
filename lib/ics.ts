/**
 * lib/ics.ts - Calendar export to .ics format (Phase 4)
 */

import type { ResolvedDeadline } from "./dates";

export interface IcsEvent {
  title: string;
  date: string; // ISO yyyy-MM-dd
  description: string;
}

/**
 * Build ICS file content from resolved deadlines (browser-side only).
 * Uses raw ICS string generation for broad compatibility.
 */
export function buildIcsContent(events: IcsEvent[]): string {
  const now = new Date();
  const stamp = formatDtStamp(now);

  const eventBlocks = events.map((ev, i) => {
    const [year, month, day] = ev.date.split("-").map(Number);
    const dtStart = `${String(year).padStart(4, "0")}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
    const uid = `clearsign-${i}-${Date.now()}@clearsign.app`;

    return [
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dtStart}`,
      `DTEND;VALUE=DATE:${dtStart}`,
      `SUMMARY:${escapeIcs(ev.title)}`,
      `DESCRIPTION:${escapeIcs(ev.description)}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcs(ev.title)}`,
      "TRIGGER:-P1D",
      "END:VALARM",
      "END:VEVENT",
    ].join("\r\n");
  });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ClearSign//ClearSign 1.0//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:ClearSign Contract Deadlines",
    ...eventBlocks,
    "END:VCALENDAR",
  ].join("\r\n");
}

/**
 * Convert resolved deadlines to ICS events.
 */
export function deadlinesToIcsEvents(deadlines: ResolvedDeadline[]): IcsEvent[] {
  return deadlines
    .filter((d) => d.isoDate !== null && !d.isPast)
    .map((d) => ({
      title: `[ClearSign] ${d.label}`,
      date: d.isoDate!,
      description: `Contract deadline: ${d.label}\\n\\nRelevant clause: "${d.quote.slice(0, 200)}"`,
    }));
}

/**
 * Trigger a browser download of the .ics file.
 */
export function downloadIcs(content: string, filename = "clearsign-deadlines.ics"): void {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatDtStamp(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "")
    .slice(0, 15) + "Z";
}

function escapeIcs(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}
