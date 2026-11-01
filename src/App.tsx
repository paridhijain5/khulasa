import React, { useEffect, useState } from "react";
import type {
  ApplicantDetails,
  BoardLogEntry,
  NavSection,
  OutcomeType,
  RtiRecord,
  UiLanguage,
} from "./types";
import { UI_COPY } from "./i18n";
import { DemoFastForwardDays } from "./utils/dateAndClock";
import {
  loadApplicantProfile,
  loadBoardLogs,
  loadRtiRecords,
  loadUiLanguage,
  saveApplicantProfile,
  saveBoardLogs,
  saveRtiRecords,
  saveUiLanguage,
} from "./utils/storage";
import { HomeView } from "./components/HomeView";
import { NewRtiWizard } from "./components/NewRtiWizard";
import { MyRtisView } from "./components/MyRtisView";
import { BoardView } from "./components/BoardView";

export default function App() {
  const [uiLang, setUiLang] = useState<UiLanguage>(() => loadUiLanguage());
  const [activeNav, setActiveNav] = useState<NavSection>("home");
  const [demoOffsetDays, setDemoOffsetDays] = useState<DemoFastForwardDays>(0);

  const [rtiRecords, setRtiRecords] = useState<RtiRecord[]>(() => loadRtiRecords());
  const [applicantProfile, setApplicantProfile] = useState<ApplicantDetails>(() =>
    loadApplicantProfile()
  );
  const [boardLogs, setBoardLogs] = useState<BoardLogEntry[]>(() => loadBoardLogs());
  const [prefilledProblem, setPrefilledProblem] = useState<string>("");
  const [autoSubmitIntakeId, setAutoSubmitIntakeId] = useState<number>(0);

  const t = UI_COPY[uiLang];
  const isHome = activeNav === "home";

  // Sync <html lang="..."> so Tiro Devanagari Hindi & 1.25 headline line-height apply globally in Hindi
  useEffect(() => {
    document.documentElement.lang = uiLang;
  }, [uiLang]);

  const handleToggleLang = (lang: UiLanguage) => {
    setUiLang(lang);
    saveUiLanguage(lang);
  };

  const handleUpdateApplicant = (profile: ApplicantDetails) => {
    setApplicantProfile(profile);
    saveApplicantProfile(profile);
  };

  const handleSaveNewRti = (record: RtiRecord, navigateToClocks: boolean) => {
    const next = [record, ...rtiRecords];
    setRtiRecords(next);
    saveRtiRecords(next);
    if (navigateToClocks) {
      setActiveNav("my-rtis");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleUpdateRtiRecord = (updated: RtiRecord) => {
    const next = rtiRecords.map((r) => (r.id === updated.id ? updated : r));
    setRtiRecords(next);
    saveRtiRecords(next);
  };

  const handleDeleteRtiRecord = (id: string) => {
    const next = rtiRecords.filter((r) => r.id !== id);
    setRtiRecords(next);
    saveRtiRecords(next);
  };

  const handleAddBoardOutcome = (
    entry: Omit<BoardLogEntry, "id" | "loggedAt" | "isSample">
  ) => {
    const fullEntry: BoardLogEntry = {
      ...entry,
      id: `user-log-${Date.now()}`,
      loggedAt: new Date().toISOString(),
      isSample: false,
    };
    const nextLogs = [fullEntry, ...boardLogs];
    setBoardLogs(nextLogs);
    saveBoardLogs(nextLogs);
  };

  const handleLogOutcomeFromRti = (record: RtiRecord, outcome: OutcomeType) => {
    handleAddBoardOutcome({
      officeId: record.office.officeId,
      department: record.office.department,
      category: record.office.category,
      outcome,
    });
    handleUpdateRtiRecord({
      ...record,
      outcomeLogged: outcome,
      filingStatus: outcome === "replied" ? "resolved" : record.filingStatus,
    });
  };

  const handleSelectScenario = (
    problemText: string,
    lang: UiLanguage,
    autoDraft = false
  ) => {
    setPrefilledProblem(problemText);
    handleToggleLang(lang);
    if (autoDraft) {
      setAutoSubmitIntakeId(Date.now());
    }
    setActiveNav("new");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const navigateTo = (section: NavSection) => {
    setActiveNav(section);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div
      lang={uiLang}
      className="min-h-screen flex flex-col bg-[#FAFBFC] text-[#0B1B33] pb-14 md:pb-0"
    >
      {/* 1. GAZETTE TOP NAVIGATION (Navy on Hero, Crisp Gazette Page on Inner Views; 375px-safe) */}
      <header
        className={`w-full transition-colors duration-300 ${
          isHome
            ? "bg-[#002349] text-white border-b border-white/12"
            : "bg-[#FAFBFC] text-[#0B1B33] border-b border-[#002349]/12"
        }`}
      >
        <div className="max-w-[1440px] mx-auto px-4 sm:px-10 lg:px-16 h-18 sm:h-20 flex items-center justify-between gap-2 sm:gap-6">
          {/* Left: Khulasa Wordmark */}
          <button
            type="button"
            onClick={() => navigateTo("home")}
            className={`font-editorial text-xl sm:text-3xl font-medium tracking-tight shrink-0 whitespace-nowrap ${
              isHome ? "text-white" : "text-[#002349]"
            }`}
          >
            Khulasa
          </button>

          {/* Middle: Minimal Navigation Links */}
          <nav
            className={`hidden md:flex items-center gap-8 font-body text-sm ${
              isHome ? "text-[#E5EDF1]/85" : "text-[#0B1B33]/80"
            }`}
          >
            {(
              [
                { id: "home", label: t.navHome },
                { id: "new", label: t.navNew },
                { id: "my-rtis", label: `${t.navMyRtis} (${rtiRecords.length})` },
                { id: "board", label: t.navBoard },
              ] as Array<{ id: NavSection; label: string }>
            ).map((link) => {
              const active = activeNav === link.id;
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => navigateTo(link.id)}
                  className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? isHome
                        ? "text-white font-semibold underline decoration-[#C9A24B] decoration-2 underline-offset-8"
                        : "text-[#002349] font-semibold underline decoration-[#957C3D] decoration-2 underline-offset-8"
                      : isHome
                      ? "hover:text-white"
                      : "hover:text-[#002349]"
                  }`}
                >
                  {link.label}
                </button>
              );
            })}
          </nav>

          {/* Right: Hindi/English Toggle Pill + Primary Action Pill */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleToggleLang(uiLang === "en" ? "hi" : "en")}
              aria-label="Toggle Hindi or English"
              className={`min-h-[36px] sm:min-h-[38px] px-2.5 sm:px-3.5 rounded-full font-mono-file text-[11px] sm:text-xs inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
                isHome
                  ? "border border-white/30 hover:border-[#C9A24B] text-white"
                  : "border border-[#002349]/25 hover:border-[#002349] text-[#002349]"
              }`}
            >
              <span
                className={
                  uiLang === "en"
                    ? isHome
                      ? "font-bold text-[#C9A24B]"
                      : "font-bold text-[#002349]"
                    : isHome
                    ? "text-white/70"
                    : "text-[#7A8794]"
                }
              >
                EN
              </span>
              <span className={isHome ? "text-white/45" : "text-[#7A8794]"}>/</span>
              <span
                className={
                  uiLang === "hi"
                    ? isHome
                      ? "font-bold text-[#C9A24B]"
                      : "font-bold text-[#002349]"
                    : isHome
                    ? "text-white/70"
                    : "text-[#7A8794]"
                }
              >
                हिं
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigateTo("new")}
              className={`min-h-[38px] sm:min-h-[40px] px-3.5 sm:px-6 py-2 rounded-full font-body text-xs sm:text-sm font-semibold transition-colors duration-200 whitespace-nowrap shrink-0 ${
                isHome
                  ? "bg-[#C9A24B] hover:bg-[#d7b25d] text-[#002349]"
                  : "bg-[#002349] hover:bg-[#00142B] text-white"
              }`}
            >
              {t.ctaFileRti}
            </button>
          </div>
        </div>
      </header>

      {/* MAIN VIEWPORT */}
      <main className="flex-1 w-full">
        {activeNav === "home" && (
          <HomeView
            uiLang={uiLang}
            records={rtiRecords}
            demoOffsetDays={demoOffsetDays}
            onNavigate={navigateTo}
            onSelectScenario={handleSelectScenario}
            onCycleDemoMode={(offset) => {
              setDemoOffsetDays(offset);
              if (offset > 0) navigateTo("my-rtis");
            }}
          />
        )}

        {activeNav === "new" && (
          <NewRtiWizard
            uiLang={uiLang}
            existingCount={rtiRecords.length}
            prefilledProblem={prefilledProblem}
            autoSubmitIntakeId={autoSubmitIntakeId}
            savedApplicant={applicantProfile}
            onUpdateApplicantProfile={handleUpdateApplicant}
            onSaveRtiRecord={handleSaveNewRti}
          />
        )}

        {activeNav === "my-rtis" && (
          <MyRtisView
            uiLang={uiLang}
            records={rtiRecords}
            demoOffsetDays={demoOffsetDays}
            onUpdateRecord={handleUpdateRtiRecord}
            onDeleteRecord={handleDeleteRtiRecord}
            onLogOutcomeFromRti={handleLogOutcomeFromRti}
            onCycleDemoMode={setDemoOffsetDays}
            onNavigate={navigateTo}
          />
        )}

        {activeNav === "board" && (
          <BoardView
            uiLang={uiLang}
            logs={boardLogs}
            onAddAnonymousOutcome={handleAddBoardOutcome}
          />
        )}
      </main>

      {/* GAZETTE NAVY FOOTER WITH WHITE DISCLAIMER & CROPPED LIGHTER-NAVY WORDMARK */}
      <footer className="w-full bg-[#002349] text-white border-t border-white/12 pt-14 overflow-hidden">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-10 lg:px-16 pb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <p className="font-body text-sm text-white leading-relaxed">
              Khulasa helps you draft. Verify details on the official RTI portal (
              <a
                href="https://rtionline.gov.in"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-[#C9A24B] underline-offset-4 hover:text-[#C9A24B] transition-colors"
              >
                rtionline.gov.in
              </a>
              ).
            </p>
            <p className="font-mono-file text-xs uppercase tracking-[0.14em] text-[#E5EDF1]/75">
              Built by team Vanta
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 sm:gap-6 font-mono-file text-xs uppercase tracking-widest text-[#E5EDF1]">
            <button
              type="button"
              onClick={() => navigateTo("home")}
              className="hover:text-[#C9A24B] transition-colors whitespace-nowrap"
            >
              {t.navHome}
            </button>
            <button
              type="button"
              onClick={() => navigateTo("new")}
              className="hover:text-[#C9A24B] transition-colors whitespace-nowrap"
            >
              {t.navNew}
            </button>
            <button
              type="button"
              onClick={() => navigateTo("my-rtis")}
              className="hover:text-[#C9A24B] transition-colors whitespace-nowrap"
            >
              {t.navMyRtis}
            </button>
            <button
              type="button"
              onClick={() => navigateTo("board")}
              className="hover:text-[#C9A24B] transition-colors whitespace-nowrap"
            >
              {t.navBoard}
            </button>
          </div>
        </div>

        {/* Giant "Khulasa" Wordmark Cropped at the Bottom Edge in Slightly Lighter Navy */}
        <div
          aria-hidden="true"
          className="w-full overflow-hidden flex justify-center select-none pointer-events-none pt-2"
        >
          <span className="font-editorial font-normal text-[#0F3C6E] text-[23vw] leading-[0.72] tracking-[-0.04em] translate-y-[18%] block whitespace-nowrap">
            Khulasa
          </span>
        </div>
      </footer>

      {/* Solid Gazette Mobile Bottom Navigation (375px-safe, zero glassmorphism) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-14 bg-[#00142B] border-t border-white/15 grid grid-cols-4 items-center"
      >
        {(
          [
            { id: "home", label: t.navHome },
            { id: "new", label: t.navNew },
            { id: "my-rtis", label: t.navMyRtis },
            { id: "board", label: t.navBoard },
          ] as Array<{ id: NavSection; label: string }>
        ).map((item) => {
          const active = activeNav === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigateTo(item.id)}
              className={`h-full min-h-[44px] font-mono-file text-[10px] uppercase tracking-wider flex items-center justify-center transition-colors ${
                active
                  ? "text-[#C9A24B] font-bold underline decoration-[#C9A24B] underline-offset-4"
                  : "text-[#E5EDF1]/85"
              }`}
            >
              <span className="truncate px-1">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
