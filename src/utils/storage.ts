import type { ApplicantDetails, BoardLogEntry, RtiRecord, UiLanguage } from "../types";
import { INITIAL_SAMPLE_BOARD_LOGS } from "../data/offices";
import { addDaysToIso, getTodayIsoDate } from "./dateAndClock";

const KEYS = {
  RTIS: "khulasa_rtis_v2",
  APPLICANT: "khulasa_applicant_v1",
  BOARD: "khulasa_board_v2",
  LANG: "khulasa_ui_lang_v1",
};

export const DEFAULT_APPLICANT: ApplicantDetails = {
  fullName: "",
  postalAddress: "",
  pinCode: "",
  contactPhone: "",
  contactEmail: "",
  isBpl: false,
  bplCardReference: "",
  place: "",
};

function createSeededDemoRti(): RtiRecord {
  const filedNineDaysAgo = addDaysToIso(getTodayIsoDate(), -9);
  return {
    id: "demo-seed-scholarship-01",
    createdAt: new Date().toISOString(),
    isSampleDemo: true,
    problemRaw:
      "My post-matric scholarship application was verified by my college 8 months ago, but the amount has still not arrived in my bank account.",
    outputLanguage: "en",
    summary:
      "The applicant's Post-Matric Scholarship application was verified at the institute level eight months ago, yet the scholarship disbursement has not been credited and no reason for pendency has been communicated.",
    subject: "Information regarding pending disbursement of Post-Matric Scholarship application",
    periodOfInformation: "Past 9 months up to the date of furnishing reply",
    questions: [
      "Please provide the certified daily progress report and current stage of processing of my Post-Matric Scholarship application from the date of institute verification till date.",
      "Please provide certified copies of all file notings, scrutiny remarks, or payment batch logs recorded on my scholarship file.",
      "Please state the official designation of the dealing officer / nodal section where my application is currently pending, along with the prescribed timeline under the Department's Citizen Charter.",
      "If any technical objection, bank validation issue, or fund allocation delay has been recorded on file, please provide certified copies of the relevant communication or order sheet.",
    ],
    helpfulTip:
      "Mention your Scholarship Application ID and Academic Year in Question 1 before printing or filing online.",
    office: {
      officeId: "sch-social-justice",
      category: "scholarship",
      department: "State Scholarship Cell",
      pioDesignation: "Public Information Officer (PIO) — Post-Matric Scholarship Disbursement Wing",
      faaDesignation: "First Appellate Authority & Joint Director, State Scholarship Directorate",
      commissionName: "State Information Commission",
      jurisdiction: "State Government",
      locationNote: "[Your District / State Headquarters — Verify exact office on rtionline.gov.in]",
    },
    applicant: {
      ...DEFAULT_APPLICANT,
    },
    filingStatus: "filed",
    filingDate: filedNineDaysAgo,
    referenceNumber: "SAMPLE-RTI-2026-0194",
  };
}

export function loadRtiRecords(): RtiRecord[] {
  try {
    const raw = localStorage.getItem(KEYS.RTIS);
    if (!raw) {
      const initial = [createSeededDemoRti()];
      localStorage.setItem(KEYS.RTIS, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [createSeededDemoRti()];
  } catch {
    return [createSeededDemoRti()];
  }
}

export function saveRtiRecords(records: RtiRecord[]): void {
  try {
    localStorage.setItem(KEYS.RTIS, JSON.stringify(records));
  } catch (e) {
    console.error("Failed to save RTI records to localStorage", e);
  }
}

export function loadApplicantProfile(): ApplicantDetails {
  try {
    const raw = localStorage.getItem(KEYS.APPLICANT);
    if (!raw) return { ...DEFAULT_APPLICANT };
    return { ...DEFAULT_APPLICANT, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_APPLICANT };
  }
}

export function saveApplicantProfile(profile: ApplicantDetails): void {
  try {
    localStorage.setItem(KEYS.APPLICANT, JSON.stringify(profile));
  } catch (e) {
    console.error("Failed to save applicant profile", e);
  }
}

export function loadBoardLogs(): BoardLogEntry[] {
  try {
    const raw = localStorage.getItem(KEYS.BOARD);
    if (!raw) {
      localStorage.setItem(KEYS.BOARD, JSON.stringify(INITIAL_SAMPLE_BOARD_LOGS));
      return INITIAL_SAMPLE_BOARD_LOGS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_SAMPLE_BOARD_LOGS;
  } catch {
    return INITIAL_SAMPLE_BOARD_LOGS;
  }
}

export function saveBoardLogs(logs: BoardLogEntry[]): void {
  try {
    localStorage.setItem(KEYS.BOARD, JSON.stringify(logs));
  } catch (e) {
    console.error("Failed to save board logs", e);
  }
}

export function loadUiLanguage(): UiLanguage {
  try {
    const val = localStorage.getItem(KEYS.LANG);
    return val === "hi" ? "hi" : "en";
  } catch {
    return "en";
  }
}

export function saveUiLanguage(lang: UiLanguage): void {
  try {
    localStorage.setItem(KEYS.LANG, lang);
  } catch {
    // Ignore storage errors
  }
}
