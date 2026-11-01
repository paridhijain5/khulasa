import React, { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Calendar, Download, Loader2, RefreshCw, Trash2 } from "lucide-react";
import type { AppealDocument, OutcomeType, RtiRecord, UiLanguage } from "../types";
import {
  computeSilenceClock,
  DemoFastForwardDays,
  formatReadableDate,
  getTodayIsoDate,
} from "../utils/dateAndClock";
import { downloadRtiDeadlineIcs } from "../utils/icsGenerator";
import { downloadAppealPdf, downloadRtiApplicationPdf } from "../utils/pdfGenerator";
import { UI_COPY } from "../i18n";

interface SilenceClockCardProps {
  record: RtiRecord;
  fileIndexNumber: number;
  uiLang: UiLanguage;
  demoOffsetDays: DemoFastForwardDays;
  onUpdateRecord: (updated: RtiRecord) => void;
  onDeleteRecord: (id: string) => void;
  onLogOutcomeFromRti: (record: RtiRecord, outcome: OutcomeType) => void;
  onCycleDemoMode: (nextOffset: DemoFastForwardDays) => void;
}

const EDITORIAL_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function buildPostalFrankingWavePath(
  cx: number,
  cy: number,
  baseR: number,
  amplitude: number,
  waves: number
): string {
  const steps = 280;
  let path = "";
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    const r = baseR + amplitude * Math.sin(waves * theta);
    const x = cx + r * Math.cos(theta);
    const y = cy + r * Math.sin(theta);
    path += i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return `${path} Z`;
}

// 320x320 postal seal geometry with strictly separated concentric bands
const POSTAL_SEAL_OUTER_320 = buildPostalFrankingWavePath(160, 160, 148, 5, 36);

type FolderStampStatus =
  | "FILED"
  | "AWAITING REPLY"
  | "OVERDUE"
  | "APPEAL DRAFTED"
  | "ANSWERED";

function getFolderStampStatus(
  record: RtiRecord,
  isOverdue: boolean,
  daysElapsed: number
): { label: FolderStampStatus; color: string } {
  if (record.outcomeLogged === "replied" || record.filingStatus === "resolved") {
    return { label: "ANSWERED", color: "#2E7D4F" };
  }
  if (record.firstAppeal || record.secondAppeal) {
    return { label: "APPEAL DRAFTED", color: "#002349" };
  }
  if (isOverdue) {
    return { label: "OVERDUE", color: "#C8341F" };
  }
  if (record.filingStatus === "filed" && daysElapsed <= 2) {
    return { label: "FILED", color: "#002349" };
  }
  return { label: "AWAITING REPLY", color: "#002349" };
}

export const SilenceClockCard: React.FC<SilenceClockCardProps> = ({
  record,
  fileIndexNumber,
  uiLang,
  demoOffsetDays,
  onUpdateRecord,
  onDeleteRecord,
  onLogOutcomeFromRti,
  onCycleDemoMode,
}) => {
  const t = UI_COPY[uiLang];
  const reduceMotion = useReducedMotion();
  const svgUid = useId().replace(/:/g, "");
  const isFiled = record.filingStatus !== "draft";

  const clock = computeSilenceClock(
    record.filingDate,
    demoOffsetDays,
    record.firstAppealFiledDate
  );

  const [draftingStage, setDraftingStage] = useState<"first" | "second" | null>(null);
  const [appealError, setAppealError] = useState<string | null>(null);
  const [spinRotation, setSpinRotation] = useState<number>(0);

  const prevDemoOffsetRef = useRef<DemoFastForwardDays>(demoOffsetDays);
  const autoDraftAttemptedFirstRef = useRef(false);
  const autoDraftAttemptedSecondRef = useRef(false);

  // Spin postal franking seal forward whenever TIME TRAVEL (DEMO) advances
  useEffect(() => {
    if (demoOffsetDays !== prevDemoOffsetRef.current) {
      if (demoOffsetDays > prevDemoOffsetRef.current) {
        setSpinRotation((prev) => prev + 360);
      } else {
        setSpinRotation((prev) => prev - 180);
      }
      prevDemoOffsetRef.current = demoOffsetDays;
    }
  }, [demoOffsetDays]);

  const generateAppealWithGemini = async (stage: "first" | "second") => {
    if (draftingStage) return;
    setDraftingStage(stage);
    setAppealError(null);

    try {
      const res = await fetch("/api/rti/appeal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage,
          outputLanguage: record.outputLanguage,
          rtiSubject: record.subject,
          rtiSummary: record.summary,
          questions: record.questions,
          department: record.office.department,
          pioDesignation: record.office.pioDesignation,
          jurisdiction: record.office.jurisdiction,
          filingDate: formatReadableDate(record.filingDate, record.outputLanguage),
          deadlineDate: formatReadableDate(clock.statutoryDeadlineDate, record.outputLanguage),
          daysElapsed: clock.daysElapsed,
          firstAppealDate: record.firstAppealFiledDate
            ? formatReadableDate(record.firstAppealFiledDate, record.outputLanguage)
            : stage === "second"
            ? formatReadableDate(clock.statutoryDeadlineDate, record.outputLanguage)
            : undefined,
          referenceNumber: record.referenceNumber,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not auto-draft appeal.");
      }

      const appealDoc: AppealDocument = {
        stage,
        generatedAt: new Date().toISOString(),
        authorityTitle:
          data.authorityTitle ||
          (stage === "second" ? record.office.commissionName : record.office.faaDesignation),
        authorityDepartment:
          data.authorityDepartment ||
          (stage === "second" ? record.office.commissionName : record.office.department),
        subject: data.subject,
        factsAndChronology: Array.isArray(data.factsAndChronology) ? data.factsAndChronology : [],
        legalGrounds: Array.isArray(data.legalGrounds) ? data.legalGrounds : [],
        prayer: Array.isArray(data.prayer) ? data.prayer : [],
        enclosuresList: Array.isArray(data.enclosuresList) ? data.enclosuresList : [],
      };

      const nextRecord: RtiRecord =
        stage === "first"
          ? { ...record, firstAppeal: appealDoc }
          : { ...record, secondAppeal: appealDoc };

      onUpdateRecord(nextRecord);
    } catch (err: unknown) {
      setAppealError(err instanceof Error ? err.message : "Failed to auto-draft appeal.");
    } finally {
      setDraftingStage(null);
    }
  };

  useEffect(() => {
    if (
      isFiled &&
      record.filingStatus !== "resolved" &&
      clock.isFirstAppealUnlocked &&
      !record.firstAppeal &&
      !autoDraftAttemptedFirstRef.current
    ) {
      autoDraftAttemptedFirstRef.current = true;
      void generateAppealWithGemini("first");
    }
  }, [isFiled, record.filingStatus, clock.isFirstAppealUnlocked, record.firstAppeal]);

  useEffect(() => {
    if (
      isFiled &&
      record.filingStatus !== "resolved" &&
      clock.isSecondAppealUnlocked &&
      record.firstAppeal &&
      !record.secondAppeal &&
      !autoDraftAttemptedSecondRef.current
    ) {
      autoDraftAttemptedSecondRef.current = true;
      void generateAppealWithGemini("second");
    }
  }, [
    isFiled,
    record.filingStatus,
    clock.isSecondAppealUnlocked,
    record.firstAppeal,
    record.secondAppeal,
  ]);

  const fileCode = `KH-2026-${String(fileIndexNumber).padStart(4, "0")}`;
  const folderStamp = getFolderStampStatus(record, clock.isFirstAppealUnlocked, clock.daysElapsed);

  const isAnswered = record.outcomeLogged === "replied" || record.filingStatus === "resolved";
  const isOverdueActive = clock.isFirstAppealUnlocked && !isAnswered;

  const progressStrokeColor = isAnswered
    ? "#2E7D4F"
    : isOverdueActive
    ? "#C8341F"
    : "#002349";

  const numeralColor = isAnswered
    ? "#2E7D4F"
    : isOverdueActive
    ? "#C8341F"
    : "#002349";

  // Progress arc at r=88 (well inside r=104 separator and r=118 curved text ring)
  const innerProgressR = 88;
  const innerCircumference = 2 * Math.PI * innerProgressR;
  const innerDashoffset = innerCircumference * (1 - clock.progressRatio);

  return (
    <article className="w-full">
      {/* Navy Manila Folder Top Tab (375px-safe) */}
      <div className="flex items-end justify-between gap-2">
        <div className="manila-tab bg-[#002349] text-white px-4 sm:px-7 py-2.5 inline-flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="font-mono-file text-[11px] font-bold uppercase tracking-widest text-[#C9A24B] shrink-0">
            {record.office.category}
          </span>
          <span className="text-white/45">·</span>
          <span className="font-mono-file text-[11px] uppercase tracking-wider text-[#E5EDF1] truncate max-w-[140px] sm:max-w-xs">
            {record.isSampleDemo ? "SAMPLE DOSSIER" : "CITIZEN DOSSIER"}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onDeleteRecord(record.id)}
          className="font-mono-file text-[11px] sm:text-xs text-[#7A8794] hover:text-[#C8341F] pb-2 inline-flex items-center gap-1 transition-colors shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{uiLang === "hi" ? "हटाएं" : "DISCARD"}</span>
        </button>
      </div>

      {/* White Manila-Style Folder Card with 3px Gold Top Border */}
      <div className="bg-white border-x border-b border-[#002349]/15 border-t-[3px] border-t-[#C9A24B] shadow-[0_10px_30px_rgba(0,35,73,0.05)] p-5 sm:p-10 lg:p-12 relative overflow-hidden">
        {/* Top Row: Navy File Number, Department, Subject & Slamming Rubber-Stamp Status */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-5 pb-8 border-b border-[#002349]/12">
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5 font-mono-file text-xs uppercase tracking-[0.12em]">
              <span className="text-[#002349] font-bold text-sm">{fileCode}</span>
              <span className="text-[#7A8794]">·</span>
              <span className="text-[#957C3D] font-bold">{record.office.department}</span>
            </div>
            <h2 className="font-editorial text-2xl sm:text-4xl text-[#002349] leading-tight">
              {record.subject}
            </h2>
            <p className="font-body text-sm sm:text-base text-[#0B1B33]/85 leading-relaxed">
              {record.summary}
            </p>
          </div>

          {/* Rubber-Stamp Status in Navy Outline (Red for OVERDUE, Green for ANSWERED) */}
          <div className="shrink-0 pt-1 md:pt-2 self-start">
            <AnimatePresence mode="wait">
              <motion.div
                key={folderStamp.label}
                initial={
                  reduceMotion
                    ? false
                    : { scale: 1.4, opacity: 0, rotate: -10 }
                }
                animate={{ scale: 1, opacity: 1, rotate: -5 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{
                  type: "spring",
                  stiffness: 460,
                  damping: 18,
                  mass: 0.85,
                }}
                style={{ color: folderStamp.color }}
                className="rubber-stamp text-xs sm:text-sm bg-white"
              >
                {folderStamp.label}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Middle Section: Postal Franking Seal + Case Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 py-10 items-center">
          {/* Postal Franking Seal Silence Clock */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
            <motion.div
              key={isOverdueActive ? `overdue-shake-${demoOffsetDays}` : "calm-seal"}
              animate={
                !reduceMotion && isOverdueActive
                  ? {
                      x: [0, -7, 7, -5, 5, -2, 0],
                      rotate: [0, -1.6, 1.6, -0.8, 0],
                    }
                  : { x: 0, rotate: 0 }
              }
              transition={{ duration: 0.42, delay: 0.16 }}
              className="relative w-[264px] h-[264px] sm:w-[316px] sm:h-[316px] flex items-center justify-center"
            >
              {/* Spinning Wavy Postal Franking Seal */}
              <motion.svg
                viewBox="0 0 320 320"
                animate={{ rotate: reduceMotion ? 0 : spinRotation }}
                transition={{ duration: 0.85, ease: EDITORIAL_EASE }}
                className="w-full h-full"
                aria-hidden="true"
              >
                <defs>
                  <path
                    id={`topArc-${svgUid}`}
                    d="M 42,160 A 118,118 0 1,1 278,160"
                  />
                  <path
                    id={`bottomArc-${svgUid}`}
                    d="M 36,160 A 124,124 0 0,0 284,160"
                  />
                </defs>

                {/* 1. Gold Wavy Cancellation Perimeter (r ~ 148) */}
                <path
                  d={POSTAL_SEAL_OUTER_320}
                  fill="#FAFBFC"
                  stroke={isAnswered ? "#2E7D4F" : "#C9A24B"}
                  strokeWidth="2.5"
                />

                {/* 2. Outer Postmark Guide Ring (r = 136) */}
                <circle
                  cx="160"
                  cy="160"
                  r="136"
                  fill="none"
                  stroke="#002349"
                  strokeWidth="1"
                  opacity="0.3"
                />

                {/* 3. Dedicated Curved Text Band (r = 118..124, zero overlap with progress arc) */}
                <text
                  fill="#002349"
                  fontSize="11.5"
                  fontWeight="700"
                  letterSpacing="3.5"
                  className="font-mono-file uppercase"
                >
                  <textPath href={`#topArc-${svgUid}`} startOffset="50%" textAnchor="middle">
                    INDIA RTI · SEC 7(1)
                  </textPath>
                </text>

                <text
                  fill="#7A8794"
                  fontSize="10"
                  fontWeight="600"
                  letterSpacing="2.8"
                  className="font-mono-file uppercase"
                >
                  <textPath href={`#bottomArc-${svgUid}`} startOffset="50%" textAnchor="middle">
                    STATUTORY 30-DAY SEAL
                  </textPath>
                </text>

                {/* 4. Dashed Postmark Separator Ring (r = 104) */}
                <circle
                  cx="160"
                  cy="160"
                  r="104"
                  fill="none"
                  stroke="#957C3D"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                  opacity="0.7"
                />

                {/* 5. Inner 30-Day Progress Arc (r = 88) */}
                <circle
                  cx="160"
                  cy="160"
                  r={innerProgressR}
                  fill="none"
                  stroke="#E5EDF1"
                  strokeWidth="6"
                />
                {isFiled && (
                  <circle
                    cx="160"
                    cy="160"
                    r={innerProgressR}
                    fill="none"
                    stroke={progressStrokeColor}
                    strokeWidth="6"
                    strokeLinecap="butt"
                    strokeDasharray={innerCircumference}
                    strokeDashoffset={innerDashoffset}
                    transform="rotate(-90 160 160)"
                  />
                )}
              </motion.svg>

              {/* 6. Center Numerical Readout (strictly inside r < 76) */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-12 pointer-events-none">
                <span
                  style={{ color: numeralColor }}
                  className="font-mono-file text-5xl sm:text-6xl font-bold leading-none tracking-tight"
                >
                  {!isFiled
                    ? "30"
                    : clock.isFirstAppealUnlocked
                    ? "00"
                    : String(clock.daysRemaining).padStart(2, "0")}
                </span>

                <span className="font-mono-file text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0B1B33] mt-2">
                  {!isFiled
                    ? uiLang === "hi"
                      ? "दिन (अप्रारंभित)"
                      : "DAYS (UNFILED)"
                    : clock.isFirstAppealUnlocked
                    ? uiLang === "hi"
                      ? `+${clock.overdueDays} दिन विलंब`
                      : `+${clock.overdueDays}D OVERDUE`
                    : uiLang === "hi"
                    ? "दिन शेष"
                    : "DAYS LEFT"}
                </span>

                <span className="font-mono-file text-[10px] text-[#7A8794] mt-1">
                  DUE {formatReadableDate(clock.statutoryDeadlineDate, "en").toUpperCase()}
                </span>
              </div>

              {/* Rotated Red OVERDUE Stamp Slamming Over the Seal */}
              <AnimatePresence>
                {isOverdueActive && (
                  <motion.div
                    key="seal-overdue-slam"
                    initial={
                      reduceMotion
                        ? false
                        : { scale: 1.4, opacity: 0, rotate: -15 }
                    }
                    animate={{ scale: 1, opacity: 0.96, rotate: -11 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{
                      type: "spring",
                      stiffness: 470,
                      damping: 17,
                      delay: 0.14,
                    }}
                    className="absolute bottom-5 sm:bottom-6 rubber-stamp text-[#C8341F] bg-white/95 text-xs sm:text-sm pointer-events-none"
                  >
                    OVERDUE
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* TIME TRAVEL (DEMO) Pills */}
            <div className="mt-6 space-y-2 text-center">
              <span className="font-mono-file text-[10px] uppercase tracking-[0.16em] text-[#7A8794] block">
                {t.timeTravelTitle}
              </span>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => onCycleDemoMode(0)}
                  className={`min-h-[36px] px-4 rounded-full font-mono-file text-xs transition-colors ${
                    demoOffsetDays === 0
                      ? "bg-[#002349] text-white"
                      : "border border-[#002349]/30 text-[#002349] hover:border-[#002349]"
                  }`}
                >
                  LIVE (0D)
                </button>
                <button
                  type="button"
                  onClick={() => onCycleDemoMode(31)}
                  className={`min-h-[36px] px-4 rounded-full font-mono-file text-xs font-semibold transition-colors ${
                    demoOffsetDays === 31
                      ? "bg-[#C8341F] text-white"
                      : "border border-[#002349]/30 text-[#002349] hover:border-[#002349]"
                  }`}
                >
                  +30D
                </button>
                <button
                  type="button"
                  onClick={() => onCycleDemoMode(65)}
                  className={`min-h-[36px] px-4 rounded-full font-mono-file text-xs font-semibold transition-colors ${
                    demoOffsetDays === 65
                      ? "bg-[#00142B] text-[#C9A24B]"
                      : "border border-[#002349]/30 text-[#002349] hover:border-[#002349]"
                  }`}
                >
                  +60D
                </button>
              </div>
            </div>
          </div>

          {/* Right Side: Case Dates, Portal Reference, PDF & Calendar Pills, Outcome Log */}
          <div className="lg:col-span-7 space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor={`filed-on-${record.id}`}
                  className="block font-mono-file text-xs uppercase tracking-wider text-[#7A8794] mb-2"
                >
                  {uiLang === "hi" ? "दाखिल करने की तिथि" : "DATE FILED"}
                </label>
                <input
                  id={`filed-on-${record.id}`}
                  type="date"
                  max={getTodayIsoDate()}
                  value={record.filingDate}
                  onChange={(e) =>
                    onUpdateRecord({
                      ...record,
                      filingDate: e.target.value,
                      filingStatus:
                        record.filingStatus === "draft" ? "filed" : record.filingStatus,
                    })
                  }
                  className="w-full min-h-[44px] px-3 py-2 font-mono-file text-sm bg-[#FAFBFC] border-0 border-b border-[#002349]/40 focus:border-[#002349] text-[#0B1B33]"
                />
              </div>

              <div>
                <label
                  htmlFor={`postal-ref-${record.id}`}
                  className="block font-mono-file text-xs uppercase tracking-wider text-[#7A8794] mb-2"
                >
                  {uiLang === "hi" ? "पंजीकरण / स्पीड पोस्ट नं." : "RECEIPT / PORTAL NO."}
                </label>
                <input
                  id={`postal-ref-${record.id}`}
                  type="text"
                  placeholder="e.g. ED84920192IN"
                  value={record.referenceNumber}
                  onChange={(e) =>
                    onUpdateRecord({
                      ...record,
                      referenceNumber: e.target.value,
                    })
                  }
                  className="w-full min-h-[44px] px-3 py-2 font-mono-file text-sm bg-[#FAFBFC] border-0 border-b border-[#002349]/40 focus:border-[#002349] text-[#0B1B33]"
                />
              </div>
            </div>

            {/* Gazette Navy Primary Pill Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              {record.filingStatus === "draft" && (
                <button
                  type="button"
                  onClick={() =>
                    onUpdateRecord({
                      ...record,
                      filingStatus: "filed",
                      filingDate: record.filingDate || getTodayIsoDate(),
                    })
                  }
                  className="min-h-[46px] px-6 py-2.5 rounded-full bg-[#002349] hover:bg-[#00142B] text-white font-body text-sm font-medium transition-colors whitespace-nowrap"
                >
                  {uiLang === "hi" ? "फ़ाइल दर्ज करें व घड़ी चलाएं" : "Confirm Filing & Start Clock"}
                </button>
              )}

              <button
                type="button"
                onClick={() => downloadRtiApplicationPdf(record)}
                className="min-h-[46px] px-6 py-2.5 rounded-full bg-[#002349] hover:bg-[#00142B] text-white font-body text-sm font-medium inline-flex items-center gap-2 transition-colors duration-200 whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                <span>{uiLang === "hi" ? "मूल आरटीआई PDF" : "Original RTI PDF"}</span>
              </button>

              <button
                type="button"
                onClick={() => downloadRtiDeadlineIcs(record)}
                className="min-h-[46px] px-6 py-2.5 rounded-full border border-[#002349] hover:bg-[#E5EDF1] text-[#002349] font-body text-sm font-medium inline-flex items-center gap-2 transition-colors duration-200 whitespace-nowrap"
              >
                <Calendar className="w-4 h-4" />
                <span>{t.downloadIcsBtn}</span>
              </button>
            </div>

            {/* Anonymous Outcome Stamp Strip */}
            <div className="pt-6 border-t border-[#002349]/12 space-y-2.5">
              <span className="font-mono-file text-xs uppercase tracking-wider text-[#7A8794] block">
                {record.outcomeLogged
                  ? `OUTCOME RECORDED ON BOARD · ${record.outcomeLogged.toUpperCase()}`
                  : uiLang === "hi"
                  ? "विभाग की प्रतिक्रिया अनाम रूप से दर्ज करें:"
                  : "LOG ANONYMOUS DEPARTMENT OUTCOME:"}
              </span>
              <div className="flex flex-wrap items-center gap-2.5">
                {(
                  [
                    { key: "replied", label: t.repliedLabel, activeBg: "#2E7D4F" },
                    { key: "rejected", label: t.rejectedLabel, activeBg: "#C8341F" },
                    { key: "ignored", label: t.ignoredLabel, activeBg: "#7A8794" },
                  ] as Array<{ key: OutcomeType; label: string; activeBg: string }>
                ).map((item) => {
                  const selected = record.outcomeLogged === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => onLogOutcomeFromRti(record, item.key)}
                      style={selected ? { backgroundColor: item.activeBg, color: "#FFFFFF" } : {}}
                      className={`min-h-[38px] px-4 py-1.5 rounded-full font-mono-file text-xs uppercase tracking-wider transition-colors ${
                        selected
                          ? "border border-transparent"
                          : "border border-[#002349]/30 text-[#002349] hover:border-[#002349]"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* SLIDE-UP DECLASSIFIED APPEAL PAGE WHEN 30 DAYS PASS */}
        <AnimatePresence>
          {clock.isFirstAppealUnlocked && (
            <motion.div
              key="appeal-sheet-slideup"
              initial={reduceMotion ? false : { opacity: 0, y: 56 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.72, delay: 0.2, ease: EDITORIAL_EASE }}
              className="mt-4 bg-[#FAFBFC] border border-[#002349]/15 border-t-[3px] border-t-[#002349] p-5 sm:p-10 space-y-8"
            >
              {/* First Appeal explicitly citing Section 19(1) of the RTI Act, 2005 */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#002349]/12 pb-5">
                <div className="space-y-1.5 max-w-xl">
                  <span className="font-mono-file text-xs uppercase tracking-[0.14em] text-[#957C3D] font-bold">
                    SECTION 19(1), RTI ACT 2005 · DEEMED REFUSAL (SEC 7(2))
                  </span>
                  <h3 className="font-editorial text-2xl sm:text-3xl text-[#002349]">
                    {uiLang === "hi"
                      ? "प्रथम अपील — सूचना का अधिकार अधिनियम, 2005 की धारा 19(1)"
                      : "First Appeal under Section 19(1), RTI Act 2005"}
                  </h3>
                  <p className="font-body text-sm text-[#0B1B33]/80">
                    {uiLang === "hi"
                      ? "30 दिन बीत जाने के कारण धारा 7(6) के अंतर्गत अब संपूर्ण सूचना निःशुल्क देय है।"
                      : "30 days have expired without reply. Under Section 7(6) of the RTI Act, 2005, all requested records must now be supplied free of charge."}
                  </p>
                </div>

                {record.firstAppeal && (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => downloadAppealPdf(record, record.firstAppeal!)}
                      className="min-h-[44px] px-5 sm:px-6 py-2.5 rounded-full bg-[#002349] hover:bg-[#00142B] text-white font-body text-xs sm:text-sm font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap"
                    >
                      <Download className="w-4 h-4" />
                      <span>{t.downloadFirstAppealPdfBtn}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => generateAppealWithGemini("first")}
                      disabled={Boolean(draftingStage)}
                      className="min-h-[44px] w-11 rounded-full border border-[#002349]/25 flex items-center justify-center text-[#002349] hover:border-[#002349]"
                      title="Regenerate Section 19(1) First Appeal"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {appealError && (
                <div className="p-4 border border-[#C8341F] text-sm text-[#C8341F] flex items-center justify-between gap-4">
                  <span>{appealError}</span>
                  <button
                    type="button"
                    onClick={() => generateAppealWithGemini("first")}
                    className="font-mono-file text-xs underline uppercase"
                  >
                    RETRY
                  </button>
                </div>
              )}

              {draftingStage === "first" && (
                <div className="py-8 flex items-center gap-3 font-mono-file text-xs sm:text-sm text-[#002349]">
                  <Loader2 className="w-4 h-4 animate-spin text-[#957C3D] shrink-0" />
                  <span>
                    TYPING FIRST APPEAL UNDER SECTION 19(1) OF THE RTI ACT, 2005...
                  </span>
                </div>
              )}

              {record.firstAppeal ? (
                <div className="space-y-5 font-body text-sm text-[#0B1B33] leading-relaxed">
                  <div className="font-mono-file text-xs text-[#7A8794]">
                    TO: {record.firstAppeal.authorityTitle} — {record.firstAppeal.authorityDepartment}
                  </div>
                  <div className="font-semibold text-base bg-[#C9A24B]/22 text-[#0B1B33] px-3 py-1.5 inline-block">
                    Subject: {record.firstAppeal.subject}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    <div className="space-y-2">
                      <span className="font-mono-file text-xs uppercase tracking-wider text-[#7A8794] block">
                        CHRONOLOGY OF SILENCE
                      </span>
                      <ol className="list-decimal pl-5 space-y-1.5 text-[#0B1B33]/90">
                        {record.firstAppeal.factsAndChronology.map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ol>
                    </div>
                    <div className="space-y-2">
                      <span className="font-mono-file text-xs uppercase tracking-wider text-[#7A8794] block">
                        STATUTORY GROUNDS (SECTION 19(1) & SEC 7)
                      </span>
                      <ol className="list-decimal pl-5 space-y-1.5 text-[#0B1B33]/90">
                        {record.firstAppeal.legalGrounds.map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </div>
              ) : (
                !draftingStage && (
                  <button
                    type="button"
                    onClick={() => generateAppealWithGemini("first")}
                    className="min-h-[46px] px-7 py-2.5 rounded-full bg-[#002349] hover:bg-[#00142B] text-white font-body text-sm font-medium"
                  >
                    {t.draftFirstAppealBtn}
                  </button>
                )
              )}

              {/* Second Appeal explicitly citing Section 19(3) of the RTI Act, 2005 */}
              <div className="pt-6 border-t border-[#002349]/12 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="font-mono-file text-xs uppercase tracking-wider text-[#957C3D] font-bold block">
                      SECTION 19(3), RTI ACT 2005 · {record.office.commissionName}
                    </span>
                    <h4 className="font-editorial text-xl sm:text-2xl text-[#002349]">
                      {uiLang === "hi"
                        ? "द्वितीय अपील — सूचना का अधिकार अधिनियम, 2005 की धारा 19(3)"
                        : "Second Appeal to Information Commission under Section 19(3), RTI Act 2005"}
                    </h4>
                  </div>

                  {record.secondAppeal ? (
                    <button
                      type="button"
                      onClick={() => downloadAppealPdf(record, record.secondAppeal!)}
                      className="min-h-[42px] px-5 sm:px-6 py-2 rounded-full bg-[#002349] hover:bg-[#00142B] text-white font-body text-xs sm:text-sm font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap"
                    >
                      <Download className="w-4 h-4" />
                      <span>{t.downloadSecondAppealPdfBtn}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => generateAppealWithGemini("second")}
                      disabled={Boolean(draftingStage)}
                      className="min-h-[42px] px-5 sm:px-6 py-2 rounded-full border border-[#002349] hover:bg-[#002349] hover:text-white text-[#002349] font-body text-xs sm:text-sm font-medium transition-colors whitespace-nowrap"
                    >
                      {draftingStage === "second"
                        ? "Drafting Sec 19(3) Appeal..."
                        : t.draftSecondAppealBtn}
                    </button>
                  )}
                </div>

                {record.secondAppeal && (
                  <div className="pt-2 space-y-2 text-sm text-[#0B1B33]/90">
                    <div className="font-mono-file text-xs text-[#7A8794]">
                      BEFORE: {record.secondAppeal.authorityTitle}
                    </div>
                    <p className="font-semibold bg-[#C9A24B]/22 text-[#0B1B33] px-3 py-1 inline-block">
                      {record.secondAppeal.subject}
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                      {record.secondAppeal.prayer.map((p, idx) => (
                        <li key={idx}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </article>
  );
};
