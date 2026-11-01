import type { RtiRecord } from "../types";
import { addDaysToIso } from "./dateAndClock";

function toIcsDateValue(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function downloadRtiDeadlineIcs(record: RtiRecord): void {
  const filingDate = record.filingDate;
  const day30 = addDaysToIso(filingDate, 30);
  const day31 = addDaysToIso(filingDate, 31);
  const day35 = addDaysToIso(filingDate, 35);
  const day36 = addDaysToIso(filingDate, 36);

  const nowStamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const summaryDeadline = `RTI 30-Day Statutory Deadline: ${record.subject}`;
  const descDeadline = [
    `RTI Application Filed on: ${filingDate}`,
    `Department: ${record.office.department}`,
    `Reference: ${record.referenceNumber || "Not specified"}`,
    `Under Section 7(1) of the RTI Act, 2005, 30 days expire today. If no reply has arrived, open Khulasa to generate your First Appeal under Section 19(1).`,
  ].join("\n");

  const summaryAppeal = `RTI First Appeal Window Check: ${record.subject}`;
  const descAppeal = [
    `35 days since RTI filing (${filingDate}) with ${record.office.department}.`,
    `If no satisfactory reply has been received, file your First Appeal within 30 days of the statutory expiry date.`,
  ].join("\n");

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Team Vanta//Khulasa RTI Companion//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:khulasa-day30-${record.id}@khulasa.local`,
    `DTSTAMP:${nowStamp}`,
    `DTSTART;VALUE=DATE:${toIcsDateValue(day30)}`,
    `DTEND;VALUE=DATE:${toIcsDateValue(day31)}`,
    `SUMMARY:${escapeIcsText(summaryDeadline)}`,
    `DESCRIPTION:${escapeIcsText(descDeadline)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT9H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Khulasa RTI 30-Day Statutory Deadline Today",
    "END:VALARM",
    "END:VEVENT",
    "BEGIN:VEVENT",
    `UID:khulasa-appeal-${record.id}@khulasa.local`,
    `DTSTAMP:${nowStamp}`,
    `DTSTART;VALUE=DATE:${toIcsDateValue(day35)}`,
    `DTEND;VALUE=DATE:${toIcsDateValue(day36)}`,
    `SUMMARY:${escapeIcsText(summaryAppeal)}`,
    `DESCRIPTION:${escapeIcsText(descAppeal)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  const blob = new Blob([icsLines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const slug = record.subject
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  link.download = `khulasa-rti-clock-${slug || "reminder"}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
