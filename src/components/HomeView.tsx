import React, { useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { NavSection, RtiRecord, UiLanguage } from "../types";
import { UI_COPY } from "../i18n";
import { computeSilenceClock, DemoFastForwardDays } from "../utils/dateAndClock";

interface HomeViewProps {
  uiLang: UiLanguage;
  records: RtiRecord[];
  demoOffsetDays: DemoFastForwardDays;
  onNavigate: (section: NavSection) => void;
  onSelectScenario: (problemText: string, lang: UiLanguage, autoDraft?: boolean) => void;
  onCycleDemoMode: (offset: DemoFastForwardDays) => void;
}

const EDITORIAL_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const HERO_EXAMPLE_CHIPS = [
  {
    labelEn: "Scholarship delayed 8 months",
    labelHi: "8 महीने से छात्रवृत्ति रुकी",
    promptEn:
      "My post-matric scholarship application was verified by my college 8 months ago, but the scholarship money has not arrived in my bank account.",
    promptHi:
      "मेरी पोस्ट-मैट्रिक छात्रवृत्ति का आवेदन 8 महीने पहले कॉलेज द्वारा सत्यापित किया जा चुका है, लेकिन अभी तक बैंक खाते में राशि नहीं आई है।",
  },
  {
    labelEn: "Inflated electricity bill",
    labelHi: "अचानक तीन गुना बिजली बिल",
    promptEn:
      "My domestic electricity bill suddenly jumped to Rs. 14,800 last month despite normal consumption, and my meter test complaint filed 6 weeks ago is unanswered.",
    promptHi:
      "सामान्य खपत के बावजूद पिछले महीने मेरा घरेलू बिजली बिल अचानक 14,800 रुपये आ गया और 6 सप्ताह पहले दी गई मीटर जांच शिकायत पर कोई कार्रवाई नहीं हुई।",
  },
  {
    labelEn: "Ration card member pending",
    labelHi: "राशन कार्ड में नाम लंबित",
    promptEn:
      "I applied 5 months ago with all required documents at the District Supply Office to add my daughter's name to our ration card, but no action has been taken.",
    promptHi:
      "मैंने 5 महीने पहले सभी दस्तावेज़ों के साथ राशन कार्ड में अपनी बेटी का नाम जोड़ने के लिए ज़िला आपूर्ति कार्यालय में आवेदन किया था, लेकिन अब तक कोई कार्रवाई नहीं हुई।",
  },
  {
    labelEn: "University answer script copy",
    labelHi: "विश्वविद्यालय उत्तर-पुस्तिका की प्रति",
    promptEn:
      "My final-year university semester result showed unexpectedly low marks in Paper II and revaluation has been pending for 4 months. I want certified copies of my evaluated answer sheet.",
    promptHi:
      "मेरी अंतिम वर्ष की विश्वविद्यालय परीक्षा के पेपर-II में अप्रत्याशित रूप से कम अंक आए हैं और पुनर्मूल्यांकन 4 महीने से लंबित है। मुझे अपनी जांची गई उत्तर-पुस्तिका की प्रमाणित प्रति चाहिए।",
  },
];

const CITIZEN_SCENARIOS = [
  {
    code: "CASE 01 · SCHOLARSHIP",
    titleEn: "Scholarship unpaid 8 months after verification",
    titleHi: "सत्यापन के 8 महीने बाद भी छात्रवृत्ति का भुगतान नहीं",
    promptEn:
      "My post-matric scholarship application was verified by my college 8 months ago, but the scholarship money has not arrived in my bank account and the portal only shows 'Under Processing at District Office'.",
    promptHi:
      "मेरी पोस्ट-मैट्रिक छात्रवृत्ति का आवेदन 8 महीने पहले कॉलेज द्वारा सत्यापित किया जा चुका है, लेकिन अभी तक बैंक खाते में राशि नहीं आई है और पोर्टल पर केवल 'ज़िला कार्यालय में लंबित' दिख रहा है।",
  },
  {
    code: "CASE 02 · MUNICIPAL",
    titleEn: "Broken ward road & dark streetlights for 5 months",
    titleHi: "5 महीने से टूटी सड़क और बंद पड़ी स्ट्रीट लाइटें",
    promptEn:
      "We filed three municipal complaints over the past 5 months about broken road stretches and non-working streetlights in our ward, yet no repair work has started.",
    promptHi:
      "हमारे वार्ड में टूटी सड़क और बंद पड़ी स्ट्रीट लाइटों के बारे में पिछले 5 महीनों में नगर निगम में तीन शिकायतें दर्ज कराई गईं, फिर भी आज तक मरम्मत कार्य शुरू नहीं हुआ है।",
  },
  {
    code: "CASE 03 · RATION PDS",
    titleEn: "Member addition stuck at District Supply Office",
    titleHi: "राशन कार्ड में नाम जोड़ने का आवेदन 5 महीने से लंबित",
    promptEn:
      "I applied 5 months ago with all required documents at the District Supply Office to add my daughter's name to our ration card, but no action has been taken.",
    promptHi:
      "मैंने 5 महीने पहले सभी दस्तावेज़ों के साथ राशन कार्ड में अपनी बेटी का नाम जोड़ने के लिए ज़िला आपूर्ति कार्यालय में आवेदन किया था, लेकिन अब तक कोई कार्रवाई नहीं हुई।",
  },
  {
    code: "CASE 04 · UNIVERSITY",
    titleEn: "Demand certified copy of evaluated exam script",
    titleHi: "जांची गई विश्वविद्यालय उत्तर-पुस्तिका की प्रमाणित प्रति",
    promptEn:
      "My final-year university semester result showed unexpectedly low marks in Paper II and revaluation has been pending for 4 months. I want certified copies of my evaluated answer sheet and moderation sheet.",
    promptHi:
      "मेरी अंतिम वर्ष की विश्वविद्यालय परीक्षा के पेपर-II में अप्रत्याशित रूप से कम अंक आए हैं और पुनर्मूल्यांकन 4 महीने से लंबित है। मुझे अपनी जांची गई उत्तर-पुस्तिका की प्रमाणित प्रति चाहिए।",
  },
];

function buildWavySealPath(cx: number, cy: number, baseR: number, amp: number, lobes: number): string {
  const steps = 260;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    const r = baseR + amp * Math.sin(lobes * theta);
    const x = cx + r * Math.cos(theta);
    const y = cy + r * Math.sin(theta);
    d += i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return `${d} Z`;
}

const HOME_SEAL_PATH = buildWavySealPath(160, 160, 148, 5, 36);

export const HomeView: React.FC<HomeViewProps> = ({
  uiLang,
  records,
  demoOffsetDays,
  onNavigate,
  onSelectScenario,
  onCycleDemoMode,
}) => {
  const t = UI_COPY[uiLang];
  const reduceMotion = useReducedMotion();

  // Hero intake state (real intake input starting the existing intake flow)
  const [heroProblem, setHeroProblem] = useState("");
  const [heroError, setHeroError] = useState<string | null>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);

  // Gold bar replay controller: plays on mount (key 0) over 900ms and replays on hover/tap
  const [redactionCycle, setRedactionCycle] = useState(0);
  const cooldownRef = useRef(false);

  const triggerRedactionReplay = () => {
    if (reduceMotion || cooldownRef.current) return;
    cooldownRef.current = true;
    setRedactionCycle((c) => c + 1);
    setTimeout(() => {
      cooldownRef.current = false;
    }, 1150);
  };

  const handleHeroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = heroProblem.trim();
    if (trimmed.length < 5) {
      setHeroError(
        uiLang === "hi"
          ? "कृपया ऊपर अपनी समस्या लिखें या नीचे दिए गए किसी उदाहरण पर क्लिक करें।"
          : "Please describe your problem above or pick one of the examples below."
      );
      heroInputRef.current?.focus();
      return;
    }
    setHeroError(null);
    onSelectScenario(trimmed, uiLang, true);
  };

  const primaryRecord = records.find((r) => r.filingStatus !== "draft") || records[0];
  const previewClock = primaryRecord
    ? computeSilenceClock(
        primaryRecord.filingDate,
        demoOffsetDays,
        primaryRecord.firstAppealFiledDate
      )
    : null;

  const isPreviewOverdue = Boolean(previewClock?.isFirstAppealUnlocked);
  const progressRadius = 88;
  const progressCircumference = 2 * Math.PI * progressRadius;
  const progressOffset = progressCircumference * (1 - (previewClock?.progressRatio ?? 0.3));

  const revealSectionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 36 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.2 },
        transition: { duration: 0.75, ease: EDITORIAL_EASE },
      };

  const redactionDelay = redactionCycle === 0 ? 0.45 : 0.08;

  return (
    <div className="w-full">
      {/* 1. FULL-SCREEN HERO — NAVY (#002349) BACKGROUND */}
      <section className="w-full bg-[#002349] text-white">
        <div className="relative min-h-[calc(100vh-80px)] flex flex-col justify-between px-4 sm:px-10 lg:px-16 pt-7 sm:pt-10 pb-12 max-w-[1440px] mx-auto">
          {/* Top Metadata & Rotated Gold-Outlined "DECLASSIFIED" Stamp in Top-Right Corner */}
          <div className="flex items-start justify-between gap-3">
            <div className="font-mono-file text-[11px] sm:text-xs tracking-[0.12em] uppercase text-[#E5EDF1]/75">
              <span>ACT NO. 22 OF 2005</span>
              <span className="hidden sm:inline mx-2">·</span>
              <span className="block sm:inline">CITIZEN GAZETTE DOSSIER</span>
            </div>

            <motion.div
              initial={reduceMotion ? false : { scale: 1.4, opacity: 0, rotate: -14 }}
              animate={{ scale: 1, opacity: 1, rotate: -8 }}
              transition={{ type: "spring", stiffness: 420, damping: 18, delay: 0.2 }}
              className="rubber-stamp text-[#C9A24B] text-[11px] sm:text-sm shrink-0"
            >
              DECLASSIFIED
            </motion.div>
          </div>

          {/* Center Monumental White Headline + Real Search-Style Intake Bar + 4 Outlined Example Chips */}
          <div className="my-auto py-8 sm:py-14 max-w-5xl space-y-8 sm:space-y-10">
            <h1 className="font-editorial font-normal text-white hero-display-size">
              {uiLang === "hi" ? (
                <>
                  आपका{" "}
                  <span
                    onMouseEnter={triggerRedactionReplay}
                    onClick={triggerRedactionReplay}
                    title="Hover to replay declassification"
                    className="relative inline-block px-1.5 mx-0.5 align-baseline cursor-pointer select-none"
                  >
                    <span className="relative z-10 text-[#C9A24B]">जानने</span>
                    {/* Solid Gold Bar Sliding Right over 900ms */}
                    {!reduceMotion && (
                      <motion.span
                        key={`hi-gold-${redactionCycle}`}
                        aria-hidden="true"
                        initial={{ scaleX: 1 }}
                        animate={{ scaleX: 0 }}
                        transition={{
                          duration: 0.9,
                          delay: redactionDelay,
                          ease: EDITORIAL_EASE,
                        }}
                        style={{ transformOrigin: "right center" }}
                        className="absolute inset-x-[-4px] inset-y-[6%] bg-[#C9A24B] z-20 pointer-events-none"
                      />
                    )}
                  </span>{" "}
                  का अधिकार बस एक अर्ज़ी दूर है।
                </>
              ) : (
                <>
                  Your right to{" "}
                  <span
                    onMouseEnter={triggerRedactionReplay}
                    onClick={triggerRedactionReplay}
                    title="Hover to replay reveal"
                    className="relative inline-block px-2 sm:px-3 mx-0.5 align-baseline cursor-pointer select-none"
                  >
                    <span className="relative z-10 italic font-medium text-[#C9A24B]">know</span>
                    {/* Solid Gold (#C9A24B) Bar Covering "know", Sliding Right Over 900ms */}
                    {!reduceMotion && (
                      <motion.span
                        key={`en-gold-${redactionCycle}`}
                        aria-hidden="true"
                        initial={{ scaleX: 1 }}
                        animate={{ scaleX: 0 }}
                        transition={{
                          duration: 0.9,
                          delay: redactionDelay,
                          ease: EDITORIAL_EASE,
                        }}
                        style={{ transformOrigin: "right center" }}
                        className="absolute inset-x-[-4px] inset-y-[8%] bg-[#C9A24B] z-20 pointer-events-none"
                      />
                    )}
                  </span>{" "}
                  is one form away.
                </>
              )}
            </h1>

            <p className="font-body text-base sm:text-lg text-[#E5EDF1]/90 max-w-2xl leading-relaxed">
              {t.heroSubtext}
            </p>

            {/* Real Search-Style Intake Input Bar (White, Rounded, Soft Shadow) + Gold Pill CTA */}
            <div className="space-y-4 max-w-4xl">
              <form
                onSubmit={handleHeroSubmit}
                className="w-full bg-white rounded-2xl sm:rounded-full p-2 sm:p-2 sm:pl-6 shadow-[0_18px_42px_rgba(0,10,25,0.34)] flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3"
              >
                <label htmlFor="hero-rti-intake" className="sr-only">
                  {t.heroInputPlaceholder}
                </label>
                <input
                  id="hero-rti-intake"
                  ref={heroInputRef}
                  type="text"
                  value={heroProblem}
                  onChange={(e) => {
                    setHeroProblem(e.target.value);
                    if (heroError) setHeroError(null);
                  }}
                  placeholder={t.heroInputPlaceholder}
                  className="flex-1 min-w-0 bg-transparent px-3 sm:px-0 py-2.5 sm:py-2 font-body text-sm sm:text-base text-[#0B1B33] placeholder:text-[#7A8794] focus:outline-none"
                />
                <button
                  type="submit"
                  className="min-h-[48px] sm:min-h-[52px] px-6 sm:px-7 py-3 rounded-full bg-[#C9A24B] hover:bg-[#d8b35e] text-[#002349] font-body text-sm sm:text-base font-semibold inline-flex items-center justify-center transition-colors duration-200 whitespace-nowrap shrink-0"
                >
                  {t.heroDraftBtn}
                </button>
              </form>

              {heroError && (
                <p className="font-mono-file text-xs text-[#C9A24B] pl-2">{heroError}</p>
              )}

              {/* 4 Example Chips as Outlined Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {HERO_EXAMPLE_CHIPS.map((chip, idx) => {
                  const chipLabel = uiLang === "hi" ? chip.labelHi : chip.labelEn;
                  const chipPrompt = uiLang === "hi" ? chip.promptHi : chip.promptEn;
                  const isSelected = heroProblem === chipPrompt;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setHeroProblem(chipPrompt);
                        setHeroError(null);
                        heroInputRef.current?.focus();
                      }}
                      className={`min-h-[36px] px-3.5 sm:px-4 py-1.5 rounded-full border font-body text-xs sm:text-sm transition-colors duration-200 ${
                        isSelected
                          ? "border-[#C9A24B] bg-[#C9A24B]/15 text-[#C9A24B]"
                          : "border-white/30 hover:border-[#C9A24B] text-[#E5EDF1] hover:text-[#C9A24B]"
                      }`}
                    >
                      {chipLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Hero Index Strip */}
          <div className="pt-6 border-t border-white/15 flex flex-wrap items-center justify-between gap-4 font-mono-file text-[11px] sm:text-xs text-[#E5EDF1]/75">
            <span>SEC 6(1) · SEC 7(1) · SEC 19(1) & 19(3)</span>
            <button
              type="button"
              onClick={() => onNavigate("my-rtis")}
              className="text-[#C9A24B] hover:text-white font-semibold underline underline-offset-4 transition-colors"
            >
              {uiLang === "hi"
                ? `सक्रिय केस फ़ाइलें खोलें (${records.length})`
                : `OPEN ACTIVE CASE FILES (${records.length}) →`}
            </button>
          </div>
        </div>
      </section>

      {/* 2. SECTION 01 — WHITE BACKGROUND, DEEP GOLD NUMBER, NAVY HEADLINE */}
      <section className="w-full bg-white border-t border-[#002349]/10 py-20 sm:py-32">
        <motion.div
          {...revealSectionProps}
          className="max-w-[1440px] mx-auto px-4 sm:px-10 lg:px-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start"
        >
          <div className="lg:col-span-3">
            <span className="font-mono-file font-bold text-[#957C3D] story-numeral block">
              01
            </span>
            <span className="font-mono-file text-xs tracking-[0.14em] uppercase text-[#002349]/75 font-semibold mt-3 block">
              CITIZEN STATEMENT
            </span>
          </div>

          <div className="lg:col-span-9 space-y-10">
            <div className="space-y-5 max-w-3xl">
              <h2 className="font-editorial text-[#002349] section-display-size">
                {t.story01Title}
              </h2>
              <p className="font-body text-lg sm:text-xl text-[#0B1B33]/85 leading-relaxed max-w-2xl">
                {uiLang === "hi" ? (
                  <>
                    अपनी परेशानी सरल हिन्दी या अंग्रेज़ी में लिखें—{" "}
                    <span className="bg-[#C9A24B]/22 px-1.5 font-medium text-[#0B1B33]">
                      बिल्कुल आम बोलचाल की भाषा में
                    </span>
                    । किसी कानूनी धारा को जानने की आवश्यकता नहीं।
                  </>
                ) : (
                  <>
                    Write what happened in plain English or Hindi—just as you would tell a
                    neighbour.{" "}
                    <span className="bg-[#C9A24B]/22 px-1.5 font-medium text-[#0B1B33]">
                      No legal sections, no bureaucratic jargon
                    </span>{" "}
                    required.
                  </>
                )}
              </p>
            </div>

            {/* Interactive Citizen Case Files */}
            <div className="pt-4 space-y-4">
              <div className="font-mono-file text-xs tracking-[0.14em] uppercase text-[#002349]/75 font-semibold">
                {t.quickPromptsTitle}
              </div>
              <div className="divide-y divide-[#002349]/12 border-y border-[#002349]/15">
                {CITIZEN_SCENARIOS.map((item) => {
                  const title = uiLang === "hi" ? item.titleHi : item.titleEn;
                  const promptToUse = uiLang === "hi" ? item.promptHi : item.promptEn;
                  return (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => onSelectScenario(promptToUse, uiLang, false)}
                      className="w-full py-5 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:pl-3 transition-all duration-300"
                    >
                      <div className="space-y-1">
                        <span className="font-mono-file text-sm text-[#957C3D] font-bold block">
                          {item.code}
                        </span>
                        <span className="font-editorial text-xl sm:text-2xl text-[#002349] group-hover:underline decoration-[#C9A24B] decoration-2 underline-offset-4">
                          {title}
                        </span>
                      </div>
                      <span className="font-mono-file text-xs uppercase tracking-widest text-[#002349] font-semibold inline-flex items-center gap-1.5 shrink-0">
                        <span>{uiLang === "hi" ? "फ़ाइल खोलें" : "OPEN FILE"}</span>
                        <ArrowUpRight className="w-4 h-4 text-[#957C3D]" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* 3. SECTION 02 — MIST (#E5EDF1) BACKGROUND, DEEP GOLD NUMBER, NAVY HEADLINE */}
      <section className="w-full bg-[#E5EDF1] border-t border-[#002349]/12 py-20 sm:py-32">
        <motion.div
          {...revealSectionProps}
          className="max-w-[1440px] mx-auto px-4 sm:px-10 lg:px-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start"
        >
          <div className="lg:col-span-3">
            <span className="font-mono-file font-bold text-[#957C3D] story-numeral block">
              02
            </span>
            <span className="font-mono-file text-xs tracking-[0.14em] uppercase text-[#002349] font-semibold mt-3 block">
              SECTION 2(f) PRECISION
            </span>
          </div>

          <div className="lg:col-span-9 space-y-12">
            <div className="space-y-5 max-w-3xl">
              <h2 className="font-editorial text-[#002349] section-display-size">
                {uiLang === "hi" ? (
                  <>
                    हम <span className="text-[#957C3D] font-semibold">सटीक सवाल</span> लिखते हैं।
                  </>
                ) : (
                  <>
                    We write the <span className="text-[#957C3D] italic font-medium">questions.</span>
                  </>
                )}
              </h2>
              <p className="font-body text-lg sm:text-xl text-[#0B1B33]/85 leading-relaxed max-w-2xl">
                {t.story02Body}
              </p>
            </div>

            {/* Rejected (Red Strike-Through) vs Precise Demand (Light Gold Wash) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10 pt-8 border-t border-[#002349]/15">
              <div className="bg-white border border-[#002349]/12 p-6 sm:p-7 space-y-3">
                <span className="font-mono-file text-xs uppercase tracking-widest text-[#C8341F] font-bold block">
                  × REJECTED BY OFFICERS AS "OPINION"
                </span>
                <p className="font-editorial italic text-xl sm:text-2xl text-[#C8341F] line-through decoration-[#C8341F] decoration-2 leading-snug">
                  "Why has my scholarship money not arrived for the last 8 months?"
                </p>
              </div>

              <div className="bg-white border border-[#002349]/15 p-6 sm:p-7 space-y-3">
                <span className="font-mono-file text-xs uppercase tracking-widest text-[#2E7D4F] font-bold block">
                  ✓ KHULASA SECTION 6(1) RECORD DEMAND
                </span>
                <p className="font-body text-base sm:text-lg text-[#0B1B33] leading-relaxed">
                  "Provide{" "}
                  <span className="bg-[#C9A24B]/25 px-1.5 py-0.5 font-semibold text-[#0B1B33]">
                    certified copies of daily progress reports and file notings
                  </span>{" "}
                  recorded on my application from verification date to date of reply, with the{" "}
                  <span className="bg-[#C9A24B]/25 px-1.5 py-0.5 font-semibold text-[#0B1B33]">
                    official designation of the officer
                  </span>{" "}
                  holding the file."
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* 4. SECTION 03 — WHITE BACKGROUND, DEEP GOLD NUMBER, NAVY HEADLINE */}
      <section className="w-full bg-white border-t border-[#002349]/12 py-20 sm:py-32">
        <motion.div
          {...revealSectionProps}
          className="max-w-[1440px] mx-auto px-4 sm:px-10 lg:px-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start"
        >
          <div className="lg:col-span-3">
            <span className="font-mono-file font-bold text-[#957C3D] story-numeral block">
              03
            </span>
            <span className="font-mono-file text-xs tracking-[0.14em] uppercase text-[#002349]/75 font-semibold mt-3 block">
              42 PUBLIC OFFICES · A4 PDF
            </span>
          </div>

          <div className="lg:col-span-9 space-y-10">
            <div className="space-y-5 max-w-3xl">
              <h2 className="font-editorial text-[#002349] section-display-size">
                {t.story03Title}
              </h2>
              <p className="font-body text-lg sm:text-xl text-[#0B1B33]/85 leading-relaxed max-w-2xl">
                {uiLang === "hi" ? (
                  <>
                    <strong className="text-[#002349] font-semibold">
                      42 प्रमुख सरकारी विभागों
                    </strong>{" "}
                    में से सही जन सूचना अधिकारी चुनें, विवरण संपादित करें और{" "}
                    <span className="bg-[#C9A24B]/22 px-1.5 font-medium text-[#0B1B33]">
                      तैयार A4 PDF
                    </span>{" "}
                    डाउनलोड करें।
                  </>
                ) : (
                  <>
                    We match your issue across{" "}
                    <strong className="text-[#002349] font-semibold">
                      42 generic public departments
                    </strong>
                    , let you edit every line, and typeset a{" "}
                    <span className="bg-[#C9A24B]/22 px-1.5 font-medium text-[#0B1B33]">
                      ready-to-file A4 Section 6(1) PDF
                    </span>{" "}
                    in seconds.
                  </>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => onNavigate("new")}
                className="min-h-[52px] px-8 py-3.5 rounded-full bg-[#002349] hover:bg-[#00142B] text-white font-body text-sm sm:text-base font-medium inline-flex items-center gap-2.5 transition-colors duration-200 whitespace-nowrap"
              >
                <span>{t.ctaFileRti}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <span className="font-mono-file text-xs text-[#7A8794]">
                SCHOLARSHIP · RATION · MUNICIPAL · ELECTRICITY · POLICE · UNIVERSITY
              </span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* 5. SECTION 04 — DEEP NAVY (#00142B) SILENCE CLOCK WITH GOLD WAVY BORDER & IVORY NUMERALS */}
      <section className="relative w-full bg-[#00142B] text-white py-24 sm:py-36 overflow-hidden">
        <motion.div
          {...revealSectionProps}
          className="relative z-10 max-w-[1440px] mx-auto px-4 sm:px-10 lg:px-16 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center"
        >
          <div className="lg:col-span-3 self-start">
            <span className="font-mono-file font-bold text-[#C9A24B] story-numeral block">
              04
            </span>
            <span className="font-mono-file text-xs tracking-[0.14em] uppercase text-[#E5EDF1]/75 mt-3 block">
              30-DAY STATUTORY CLOCK
            </span>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <h2 className="font-editorial text-white section-display-size">
              {uiLang === "hi" ? (
                <>
                  हम <span className="text-[#C9A24B]">चुप्पी</span> पर नज़र रखते हैं।
                </>
              ) : (
                <>
                  We watch the <span className="text-[#C9A24B] italic">silence.</span>
                </>
              )}
            </h2>

            <p className="font-body text-base sm:text-lg text-[#E5EDF1]/90 leading-relaxed">
              {uiLang === "hi" ? (
                <>
                  दाखिल करने की तारीख दर्ज करें और{" "}
                  <span className="text-[#C9A24B] font-semibold">30-दिन की डाक मुहर घड़ी</span> शुरू
                  करें। 30 दिन बीतने पर खुलासा{" "}
                  <span className="text-[#C8341F] font-semibold">OVERDUE</span> मुहर लगाता है और
                  धारा 19(1) प्रथम अपील व धारा 19(3) द्वितीय अपील स्वतः तैयार करता है।
                </>
              ) : (
                <>
                  Log your filing date to start the{" "}
                  <span className="text-[#C9A24B] font-semibold">
                    30-day statutory postal clock
                  </span>
                  . If the department stays silent past Day 30, Khulasa slams{" "}
                  <span className="text-[#C8341F] font-semibold">OVERDUE</span> and drafts your
                  Section 19(1) First Appeal and Section 19(3) Second Appeal automatically.
                </>
              )}
            </p>

            {/* On Dark Background: Gold Pill Primary Button + Outlined Gold Demo Trigger */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onNavigate("my-rtis")}
                className="min-h-[50px] px-7 py-3 rounded-full bg-[#C9A24B] hover:bg-[#d8b35e] text-[#002349] font-body text-sm font-semibold inline-flex items-center gap-2 transition-colors duration-200 whitespace-nowrap"
              >
                <span>{t.heroSecondaryBtn}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onCycleDemoMode(31)}
                className="min-h-[50px] px-6 py-3 rounded-full border border-[#C9A24B] text-[#C9A24B] hover:bg-[#C9A24B] hover:text-[#002349] font-mono-file text-xs uppercase tracking-wider font-semibold transition-colors duration-200 whitespace-nowrap"
              >
                {t.timeTravelTitle} (+30D)
              </button>
            </div>
          </div>

          {/* Large Postal Franking Seal: Gold Wavy Border, Ivory Numerals, Red OVERDUE Slam + Shake */}
          <div className="lg:col-span-4 flex justify-center pt-4 lg:pt-0">
            <motion.button
              type="button"
              onClick={() => onNavigate("my-rtis")}
              key={isPreviewOverdue ? `home-overdue-${demoOffsetDays}` : "home-calm"}
              animate={
                !reduceMotion && isPreviewOverdue
                  ? { x: [0, -7, 7, -5, 5, -2, 0], rotate: [0, -1.5, 1.5, 0] }
                  : { x: 0, rotate: 0 }
              }
              transition={{ duration: 0.42 }}
              className="group relative w-[264px] h-[264px] sm:w-[304px] sm:h-[304px] flex items-center justify-center"
              aria-label="Open Silence Clock"
            >
              <svg
                viewBox="0 0 320 320"
                className="w-full h-full transition-transform duration-700 group-hover:rotate-6 text-[#C9A24B]"
              >
                <defs>
                  <path
                    id="homeSealTopArc"
                    d="M 42,160 A 118,118 0 1,1 278,160"
                  />
                  <path
                    id="homeSealBottomArc"
                    d="M 36,160 A 124,124 0 0,0 284,160"
                  />
                </defs>

                {/* Gold Wavy Cancellation Ring (r ~ 148) */}
                <path
                  d={HOME_SEAL_PATH}
                  fill="#001D3D"
                  stroke="#C9A24B"
                  strokeWidth="2.5"
                />

                {/* Outer Gold Hairline Boundary (r = 136) */}
                <circle
                  cx="160"
                  cy="160"
                  r="136"
                  fill="none"
                  stroke="#C9A24B"
                  strokeWidth="1"
                  opacity="0.55"
                />

                {/* Curved Text on Dedicated Outer Ring (r = 118..124) */}
                <text
                  fill="#C9A24B"
                  fontSize="11.5"
                  fontWeight="600"
                  letterSpacing="3.4"
                  className="font-mono-file uppercase"
                >
                  <textPath href="#homeSealTopArc" startOffset="50%" textAnchor="middle">
                    INDIA RTI · SEC 7(1)
                  </textPath>
                </text>

                <text
                  fill="#E5EDF1"
                  fontSize="10"
                  fontWeight="500"
                  letterSpacing="2.8"
                  opacity="0.78"
                  className="font-mono-file uppercase"
                >
                  <textPath href="#homeSealBottomArc" startOffset="50%" textAnchor="middle">
                    30-DAY SILENCE CLOCK
                  </textPath>
                </text>

                {/* Separator Ring (r = 104) */}
                <circle
                  cx="160"
                  cy="160"
                  r="104"
                  fill="none"
                  stroke="#C9A24B"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                  opacity="0.65"
                />

                {/* Progress Arc Track & Sweep (r = 88) */}
                <circle
                  cx="160"
                  cy="160"
                  r={progressRadius}
                  fill="none"
                  stroke="#0A2E57"
                  strokeWidth="6"
                />
                <circle
                  cx="160"
                  cy="160"
                  r={progressRadius}
                  fill="none"
                  stroke={isPreviewOverdue ? "#C8341F" : "#C9A24B"}
                  strokeWidth="6"
                  strokeDasharray={progressCircumference}
                  strokeDashoffset={progressOffset}
                  transform="rotate(-90 160 160)"
                />
              </svg>

              {/* Center Ivory Numerals Inside r < 76 */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-10 pointer-events-none">
                <span className="font-mono-file text-5xl sm:text-6xl font-bold leading-none text-[#F7F5EE]">
                  {previewClock
                    ? isPreviewOverdue
                      ? "00"
                      : String(previewClock.daysRemaining).padStart(2, "0")
                    : "30"}
                </span>
                <span className="font-mono-file text-[11px] uppercase tracking-[0.16em] text-[#E5EDF1]/85 mt-2">
                  {isPreviewOverdue ? `+${previewClock?.overdueDays ?? 1}D OVERDUE` : "DAYS LEFT"}
                </span>
              </div>

              {/* Rotated Red OVERDUE Stamp Slamming Over Seal When Overdue */}
              {isPreviewOverdue && (
                <motion.div
                  initial={reduceMotion ? false : { scale: 1.4, opacity: 0, rotate: -14 }}
                  animate={{ scale: 1, opacity: 1, rotate: -10 }}
                  transition={{ type: "spring", stiffness: 460, damping: 18 }}
                  className="absolute bottom-5 rubber-stamp text-[#C8341F] bg-[#00142B]/95 text-xs sm:text-sm pointer-events-none"
                >
                  OVERDUE
                </motion.div>
              )}
            </motion.button>
          </div>
        </motion.div>
      </section>
    </div>
  );
};
