export type UiLanguage = "en" | "hi";

export type NavSection = "home" | "new" | "my-rtis" | "board";

export type OfficeCategory =
  | "scholarship"
  | "municipal"
  | "electricity"
  | "ration"
  | "police"
  | "university"
  | "water"
  | "health"
  | "revenue"
  | "pension";

export interface PublicOffice {
  id: string;
  category: OfficeCategory;
  department: string;
  pioDesignation: string;
  faaDesignation: string;
  commissionName: string;
  jurisdiction: "Central Government" | "State Government" | "Urban / Local Body" | "Public University";
  locationPlaceholder: string;
  keywords: string[];
}

export interface ApplicantDetails {
  fullName: string;
  postalAddress: string;
  pinCode: string;
  contactPhone: string;
  contactEmail: string;
  isBpl: boolean;
  bplCardReference: string;
  place: string;
}

export interface AppealDocument {
  stage: "first" | "second";
  generatedAt: string;
  authorityTitle: string;
  authorityDepartment: string;
  subject: string;
  factsAndChronology: string[];
  legalGrounds: string[];
  prayer: string[];
  enclosuresList: string[];
}

export interface RtiRecord {
  id: string;
  createdAt: string;
  isSampleDemo?: boolean;
  problemRaw: string;
  outputLanguage: UiLanguage;
  summary: string;
  subject: string;
  periodOfInformation: string;
  questions: string[];
  helpfulTip?: string;
  office: {
    officeId: string;
    category: OfficeCategory;
    department: string;
    pioDesignation: string;
    faaDesignation: string;
    commissionName: string;
    jurisdiction: string;
    locationNote: string;
  };
  applicant: ApplicantDetails;
  filingStatus: "draft" | "filed" | "first_appeal_filed" | "resolved";
  filingDate: string; // YYYY-MM-DD
  referenceNumber: string;
  firstAppealFiledDate?: string; // YYYY-MM-DD
  firstAppeal?: AppealDocument;
  secondAppeal?: AppealDocument;
  outcomeLogged?: "replied" | "rejected" | "ignored";
}

export type OutcomeType = "replied" | "rejected" | "ignored";

export interface BoardLogEntry {
  id: string;
  officeId: string;
  department: string;
  category: OfficeCategory;
  outcome: OutcomeType;
  loggedAt: string;
  isSample: boolean;
}
