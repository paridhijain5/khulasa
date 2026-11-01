export type DemoFastForwardDays = 0 | 31 | 65;

export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysToIso(isoDate: string, daysToAdd: number): string {
  const parts = isoDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return getTodayIsoDate();
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  dt.setUTCDate(dt.getUTCDate() + daysToAdd);
  return dt.toISOString().slice(0, 10);
}

export function formatReadableDate(isoDate: string, lang: "en" | "hi" = "en"): string {
  if (!isoDate) return "—";
  const parts = isoDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return isoDate;
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  return dt.toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export interface SilenceClockMetrics {
  filingDate: string;
  statutoryDeadlineDate: string; // Filing + 30 days
  firstAppealWindowEndDate: string; // Deadline + 30 days
  daysElapsed: number;
  daysRemaining: number;
  overdueDays: number;
  isFirstAppealUnlocked: boolean; // >= 30 days elapsed
  isSecondAppealUnlocked: boolean; // >= 60 days elapsed OR firstAppealFiled + 30d
  progressRatio: number; // 0..1 capped at 30 days
  clockPhase: "counting" | "urgent" | "overdue" | "second_appeal_ready";
}

export function computeSilenceClock(
  filingDateIso: string,
  demoOffsetDays: DemoFastForwardDays = 0,
  firstAppealFiledDateIso?: string
): SilenceClockMetrics {
  const safeFiling = filingDateIso || getTodayIsoDate();
  const [fy, fm, fd] = safeFiling.split("-").map(Number);
  const filingUtc = Date.UTC(fy, (fm || 1) - 1, fd || 1);

  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  const realDiffDays = Math.max(0, Math.floor((todayUtc - filingUtc) / (1000 * 60 * 60 * 24)));
  const daysElapsed = realDiffDays + demoOffsetDays;

  const statutoryDeadlineDate = addDaysToIso(safeFiling, 30);
  const firstAppealWindowEndDate = addDaysToIso(safeFiling, 60);

  const daysRemaining = Math.max(0, 30 - daysElapsed);
  const overdueDays = Math.max(0, daysElapsed - 30);
  const isFirstAppealUnlocked = daysElapsed >= 30;

  let daysSinceFirstAppeal = 0;
  if (firstAppealFiledDateIso) {
    const [ay, am, ad] = firstAppealFiledDateIso.split("-").map(Number);
    const faUtc = Date.UTC(ay, (am || 1) - 1, ad || 1);
    daysSinceFirstAppeal = Math.max(0, Math.floor((todayUtc - faUtc) / (1000 * 60 * 60 * 24))) + demoOffsetDays;
  }

  // Second appeal under Section 19(3) unlocks if >= 60 days total silence OR >= 30 days since First Appeal
  const isSecondAppealUnlocked = daysElapsed >= 60 || (Boolean(firstAppealFiledDateIso) && daysSinceFirstAppeal >= 30);

  const progressRatio = Math.min(1, Math.max(0, daysElapsed / 30));

  let clockPhase: SilenceClockMetrics["clockPhase"] = "counting";
  if (isSecondAppealUnlocked) {
    clockPhase = "second_appeal_ready";
  } else if (isFirstAppealUnlocked) {
    clockPhase = "overdue";
  } else if (daysElapsed >= 23) {
    clockPhase = "urgent";
  }

  return {
    filingDate: safeFiling,
    statutoryDeadlineDate,
    firstAppealWindowEndDate,
    daysElapsed,
    daysRemaining,
    overdueDays,
    isFirstAppealUnlocked,
    isSecondAppealUnlocked,
    progressRatio,
    clockPhase,
  };
}
