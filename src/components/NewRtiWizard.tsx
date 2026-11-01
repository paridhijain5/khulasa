import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import type {
  ApplicantDetails,
  OfficeCategory,
  PublicOffice,
  RtiRecord,
  UiLanguage,
} from "../types";
import { CATEGORY_LABELS, PUBLIC_OFFICES } from "../data/offices";
import { UI_COPY } from "../i18n";
import { formatReadableDate, getTodayIsoDate } from "../utils/dateAndClock";
import { downloadRtiApplicationPdf } from "../utils/pdfGenerator";

interface NewRtiWizardProps {
  uiLang: UiLanguage;
  existingCount: number;
  prefilledProblem: string;
  autoSubmitIntakeId?: number;
  savedApplicant: ApplicantDetails;
  onUpdateApplicantProfile: (profile: ApplicantDetails) => void;
  onSaveRtiRecord: (record: RtiRecord, navigateToClocks: boolean) => void;
}

const EDITORIAL_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const SAMPLE_QUICK_PROBLEMS: Array<{
  labelEn: string;
  labelHi: string;
  textEn: string;
  textHi: string;
}> = [
  {
    labelEn: "Scholarship delayed 8 months",
    labelHi: "8 महीने से छात्रवृत्ति रुकी",
    textEn:
      "My post-matric scholarship has not arrived for 8 months even though my college verified the form and my bank account is seeded with Aadhaar.",
    textHi:
      "मेरी पोस्ट-मैट्रिक छात्रवृत्ति 8 महीने से नहीं आई है जबकि कॉलेज से फॉर्म सत्यापित हो चुका है और बैंक खाता आधार से जुड़ा है।",
  },
  {
    labelEn: "Inflated electricity bill",
    labelHi: "अचानक तीन गुना बिजली बिल",
    textEn:
      "My domestic electricity bill suddenly jumped to Rs. 14,800 last month despite normal consumption, and my meter test complaint filed 6 weeks ago is unanswered.",
    textHi:
      "सामान्य खपत के बावजूद पिछले महीने मेरा घरेलू बिजली बिल अचानक 14,800 रुपये आ गया और 6 सप्ताह पहले दी गई मीटर जांच शिकायत पर कोई कार्रवाई नहीं हुई।",
  },
  {
    labelEn: "Ration card member pending",
    labelHi: "राशन कार्ड में नाम लंबित",
    textEn:
      "Our application to add two family members to our ration card has been pending at the District Supply Office for 5 months without any written reason.",
    textHi:
      "राशन कार्ड में परिवार के दो सदस्यों का नाम जोड़ने का आवेदन ज़िला आपूर्ति कार्यालय में 5 महीने से बिना किसी लिखित कारण के लंबित है।",
  },
  {
    labelEn: "Police complaint status",
    labelHi: "पुलिस शिकायत पर कार्रवाई",
    textEn:
      "I submitted a written complaint with receiving stamp at the police station 3 months ago regarding theft of my two-wheeler, and I want to know the action taken.",
    textHi:
      "मैंने अपने दुपहिया वाहन की चोरी के संबंध में 3 महीने पहले थाने में पावती मुहर के साथ लिखित शिकायत दी थी; उस पर की गई कार्रवाई की जानकारी चाहिए।",
  },
];

function matchOfficeLocally(problem: string): PublicOffice {
  const lower = problem.toLowerCase();
  let bestOffice = PUBLIC_OFFICES[0];
  let bestScore = -1;

  for (const office of PUBLIC_OFFICES) {
    let score = 0;
    for (const kw of office.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        score += 3;
      }
    }
    if (lower.includes(office.category)) {
      score += 2;
    }
    if (score > bestScore) {
      bestScore = score;
      bestOffice = office;
    }
  }
  return bestOffice;
}

export const NewRtiWizard: React.FC<NewRtiWizardProps> = ({
  uiLang,
  existingCount,
  prefilledProblem,
  autoSubmitIntakeId = 0,
  savedApplicant,
  onUpdateApplicantProfile,
  onSaveRtiRecord,
}) => {
  const t = UI_COPY[uiLang];
  const reduceMotion = useReducedMotion();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const fileNumber = `KH-2026-${String(41 + existingCount).padStart(4, "0")}`;

  const [problemText, setProblemText] = useState(prefilledProblem || "");
  const [draftLang, setDraftLang] = useState<UiLanguage>(uiLang);
  const [isGenerating, setIsGenerating] = useState(false);
  const [intakeError, setIntakeError] = useState<string | null>(null);
  const handledAutoSubmitRef = useRef<number>(0);

  // Drafted RTI fields
  const [summary, setSummary] = useState("");
  const [subject, setSubject] = useState("");
  const [periodOfInformation, setPeriodOfInformation] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [helpfulTip, setHelpfulTip] = useState("");

  // Office Finder & Editable Office state
  const [officeSearch, setOfficeSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<OfficeCategory | "all">("all");
  const [showOfficeBrowser, setShowOfficeBrowser] = useState(false);

  const initialOffice = PUBLIC_OFFICES[0];
  const [selectedOfficeId, setSelectedOfficeId] = useState(initialOffice.id);
  const [selectedCategory, setSelectedCategory] = useState<OfficeCategory>(initialOffice.category);
  const [department, setDepartment] = useState(initialOffice.department);
  const [pioDesignation, setPioDesignation] = useState(initialOffice.pioDesignation);
  const [faaDesignation, setFaaDesignation] = useState(initialOffice.faaDesignation);
  const [commissionName, setCommissionName] = useState(initialOffice.commissionName);
  const [jurisdiction, setJurisdiction] = useState<string>(initialOffice.jurisdiction);
  const [locationNote, setLocationNote] = useState(initialOffice.locationPlaceholder);

  // Applicant & Filing Details
  const [applicant, setApplicant] = useState<ApplicantDetails>(savedApplicant);
  const [filingDate, setFilingDate] = useState<string>(getTodayIsoDate());
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  const applyOfficeTemplate = (office: PublicOffice) => {
    setSelectedOfficeId(office.id);
    setSelectedCategory(office.category);
    setDepartment(office.department);
    setPioDesignation(office.pioDesignation);
    setFaaDesignation(office.faaDesignation);
    setCommissionName(office.commissionName);
    setJurisdiction(office.jurisdiction);
    setLocationNote(office.locationPlaceholder);
    setShowOfficeBrowser(false);
  };

  const runIntakeGeneration = async (rawProblem: string, targetLang: UiLanguage) => {
    if (rawProblem.trim().length < 5) {
      setIntakeError(
        uiLang === "hi"
          ? "कृपया अपनी समस्या कम से कम कुछ शब्दों में लिखें।"
          : "Write at least a few words describing what happened."
      );
      return;
    }

    setIsGenerating(true);
    setIntakeError(null);

    try {
      const compactCatalog = PUBLIC_OFFICES.map((o) => ({
        id: o.id,
        category: o.category,
        department: o.department,
      }));

      const res = await fetch("/api/rti/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem: rawProblem,
          outputLanguage: targetLang,
          officesCatalog: compactCatalog,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate RTI questions.");
      }

      setSummary(data.summary || "");
      setSubject(
        data.subject || "Application seeking information under Section 6(1) of the RTI Act, 2005"
      );
      setPeriodOfInformation(data.periodOfInformation || "Up to the date of furnishing reply");
      setQuestions(
        Array.isArray(data.questions) && data.questions.length > 0
          ? data.questions
          : [
              "Please provide the daily progress report and certified file notings on my pending application.",
            ]
      );
      setHelpfulTip(data.helpfulTip || "");

      const matchedFromCatalog =
        PUBLIC_OFFICES.find((o) => o.id === data.matchedOfficeId) ||
        matchOfficeLocally(rawProblem);
      applyOfficeTemplate(matchedFromCatalog);
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: unknown) {
      setIntakeError(
        err instanceof Error ? err.message : "Could not connect to Gemini drafting service."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (prefilledProblem && prefilledProblem !== problemText) {
      setProblemText(prefilledProblem);
      setIntakeError(null);
      setStep(1);
    }
  }, [prefilledProblem]);

  useEffect(() => {
    setDraftLang(uiLang);
  }, [uiLang]);

  // Immediately run real Gemini intake when user submits the Hero search bar ("Draft my RTI →")
  useEffect(() => {
    if (
      autoSubmitIntakeId > 0 &&
      handledAutoSubmitRef.current !== autoSubmitIntakeId &&
      prefilledProblem.trim().length >= 5
    ) {
      handledAutoSubmitRef.current = autoSubmitIntakeId;
      setProblemText(prefilledProblem);
      setStep(1);
      void runIntakeGeneration(prefilledProblem, uiLang);
    }
  }, [autoSubmitIntakeId, prefilledProblem, uiLang]);

  const filteredOffices = useMemo(() => {
    const q = officeSearch.trim().toLowerCase();
    return PUBLIC_OFFICES.filter((o) => {
      const catOk = categoryFilter === "all" || o.category === categoryFilter;
      if (!catOk) return false;
      if (!q) return true;
      return (
        o.department.toLowerCase().includes(q) ||
        o.pioDesignation.toLowerCase().includes(q) ||
        o.category.toLowerCase().includes(q) ||
        o.keywords.some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [officeSearch, categoryFilter]);

  const handleGenerateIntake = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await runIntakeGeneration(problemText, draftLang);
  };

  const updateApplicantField = <K extends keyof ApplicantDetails>(
    field: K,
    value: ApplicantDetails[K]
  ) => {
    const next = { ...applicant, [field]: value };
    setApplicant(next);
    onUpdateApplicantProfile(next);
  };

  const buildCurrentRecord = (status: "draft" | "filed"): RtiRecord => {
    return {
      id: `rti-${Date.now()}`,
      createdAt: new Date().toISOString(),
      problemRaw: problemText,
      outputLanguage: draftLang,
      summary: summary || problemText,
      subject: subject || "Application under Section 6(1), Right to Information Act, 2005",
      periodOfInformation: periodOfInformation || "Up to the date of reply",
      questions:
        questions.filter((q) => q.trim().length > 0).length > 0
          ? questions.filter((q) => q.trim().length > 0)
          : [
              "Please furnish certified copies of action taken and file notings regarding my matter.",
            ],
      helpfulTip,
      office: {
        officeId: selectedOfficeId,
        category: selectedCategory,
        department,
        pioDesignation,
        faaDesignation,
        commissionName,
        jurisdiction,
        locationNote,
      },
      applicant,
      filingStatus: status,
      filingDate: filingDate || getTodayIsoDate(),
      referenceNumber: referenceNumber.trim(),
    };
  };

  const handleDownloadPdf = () => {
    const rec = buildCurrentRecord("draft");
    downloadRtiApplicationPdf(rec);
  };

  const handleSave = (markAsFiled: boolean) => {
    const rec = buildCurrentRecord(markAsFiled ? "filed" : "draft");
    onSaveRtiRecord(rec, markAsFiled);
    if (!markAsFiled) {
      setSavedBanner(
        uiLang === "hi"
          ? "आरटीआई ड्राफ्ट केस फ़ाइलों में सुरक्षित कर दिया गया।"
          : "Draft saved to Active Case Files."
      );
      setTimeout(() => setSavedBanner(null), 4000);
    }
  };

  const stepMotionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 24 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -16 },
        transition: { duration: 0.55, ease: EDITORIAL_EASE },
      };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-10 lg:px-16 py-8 sm:py-12 min-h-[calc(100vh-88px)] flex flex-col">
      {/* Top File Number & Progress Bar */}
      <div className="space-y-4 pb-6 sm:pb-8 border-b border-[#002349]/15">
        <div className="flex flex-wrap items-center justify-between gap-3 font-mono-file text-xs uppercase tracking-[0.12em]">
          <div className="flex items-center gap-2.5 text-[#002349]">
            <span className="bg-[#E5EDF1] text-[#002349] px-2.5 py-1 font-bold border border-[#002349]/20">
              {fileNumber}
            </span>
            <span className="text-[#7A8794]">STEP 0{step} / 04</span>
          </div>

          {/* Clickable Step Breadcrumbs */}
          <div className="flex items-center gap-3 sm:gap-4 text-[#7A8794]">
            {[
              { n: 1 as const, label: "01 STATEMENT" },
              { n: 2 as const, label: "02 QUESTIONS" },
              { n: 3 as const, label: "03 PIO OFFICE" },
              { n: 4 as const, label: "04 PDF DOSSIER" },
            ].map((item) => {
              const unlocked = item.n === 1 || questions.length > 0 || problemText.trim().length > 4;
              return (
                <button
                  key={item.n}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => setStep(item.n)}
                  className={`transition-colors disabled:opacity-35 ${
                    step === item.n
                      ? "text-[#002349] font-bold underline decoration-[#957C3D] decoration-2 underline-offset-4"
                      : "hover:text-[#002349]"
                  }`}
                >
                  <span className="hidden sm:inline">{item.label}</span>
                  <span className="sm:hidden">0{item.n}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Smooth Progress Line */}
        <div className="w-full h-[2px] bg-[#E5EDF1] overflow-hidden">
          <div
            className="h-full bg-[#002349] transition-all duration-700 ease-out"
            style={{ width: `${step * 25}%` }}
          />
        </div>
      </div>

      {/* Typeform One-Prompt-at-a-Time Viewport */}
      <div className="flex-1 flex flex-col justify-center py-8 sm:py-16">
        <AnimatePresence mode="wait">
          {/* STEP 1: FULL-SCREEN GRIEVANCE INPUT */}
          {step === 1 && (
            <motion.section key="step-1" {...stepMotionProps} className="max-w-4xl space-y-8 sm:space-y-10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-mono-file text-sm uppercase tracking-[0.14em] text-[#957C3D] font-bold">
                  01 · CITIZEN GRIEVANCE INTAKE
                </span>

                <div className="inline-flex items-center gap-2">
                  <span className="font-mono-file text-xs text-[#7A8794]">
                    {t.draftLangLabel}:
                  </span>
                  <button
                    type="button"
                    onClick={() => setDraftLang("en")}
                    className={`min-h-[34px] px-3.5 rounded-full font-mono-file text-xs transition-colors ${
                      draftLang === "en"
                        ? "bg-[#002349] text-white"
                        : "border border-[#002349]/25 text-[#002349]"
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftLang("hi")}
                    className={`min-h-[34px] px-3.5 rounded-full font-body text-xs transition-colors ${
                      draftLang === "hi"
                        ? "bg-[#002349] text-white"
                        : "border border-[#002349]/25 text-[#002349]"
                    }`}
                  >
                    हिन्दी
                  </button>
                </div>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <h1 className="font-editorial text-3xl sm:text-6xl lg:text-7xl text-[#002349] leading-[1.05] tracking-tight">
                  {t.intakeHeading}
                </h1>
                <p className="font-body text-base sm:text-lg text-[#0B1B33]/75">
                  {t.intakeSub}
                </p>
              </div>

              <form onSubmit={handleGenerateIntake} className="space-y-8">
                {/* Thin Navy Bottom Border — turns Red (#C8341F) ONLY on error */}
                <textarea
                  rows={3}
                  value={problemText}
                  onChange={(e) => {
                    setProblemText(e.target.value);
                    if (intakeError) setIntakeError(null);
                  }}
                  placeholder={t.intakePlaceholder}
                  autoFocus
                  aria-invalid={Boolean(intakeError)}
                  className={`w-full bg-transparent border-0 border-b ${
                    intakeError
                      ? "border-[#C8341F] focus:border-[#C8341F]"
                      : "border-[#002349]/40 focus:border-[#002349]"
                  } py-4 font-editorial text-xl sm:text-4xl text-[#0B1B33] placeholder:text-[#7A8794]/80 leading-snug resize-none focus:outline-none transition-colors`}
                />

                {intakeError && (
                  <p className="font-mono-file text-xs sm:text-sm text-[#C8341F]">
                    ERROR · {intakeError}
                  </p>
                )}

                {/* Sample Quick-Fill Outlined Pills */}
                <div className="flex flex-wrap items-center gap-2">
                  {SAMPLE_QUICK_PROBLEMS.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setProblemText(draftLang === "hi" ? item.textHi : item.textEn);
                        setIntakeError(null);
                      }}
                      className="min-h-[38px] px-4 py-1.5 rounded-full border border-[#002349]/25 hover:border-[#002349] hover:bg-[#E5EDF1] font-body text-xs sm:text-sm text-[#002349] transition-colors duration-200"
                    >
                      {uiLang === "hi" ? item.labelHi : item.labelEn}
                    </button>
                  ))}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isGenerating}
                    className="w-full sm:w-auto justify-center min-h-[56px] px-9 py-4 rounded-full bg-[#002349] hover:bg-[#00142B] disabled:opacity-60 text-white font-body text-base sm:text-lg font-medium inline-flex items-center gap-3 transition-colors duration-200"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-[#C9A24B]" />
                        <span>{t.generatingBtn}</span>
                      </>
                    ) : (
                      <>
                        <span>{t.generateQuestionsBtn}</span>
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.section>
          )}

          {/* STEP 2: FULL-SCREEN QUESTIONS REVIEW */}
          {step === 2 && (
            <motion.section key="step-2" {...stepMotionProps} className="max-w-5xl space-y-10">
              <div className="space-y-3">
                <span className="font-mono-file text-sm uppercase tracking-[0.14em] text-[#957C3D] font-bold">
                  02 · STATUTORY RECORD DEMANDS ({fileNumber})
                </span>
                <h1 className="font-editorial text-3xl sm:text-6xl text-[#002349] leading-[1.05]">
                  {uiLang === "hi"
                    ? "फ़ाइल से मांगे जाने वाले सटीक सवाल।"
                    : "Here is what we demand from the file."}
                </h1>
              </div>

              {/* Plain-Language Summary & Subject */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-[#002349]/15">
                <div>
                  <label className="font-mono-file text-xs uppercase tracking-wider text-[#7A8794] block mb-2">
                    {t.summaryHeading}
                  </label>
                  <textarea
                    rows={3}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    className="w-full bg-transparent border-0 border-b border-[#002349]/40 focus:border-[#002349] py-2 font-body text-base text-[#0B1B33] leading-relaxed focus:outline-none"
                  />
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="font-mono-file text-xs uppercase tracking-wider text-[#7A8794] block mb-2">
                      SUBJECT LINE
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full bg-transparent border-0 border-b border-[#002349]/40 focus:border-[#002349] py-2 font-body text-base font-medium text-[#0B1B33] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-mono-file text-xs uppercase tracking-wider text-[#7A8794] block mb-2">
                      PERIOD OF RECORDS
                    </label>
                    <input
                      type="text"
                      value={periodOfInformation}
                      onChange={(e) => setPeriodOfInformation(e.target.value)}
                      className="w-full bg-transparent border-0 border-b border-[#002349]/40 focus:border-[#002349] py-2 font-mono-file text-sm text-[#0B1B33] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Editable Questions List */}
              <div className="space-y-6 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono-file text-xs uppercase tracking-wider text-[#7A8794]">
                    {t.questionsHeading} ({questions.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuestions([...questions, ""])}
                    className="min-h-[36px] px-4 py-1.5 rounded-full border border-[#002349] text-xs font-mono-file uppercase tracking-wider text-[#002349] hover:bg-[#002349] hover:text-white inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.addQuestionBtn}</span>
                  </button>
                </div>

                <div className="bg-white divide-y divide-[#002349]/15 border-y border-[#002349]/20 px-4 sm:px-6">
                  {questions.map((q, idx) => (
                    <div key={idx} className="py-5 flex items-start gap-4">
                      <span className="font-mono-file text-lg font-bold text-[#957C3D] pt-1 shrink-0">
                        0{idx + 1}
                      </span>
                      <textarea
                        rows={2}
                        value={q}
                        onChange={(e) => {
                          const next = [...questions];
                          next[idx] = e.target.value;
                          setQuestions(next);
                        }}
                        className="flex-1 bg-transparent font-body text-base sm:text-lg text-[#0B1B33] leading-relaxed focus:outline-none resize-none"
                      />
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setQuestions(questions.filter((_, i) => i !== idx))}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#7A8794] hover:text-[#C8341F]"
                          title="Delete question"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {helpfulTip && (
                  <p className="font-mono-file text-xs text-[#0B1B33] bg-[#C9A24B]/20 border border-[#C9A24B]/45 px-3.5 py-2.5 inline-block">
                    FILING NOTE · {helpfulTip}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="min-h-[50px] px-7 py-3 rounded-full border border-[#002349]/30 hover:border-[#002349] font-body text-sm font-medium text-[#002349] inline-flex items-center gap-2 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{uiLang === "hi" ? "वापस" : "Back"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep(3);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="min-h-[54px] px-8 py-3.5 rounded-full bg-[#002349] hover:bg-[#00142B] text-white font-body text-base font-medium inline-flex items-center gap-3 transition-colors duration-200"
                >
                  <span>{uiLang === "hi" ? "आगे: सही विभाग चुनें" : "Next: Confirm Public Office"}</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </motion.section>
          )}

          {/* STEP 3: FULL-SCREEN OFFICE FINDER (42 GENERIC OFFICES) */}
          {step === 3 && (
            <motion.section key="step-3" {...stepMotionProps} className="max-w-5xl space-y-10">
              <div className="flex flex-wrap items-end justify-between gap-6">
                <div className="space-y-3">
                  <span className="font-mono-file text-sm uppercase tracking-[0.14em] text-[#957C3D] font-bold">
                    03 · RECEIVING PUBLIC AUTHORITY ({PUBLIC_OFFICES.length} GENERIC OFFICES)
                  </span>
                  <h1 className="font-editorial text-3xl sm:text-6xl text-[#002349] leading-[1.05]">
                    {t.officeHeading}
                  </h1>
                  <p className="font-body text-base text-[#0B1B33]/75">{t.officeSub}</p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowOfficeBrowser(!showOfficeBrowser)}
                  className="min-h-[44px] px-6 py-2.5 rounded-full border border-[#002349] hover:bg-[#002349] hover:text-white font-mono-file text-xs uppercase tracking-wider text-[#002349] transition-colors whitespace-nowrap"
                >
                  {showOfficeBrowser
                    ? "CLOSE DIRECTORY"
                    : `SEARCH ALL ${PUBLIC_OFFICES.length} OFFICES`}
                </button>
              </div>

              {showOfficeBrowser && (
                <div className="bg-[#E5EDF1] border border-[#002349]/20 p-4 sm:p-7 space-y-5">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-[#7A8794] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={officeSearch}
                        onChange={(e) => setOfficeSearch(e.target.value)}
                        placeholder={t.searchOfficesPlaceholder}
                        className="w-full min-h-[44px] pl-9 pr-3 bg-white border-0 border-b border-[#002349] font-body text-sm text-[#0B1B33] focus:outline-none"
                      />
                    </div>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value as OfficeCategory | "all")}
                      className="min-h-[44px] px-4 bg-white border-0 border-b border-[#002349] font-mono-file text-xs uppercase text-[#002349]"
                    >
                      <option value="all">ALL CATEGORIES (42)</option>
                      {(Object.keys(CATEGORY_LABELS) as OfficeCategory[]).map((cat) => (
                        <option key={cat} value={cat}>
                          {CATEGORY_LABELS[cat][uiLang]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="max-h-72 overflow-y-auto bg-white divide-y divide-[#002349]/12 border border-[#002349]/15">
                    {filteredOffices.map((office) => {
                      const active = office.id === selectedOfficeId;
                      return (
                        <button
                          key={office.id}
                          type="button"
                          onClick={() => applyOfficeTemplate(office)}
                          className={`w-full py-3.5 px-4 text-left flex items-start justify-between gap-4 hover:bg-[#E5EDF1]/60 transition-colors ${
                            active ? "bg-[#C9A24B]/18" : ""
                          }`}
                        >
                          <div>
                            <div className="font-mono-file text-[11px] uppercase text-[#7A8794]">
                              {CATEGORY_LABELS[office.category][uiLang]} · {office.jurisdiction}
                            </div>
                            <div className="font-editorial text-lg font-medium text-[#002349] mt-0.5">
                              {office.department}
                            </div>
                            <div className="font-mono-file text-xs text-[#0B1B33]/75 mt-0.5">
                              {office.pioDesignation}
                            </div>
                          </div>
                          <span className="font-mono-file text-xs font-semibold uppercase text-[#002349] shrink-0 pt-1">
                            {active ? "SELECTED" : "USE →"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Editable Dossier Address Lines */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-[#002349]/15">
                <div>
                  <label className="font-mono-file text-xs uppercase tracking-wider text-[#7A8794] block mb-2">
                    TO: PUBLIC INFORMATION OFFICER DESIGNATION
                  </label>
                  <input
                    type="text"
                    value={pioDesignation}
                    onChange={(e) => setPioDesignation(e.target.value)}
                    className="w-full bg-transparent border-0 border-b border-[#002349]/40 focus:border-[#002349] py-2.5 font-body text-base sm:text-lg text-[#0B1B33] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-mono-file text-xs uppercase tracking-wider text-[#7A8794] block mb-2">
                    DEPARTMENT / PUBLIC AUTHORITY
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full bg-transparent border-0 border-b border-[#002349]/40 focus:border-[#002349] py-2.5 font-body text-base sm:text-lg text-[#0B1B33] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-mono-file text-xs uppercase tracking-wider text-[#7A8794] block mb-2">
                    DISTRICT / STATE / OFFICE LOCATION LINE
                  </label>
                  <input
                    type="text"
                    value={locationNote}
                    onChange={(e) => setLocationNote(e.target.value)}
                    className="w-full bg-transparent border-0 border-b border-[#002349]/40 focus:border-[#002349] py-2.5 font-body text-base text-[#0B1B33] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-mono-file text-xs uppercase tracking-wider text-[#7A8794] block mb-2">
                    JURISDICTION
                  </label>
                  <input
                    type="text"
                    value={jurisdiction}
                    onChange={(e) => setJurisdiction(e.target.value)}
                    className="w-full bg-transparent border-0 border-b border-[#002349]/40 focus:border-[#002349] py-2.5 font-mono-file text-base text-[#0B1B33] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-6">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="min-h-[50px] px-7 py-3 rounded-full border border-[#002349]/30 hover:border-[#002349] font-body text-sm font-medium text-[#002349] inline-flex items-center gap-2 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{uiLang === "hi" ? "वापस" : "Back"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep(4);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="min-h-[54px] px-8 py-3.5 rounded-full bg-[#002349] hover:bg-[#00142B] text-white font-body text-base font-medium inline-flex items-center gap-3 transition-colors duration-200"
                >
                  <span>{uiLang === "hi" ? "आगे: तैयार PDF व हस्ताक्षर" : "Next: Sign & Export PDF"}</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </motion.section>
          )}

          {/* STEP 4: SIGN, LIVE A4 SHEET & EXPORT PDF / START CLOCK */}
          {step === 4 && (
            <motion.section key="step-4" {...stepMotionProps} className="space-y-12">
              <div className="space-y-3">
                <span className="font-mono-file text-sm uppercase tracking-[0.14em] text-[#957C3D] font-bold">
                  04 · FINAL EXECUTION & FILING ({fileNumber})
                </span>
                <h1 className="font-editorial text-3xl sm:text-6xl text-[#002349] leading-[1.05]">
                  {t.applicantHeading}
                </h1>
                <p className="font-body text-base text-[#0B1B33]/75">{t.applicantSub}</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
                {/* Left Column: Ruled Applicant Form */}
                <div className="lg:col-span-5 space-y-6">
                  <div>
                    <label className="font-mono-file text-xs uppercase tracking-wider text-[#7A8794] block mb-1.5">
                      APPLICANT FULL NAME
                    </label>
                    <input
                      type="text"
                      placeholder={uiLang === "hi" ? "अपना पूरा नाम लिखें" : "Your full name"}
                      value={applicant.fullName}
                      onChange={(e) => updateApplicantField("fullName", e.target.value)}
                      className="w-full bg-transparent border-0 border-b border-[#002349]/40 focus:border-[#002349] py-2 font-body text-lg text-[#0B1B33] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-mono-file text-xs uppercase tracking-wider text-[#7A8794] block mb-1.5">
                      POSTAL ADDRESS FOR CERTIFIED REPLY
                    </label>
                    <textarea
                      rows={2}
                      placeholder={
                        uiLang === "hi"
                          ? "मकान नं., गली/गाँव, तहसील, ज़िला, राज्य"
                          : "House/Street, Locality, District, State"
                      }
                      value={applicant.postalAddress}
                      onChange={(e) => updateApplicantField("postalAddress", e.target.value)}
                      className="w-full bg-transparent border-0 border-b border-[#002349]/40 focus:border-[#002349] py-2 font-body text-base text-[#0B1B33] focus:outline-none resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="font-mono-file text-xs uppercase tracking-wider text-[#7A8794] block mb-1.5">
                        PIN CODE
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="110001"
                        value={applicant.pinCode}
                        onChange={(e) => updateApplicantField("pinCode", e.target.value)}
                        className="w-full bg-transparent border-0 border-b border-[#002349]/40 focus:border-[#002349] py-2 font-mono-file text-base text-[#0B1B33] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="font-mono-file text-xs uppercase tracking-wider text-[#7A8794] block mb-1.5">
                        PLACE / CITY
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Bhopal"
                        value={applicant.place}
                        onChange={(e) => updateApplicantField("place", e.target.value)}
                        className="w-full bg-transparent border-0 border-b border-[#002349]/40 focus:border-[#002349] py-2 font-body text-base text-[#0B1B33] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="font-mono-file text-xs uppercase tracking-wider text-[#7A8794] block mb-1.5">
                        PHONE (OPTIONAL)
                      </label>
                      <input
                        type="tel"
                        placeholder="+91 ..."
                        value={applicant.contactPhone}
                        onChange={(e) => updateApplicantField("contactPhone", e.target.value)}
                        className="w-full bg-transparent border-0 border-b border-[#002349]/40 focus:border-[#002349] py-2 font-mono-file text-base text-[#0B1B33] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="font-mono-file text-xs uppercase tracking-wider text-[#7A8794] block mb-1.5">
                        FILING DATE
                      </label>
                      <input
                        type="date"
                        value={filingDate}
                        onChange={(e) => setFilingDate(e.target.value)}
                        className="w-full bg-transparent border-0 border-b border-[#002349]/40 focus:border-[#002349] py-2 font-mono-file text-sm text-[#0B1B33] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-mono-file text-xs uppercase tracking-wider text-[#7A8794] block mb-1.5">
                      RECEIPT / PORTAL REF NO. (OPTIONAL)
                    </label>
                    <input
                      type="text"
                      placeholder="Add now or after filing"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      className="w-full bg-transparent border-0 border-b border-[#002349]/40 focus:border-[#002349] py-2 font-mono-file text-sm text-[#0B1B33] focus:outline-none"
                    />
                  </div>

                  <label className="flex items-start gap-3 pt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applicant.isBpl}
                      onChange={(e) => updateApplicantField("isBpl", e.target.checked)}
                      className="mt-1 w-4 h-4 accent-[#002349]"
                    />
                    <span className="font-body text-xs sm:text-sm text-[#0B1B33]/85 leading-relaxed">
                      Below Poverty Line (BPL) fee exemption under Section 7(5) proviso
                    </span>
                  </label>

                  {applicant.isBpl && (
                    <input
                      type="text"
                      placeholder="BPL Card Reference Number"
                      value={applicant.bplCardReference}
                      onChange={(e) => updateApplicantField("bplCardReference", e.target.value)}
                      className="w-full bg-transparent border-0 border-b border-[#002349]/40 focus:border-[#002349] py-1.5 font-mono-file text-xs text-[#0B1B33] focus:outline-none"
                    />
                  )}

                  {/* Gazette Navy Pill Execution Buttons */}
                  <div className="pt-4 space-y-3">
                    <button
                      type="button"
                      onClick={handleDownloadPdf}
                      className="w-full min-h-[54px] px-7 py-3.5 rounded-full bg-[#002349] hover:bg-[#00142B] text-white font-body text-base font-medium flex items-center justify-center gap-2.5 transition-colors duration-200"
                    >
                      <Download className="w-4 h-4" />
                      <span>{t.downloadPdfBtn}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSave(true)}
                      className="w-full min-h-[54px] px-7 py-3.5 rounded-full border-2 border-[#002349] bg-[#E5EDF1] hover:bg-[#002349] text-[#002349] hover:text-white font-body text-base font-semibold flex items-center justify-center gap-2.5 transition-colors duration-200"
                    >
                      <span>{t.saveAndStartClockBtn}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={() => setStep(3)}
                        className="font-mono-file text-xs uppercase tracking-wider text-[#7A8794] hover:text-[#002349] inline-flex items-center gap-1.5"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>BACK TO PIO</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSave(false)}
                        className="font-mono-file text-xs uppercase tracking-wider text-[#002349] underline underline-offset-4"
                      >
                        {t.saveDraftOnlyBtn}
                      </button>
                    </div>

                    {savedBanner && (
                      <p className="font-mono-file text-xs text-[#2E7D4F] inline-flex items-center gap-1.5 pt-2">
                        <Check className="w-4 h-4" />
                        <span>{savedBanner}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Column: Crisp White Gazette A4 Case Sheet Preview */}
                <div className="lg:col-span-7 bg-white border-x border-b border-[#002349]/15 border-t-[3px] border-t-[#C9A24B] shadow-[0_10px_30px_rgba(0,35,73,0.06)] p-5 sm:p-10 space-y-5 relative">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#002349]/12 pb-4">
                    <span className="font-mono-file text-xs font-bold text-[#002349]">
                      DOSSIER SHEET · {fileNumber}
                    </span>
                    <span className="rubber-stamp text-[#002349] text-[10px] -rotate-2">
                      READY TO FILE
                    </span>
                  </div>

                  <h3 className="font-editorial text-xl sm:text-2xl text-[#002349]">
                    {draftLang === "hi"
                      ? "सूचना का अधिकार अधिनियम, 2005 की धारा 6(1) के अंतर्गत आवेदन"
                      : "Application under Section 6(1), Right to Information Act, 2005"}
                  </h3>

                  <div className="font-body text-sm space-y-1 text-[#0B1B33]">
                    <p className="font-semibold text-[#002349]">
                      {draftLang === "hi" ? "सेवा में," : "To,"}
                    </p>
                    <p>{pioDesignation}</p>
                    <p>{department}</p>
                    <p className="font-mono-file text-xs text-[#7A8794]">{locationNote}</p>
                  </div>

                  <div className="font-body text-sm text-[#0B1B33] pt-1">
                    <strong className="text-[#002349]">
                      {draftLang === "hi" ? "विषय: " : "Subject: "}
                    </strong>
                    {subject || "Request for certified records under Section 6(1), RTI Act 2005"}
                  </div>

                  <div className="font-body text-sm space-y-3 text-[#0B1B33] leading-relaxed">
                    {(summary || problemText) && (
                      <p className="text-[#0B1B33]/80">{summary || problemText}</p>
                    )}
                    <p className="font-mono-file text-xs text-[#7A8794]">
                      PERIOD: {periodOfInformation || "Up to date of reply"}
                    </p>
                    <ol className="list-decimal pl-5 space-y-2">
                      {(questions.length > 0
                        ? questions
                        : ["Generate RTI questions in Step 01 to populate this dossier."]
                      ).map((q, idx) => (
                        <li key={idx}>{q || "..."}</li>
                      ))}
                    </ol>
                  </div>

                  <div className="pt-4 border-t border-[#002349]/12 space-y-2 font-body text-xs text-[#0B1B33]">
                    <p className="bg-[#C9A24B]/20 px-3 py-2 font-medium text-[#0B1B33]">
                      Fee Note: Please verify current fee on rtionline.gov.in (or your State RTI
                      portal) before enclosing IPO / Court Fee Stamp / Online Payment.
                    </p>
                    <p className="text-[#7A8794]">
                      Declaration: I am a citizen of India and the information sought does not fall
                      within the exemptions of Sections 8 and 9 of the RTI Act, 2005.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-[#002349]/12 flex flex-col sm:flex-row sm:items-end justify-between gap-4 font-mono-file text-xs text-[#0B1B33]">
                    <div>
                      <p>PLACE: {applicant.place || "[CITY]"}</p>
                      <p>DATE: {formatReadableDate(filingDate, draftLang)}</p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-[#7A8794]">SIGNATURE OF APPLICANT</p>
                      <p className="font-bold text-[#002349] mt-1">
                        {applicant.fullName || "[APPLICANT FULL NAME]"}
                      </p>
                      <p className="text-[#7A8794]">
                        {applicant.postalAddress || "[POSTAL ADDRESS]"}
                        {applicant.pinCode ? ` - ${applicant.pinCode}` : ""}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
