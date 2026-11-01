import React, { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import type { BoardLogEntry, OfficeCategory, OutcomeType, UiLanguage } from "../types";
import { CATEGORY_LABELS, PUBLIC_OFFICES } from "../data/offices";
import { UI_COPY } from "../i18n";

interface BoardViewProps {
  uiLang: UiLanguage;
  logs: BoardLogEntry[];
  onAddAnonymousOutcome: (entry: Omit<BoardLogEntry, "id" | "loggedAt" | "isSample">) => void;
}

interface AggregatedDeptStats {
  officeId: string;
  department: string;
  category: OfficeCategory;
  replied: number;
  rejected: number;
  ignored: number;
  total: number;
  userSubmittedCount: number;
  responseRate: number;
}

export const BoardView: React.FC<BoardViewProps> = ({
  uiLang,
  logs,
  onAddAnonymousOutcome,
}) => {
  const t = UI_COPY[uiLang];

  const [selectedOfficeId, setSelectedOfficeId] = useState<string>(PUBLIC_OFFICES[0].id);
  const [selectedOutcome, setSelectedOutcome] = useState<OutcomeType>("replied");
  const [justLoggedMessage, setJustLoggedMessage] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<"highest" | "lowest" | "volume">("highest");
  const [tappedRedactedId, setTappedRedactedId] = useState<string | null>(null);

  const { ranked, worstOfficeId } = useMemo(() => {
    const map = new Map<string, AggregatedDeptStats>();

    for (const entry of logs) {
      const existing = map.get(entry.officeId) || {
        officeId: entry.officeId,
        department: entry.department,
        category: entry.category,
        replied: 0,
        rejected: 0,
        ignored: 0,
        total: 0,
        userSubmittedCount: 0,
        responseRate: 0,
      };

      existing[entry.outcome] += 1;
      existing.total += 1;
      if (!entry.isSample) {
        existing.userSubmittedCount += 1;
      }
      map.set(entry.officeId, existing);
    }

    const fullList = Array.from(map.values()).map((item) => ({
      ...item,
      responseRate: item.total > 0 ? Math.round((item.replied / item.total) * 100) : 0,
    }));

    // Identify the worst-responding department across the dataset
    const sortedWorstFirst = [...fullList].sort(
      (a, b) => a.responseRate - b.responseRate || b.ignored - a.ignored
    );
    const worstId = sortedWorstFirst[0]?.officeId ?? "";

    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? fullList.filter(
          (d) =>
            d.department.toLowerCase().includes(q) ||
            CATEGORY_LABELS[d.category].en.toLowerCase().includes(q) ||
            CATEGORY_LABELS[d.category].hi.includes(q)
        )
      : fullList;

    const sorted = filtered.sort((a, b) => {
      if (sortMode === "highest") {
        return b.responseRate - a.responseRate || b.total - a.total;
      }
      if (sortMode === "lowest") {
        return a.responseRate - b.responseRate || b.ignored - a.ignored;
      }
      return b.total - a.total || b.responseRate - a.responseRate;
    });

    return { ranked: sorted, worstOfficeId: worstId };
  }, [logs, searchQuery, sortMode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const office = PUBLIC_OFFICES.find((o) => o.id === selectedOfficeId) || PUBLIC_OFFICES[0];
    onAddAnonymousOutcome({
      officeId: office.id,
      department: office.department,
      category: office.category,
      outcome: selectedOutcome,
    });
    setJustLoggedMessage(
      uiLang === "hi"
        ? `अनाम रिपोर्ट दर्ज: ${office.department}`
        : `LOGGED · ${office.department}`
    );
    setTimeout(() => setJustLoggedMessage(null), 4000);
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-10 lg:px-16 py-10 sm:py-16 space-y-12 sm:space-y-14">
      {/* Visible Banner: "Illustrative sample data, not real statistics." */}
      <div
        role="note"
        className="w-full bg-[#E5EDF1] border border-[#002349]/25 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-2"
      >
        <p className="font-body text-sm sm:text-base font-semibold text-[#002349]">
          {t.sampleDataBanner}
        </p>
        <span className="font-mono-file text-xs uppercase tracking-widest text-[#002349]/80">
          SAMPLE DATA · LOCAL LEDGER
        </span>
      </div>

      {/* Header */}
      <div className="border-b border-[#002349]/15 pb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4 max-w-3xl">
          <div className="font-mono-file text-sm uppercase tracking-[0.14em] text-[#957C3D] font-bold">
            PUBLIC ACCOUNTABILITY INDEX · CITIZEN DISCLOSURES
          </div>
          <h1 className="font-editorial text-[#002349] section-display-size">
            {t.boardHeading}
          </h1>
          <p className="font-body text-base sm:text-lg text-[#0B1B33]/80">
            {t.boardSub}
          </p>
        </div>

        <div className="shrink-0 self-start md:self-end">
          <span className="rubber-stamp text-[#002349] bg-white text-xs -rotate-3">
            SAMPLE DATA
          </span>
        </div>
      </div>

      {/* Anonymous Outcome Logger Card */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border-x border-b border-[#002349]/15 border-t-[3px] border-t-[#C9A24B] shadow-[0_8px_24px_rgba(0,35,73,0.04)] p-5 sm:p-8 space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono-file text-xs font-bold uppercase tracking-[0.14em] text-[#002349]">
            {t.logOutcomeTitle}
          </span>
          <span className="font-mono-file text-xs text-[#7A8794]">
            ZERO PERSONAL DATA COLLECTED
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
          <div className="lg:col-span-6">
            <label
              htmlFor="board-dept-select"
              className="font-mono-file text-xs uppercase tracking-wider text-[#7A8794] block mb-2"
            >
              PUBLIC DEPARTMENT (42 GENERIC OFFICES)
            </label>
            <select
              id="board-dept-select"
              value={selectedOfficeId}
              onChange={(e) => setSelectedOfficeId(e.target.value)}
              className="w-full min-h-[46px] px-3 bg-[#FAFBFC] border-0 border-b border-[#002349] font-body text-sm text-[#0B1B33] focus:outline-none"
            >
              {PUBLIC_OFFICES.map((office) => (
                <option key={office.id} value={office.id}>
                  [{CATEGORY_LABELS[office.category][uiLang]}] {office.department}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-4">
            <span className="font-mono-file text-xs uppercase tracking-wider text-[#7A8794] block mb-2">
              OUTCOME
            </span>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: "replied", label: t.repliedLabel, color: "#2E7D4F" },
                  { key: "rejected", label: t.rejectedLabel, color: "#C8341F" },
                  { key: "ignored", label: t.ignoredLabel, color: "#7A8794" },
                ] as Array<{ key: OutcomeType; label: string; color: string }>
              ).map((opt) => {
                const active = selectedOutcome === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSelectedOutcome(opt.key)}
                    style={active ? { backgroundColor: opt.color, color: "#FFFFFF" } : {}}
                    className={`min-h-[42px] px-4 rounded-full font-mono-file text-xs uppercase tracking-wider transition-colors ${
                      active
                        ? "border border-transparent"
                        : "border border-[#002349]/30 text-[#002349] hover:border-[#002349]"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-2">
            <button
              type="submit"
              className="w-full min-h-[46px] px-5 rounded-full bg-[#002349] hover:bg-[#00142B] text-white font-body text-sm font-medium transition-colors duration-200 whitespace-nowrap"
            >
              {t.submitOutcomeBtn}
            </button>
          </div>
        </div>

        {justLoggedMessage && (
          <p className="font-mono-file text-xs text-[#2E7D4F] inline-flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            <span>{justLoggedMessage}</span>
          </p>
        )}
      </form>

      {/* Filter & Sort Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative max-w-md w-full">
          <Search className="w-4 h-4 text-[#7A8794] absolute left-0 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={uiLang === "hi" ? "विभाग खोजें..." : "Filter departments..."}
            className="w-full min-h-[42px] pl-7 pr-3 bg-transparent border-0 border-b border-[#002349]/40 focus:border-[#002349] font-body text-sm text-[#0B1B33] focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: "highest", label: "HIGHEST REPLY %" },
              { id: "lowest", label: "WORST SILENCE FIRST" },
              { id: "volume", label: "MOST FILINGS" },
            ] as const
          ).map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setSortMode(mode.id)}
              className={`min-h-[36px] px-4 rounded-full font-mono-file text-xs uppercase tracking-wider transition-colors ${
                sortMode === mode.id
                  ? "bg-[#002349] text-white"
                  : "border border-[#002349]/25 text-[#002349] hover:border-[#002349]"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* White Rows with Thin Navy Rule, Department Names in Fraunces, Green/Red/Slate Bars, Big Navy Percentages */}
      <div className="bg-white border-y border-[#002349]/25 divide-y divide-[#002349]/15">
        {ranked.map((dept, index) => {
          const isWorst = dept.officeId === worstOfficeId;
          const isTapRevealed = tappedRedactedId === dept.officeId;
          const repliedPct = dept.total > 0 ? (dept.replied / dept.total) * 100 : 0;
          const rejectedPct = dept.total > 0 ? (dept.rejected / dept.total) * 100 : 0;
          const ignoredPct = dept.total > 0 ? (dept.ignored / dept.total) * 100 : 0;

          return (
            <div
              key={dept.officeId}
              onClick={() => {
                if (isWorst) {
                  setTappedRedactedId(isTapRevealed ? null : dept.officeId);
                }
              }}
              className={`py-6 sm:py-7 px-4 sm:px-7 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-center group hover:bg-[#FAFBFC] transition-colors ${
                isWorst ? "cursor-pointer" : ""
              }`}
            >
              {/* Rank (Mono) & Department Name (Fraunces) */}
              <div className="lg:col-span-6 flex items-start gap-4 sm:gap-5">
                <span className="font-mono-file text-xl sm:text-2xl font-bold text-[#002349] pt-1 shrink-0">
                  {String(index + 1).padStart(2, "0")}.
                </span>

                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="font-mono-file text-[11px] uppercase tracking-wider text-[#7A8794] flex flex-wrap items-center gap-2">
                    <span>{CATEGORY_LABELS[dept.category][uiLang]}</span>
                    <span>·</span>
                    <span>
                      {dept.userSubmittedCount > 0
                        ? `SAMPLE DATA + ${dept.userSubmittedCount} USER LOG`
                        : "SAMPLE DATA"}
                    </span>
                    {isWorst && (
                      <>
                        <span>·</span>
                        <span className="text-[#C8341F] font-bold">LOWEST RESPONSE RATE</span>
                      </>
                    )}
                  </div>

                  {/* Department Title in Fraunces — partly covered by Deep Navy redaction bar if worst offender */}
                  <div className="relative inline-block max-w-full overflow-hidden py-0.5">
                    <h3 className="font-editorial text-xl sm:text-2xl font-medium text-[#0B1B33] leading-snug">
                      {dept.department}
                    </h3>

                    {isWorst && (
                      <div
                        aria-hidden="true"
                        className={`absolute inset-y-0 left-0 right-[12%] bg-[#00142B] text-[#C9A24B] px-3 flex items-center justify-between font-mono-file text-[10px] sm:text-[11px] tracking-widest uppercase transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                          isTapRevealed
                            ? "-translate-y-full"
                            : "group-hover:-translate-y-full"
                        }`}
                      >
                        <span className="truncate">
                          REDACTED · HOVER OR TAP TO LIFT
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Green / Red / Slate Horizontal Proportional Bars + Mono Counts */}
              <div className="lg:col-span-4 space-y-2">
                <div className="w-full h-3.5 bg-[#E5EDF1] flex overflow-hidden">
                  <div
                    style={{ width: `${repliedPct}%`, backgroundColor: "#2E7D4F" }}
                    className="h-full transition-all duration-700"
                    title={`Replied: ${dept.replied}`}
                  />
                  <div
                    style={{ width: `${rejectedPct}%`, backgroundColor: "#C8341F" }}
                    className="h-full transition-all duration-700"
                    title={`Rejected: ${dept.rejected}`}
                  />
                  <div
                    style={{ width: `${ignoredPct}%`, backgroundColor: "#7A8794" }}
                    className="h-full transition-all duration-700"
                    title={`Ignored: ${dept.ignored}`}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 font-mono-file text-xs">
                  <span style={{ color: "#2E7D4F" }} className="font-semibold">
                    REPLIED {dept.replied}
                  </span>
                  <span style={{ color: "#C8341F" }} className="font-semibold">
                    REJECTED {dept.rejected}
                  </span>
                  <span style={{ color: "#7A8794" }} className="font-semibold">
                    IGNORED {dept.ignored}
                  </span>
                </div>
              </div>

              {/* Big Percentages in Navy (#002349) */}
              <div className="lg:col-span-2 lg:text-right flex lg:flex-col items-baseline lg:items-end justify-between">
                <span className="font-mono-file text-3xl sm:text-4xl font-bold text-[#002349]">
                  {dept.responseRate}%
                </span>
                <span className="font-mono-file text-[11px] uppercase tracking-wider text-[#7A8794]">
                  REPLY RATE (N={dept.total})
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
