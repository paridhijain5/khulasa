import React from "react";
import { Plus } from "lucide-react";
import type { NavSection, OutcomeType, RtiRecord, UiLanguage } from "../types";
import { UI_COPY } from "../i18n";
import { DemoFastForwardDays } from "../utils/dateAndClock";
import { SilenceClockCard } from "./SilenceClockCard";

interface MyRtisViewProps {
  uiLang: UiLanguage;
  records: RtiRecord[];
  demoOffsetDays: DemoFastForwardDays;
  onUpdateRecord: (updated: RtiRecord) => void;
  onDeleteRecord: (id: string) => void;
  onLogOutcomeFromRti: (record: RtiRecord, outcome: OutcomeType) => void;
  onCycleDemoMode: (offset: DemoFastForwardDays) => void;
  onNavigate: (section: NavSection) => void;
}

export const MyRtisView: React.FC<MyRtisViewProps> = ({
  uiLang,
  records,
  demoOffsetDays,
  onUpdateRecord,
  onDeleteRecord,
  onLogOutcomeFromRti,
  onCycleDemoMode,
  onNavigate,
}) => {
  const t = UI_COPY[uiLang];

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-10 lg:px-16 py-10 sm:py-16 space-y-14">
      {/* Gazette Section Header */}
      <div className="border-b border-[#002349]/15 pb-10 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-4 max-w-3xl">
          <div className="font-mono-file text-sm uppercase tracking-[0.14em] text-[#957C3D] font-bold">
            CABINET ARCHIVE · STATUTORY 30-DAY SILENCE CLOCKS
          </div>
          <h1 className="font-editorial text-[#002349] section-display-size">
            {t.myRtisHeading}
          </h1>
          <p className="font-body text-base sm:text-lg text-[#0B1B33]/80 leading-relaxed">
            {t.myRtisSub}
          </p>
        </div>

        {/* TIME TRAVEL (DEMO) Fast-Forward Pill Strip */}
        <div className="space-y-2.5 shrink-0">
          <span className="font-mono-file text-[11px] uppercase tracking-widest text-[#002349] font-bold block">
            {t.timeTravelTitle} · SPIN CLOCK FORWARD:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onCycleDemoMode(0)}
              className={`min-h-[42px] px-4 sm:px-5 rounded-full font-mono-file text-xs uppercase tracking-wider transition-colors ${
                demoOffsetDays === 0
                  ? "bg-[#002349] text-white"
                  : "border border-[#002349]/30 text-[#002349] hover:border-[#002349]"
              }`}
            >
              LIVE CLOCK
            </button>
            <button
              type="button"
              onClick={() => onCycleDemoMode(31)}
              className={`min-h-[42px] px-4 sm:px-5 rounded-full font-mono-file text-xs uppercase tracking-wider font-semibold transition-colors ${
                demoOffsetDays === 31
                  ? "bg-[#C8341F] text-white"
                  : "border border-[#002349]/30 text-[#002349] hover:border-[#002349]"
              }`}
            >
              +30D (SEC 19(1))
            </button>
            <button
              type="button"
              onClick={() => onCycleDemoMode(65)}
              className={`min-h-[42px] px-4 sm:px-5 rounded-full font-mono-file text-xs uppercase tracking-wider font-semibold transition-colors ${
                demoOffsetDays === 65
                  ? "bg-[#00142B] text-[#C9A24B]"
                  : "border border-[#002349]/30 text-[#002349] hover:border-[#002349]"
              }`}
            >
              +60D (SEC 19(3))
            </button>
          </div>
        </div>
      </div>

      {/* White Manila-Style Folder Case Stack */}
      {records.length === 0 ? (
        <div className="py-20 border-b border-[#002349]/15 space-y-6">
          <h2 className="font-editorial text-3xl sm:text-4xl text-[#002349]">
            {uiLang === "hi" ? "कैबिनेट में अभी कोई फ़ाइल नहीं है।" : "No active folders in the cabinet."}
          </h2>
          <button
            type="button"
            onClick={() => onNavigate("new")}
            className="min-h-[52px] px-8 py-3.5 rounded-full bg-[#002349] hover:bg-[#00142B] text-white font-body text-base font-medium inline-flex items-center gap-2.5 transition-colors duration-200"
          >
            <Plus className="w-4 h-4" />
            <span>{t.ctaFileRti}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-16">
          {records.map((rec, index) => (
            <SilenceClockCard
              key={rec.id}
              record={rec}
              fileIndexNumber={40 + (records.length - index)}
              uiLang={uiLang}
              demoOffsetDays={demoOffsetDays}
              onUpdateRecord={onUpdateRecord}
              onDeleteRecord={onDeleteRecord}
              onLogOutcomeFromRti={onLogOutcomeFromRti}
              onCycleDemoMode={onCycleDemoMode}
            />
          ))}
        </div>
      )}
    </div>
  );
};
