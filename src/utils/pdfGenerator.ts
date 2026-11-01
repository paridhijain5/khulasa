import { jsPDF } from "jspdf";
import type { AppealDocument, RtiRecord } from "../types";
import { formatReadableDate } from "./dateAndClock";

interface PdfParagraphBlock {
  text: string;
  style: "heading" | "subheading" | "body" | "bold" | "indent" | "muted" | "divider" | "right" | "rightBold";
  spaceAfter?: number;
}

function containsNonLatinScript(blocks: PdfParagraphBlock[]): boolean {
  // Check for Devanagari or extended Unicode outside Latin-1
  return blocks.some((b) => /[^\u0000-\u00FF]/.test(b.text));
}

function wrapCanvasLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

/**
 * High-DPI canvas-to-jsPDF paginator so Hindi (Devanagari) and mixed-script RTI documents
 * render with crisp typography without missing font glyphs.
 */
function renderBlocksViaCanvasToPdf(blocks: PdfParagraphBlock[], filename: string): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const scale = 2.4;
  const pageW = Math.round(794 * scale);
  const pageH = Math.round(1123 * scale);
  const marginX = Math.round(68 * scale);
  const marginTop = Math.round(68 * scale);
  const marginBottom = Math.round(74 * scale);
  const contentW = pageW - marginX * 2;

  const pages: HTMLCanvasElement[] = [];

  const createNewPageCanvas = () => {
    const canvas = document.createElement("canvas");
    canvas.width = pageW;
    canvas.height = pageH;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, pageW, pageH);
    pages.push(canvas);
    return ctx;
  };

  let ctx = createNewPageCanvas();
  let y = marginTop;

  const ensureSpace = (neededPx: number) => {
    if (y + neededPx > pageH - marginBottom) {
      ctx = createNewPageCanvas();
      y = marginTop;
    }
  };

  for (const block of blocks) {
    if (block.style === "divider") {
      ensureSpace(Math.round(18 * scale));
      ctx.strokeStyle = "#CBD5E1";
      ctx.lineWidth = Math.max(1, Math.round(1 * scale));
      ctx.beginPath();
      ctx.moveTo(marginX, y + Math.round(4 * scale));
      ctx.lineTo(pageW - marginX, y + Math.round(4 * scale));
      ctx.stroke();
      y += Math.round((block.spaceAfter ?? 14) * scale);
      continue;
    }

    let fontSize = 13;
    let fontWeight = "400";
    let fontFamily = '"Inter", "Tiro Devanagari Hindi", sans-serif';
    let fill = "#0B1B33";
    let align: "left" | "right" | "center" = "left";
    let leftIndent = 0;

    switch (block.style) {
      case "heading":
        fontSize = 17;
        fontWeight = "700";
        fontFamily = '"Fraunces", "Tiro Devanagari Hindi", Georgia, serif';
        align = "center";
        break;
      case "subheading":
        fontSize = 13.5;
        fontWeight = "700";
        break;
      case "bold":
        fontSize = 13;
        fontWeight = "600";
        break;
      case "indent":
        fontSize = 13;
        leftIndent = Math.round(18 * scale);
        break;
      case "muted":
        fontSize = 11;
        fill = "#475569";
        break;
      case "right":
        fontSize = 13;
        align = "right";
        break;
      case "rightBold":
        fontSize = 13;
        fontWeight = "700";
        align = "right";
        break;
      default:
        fontSize = 13;
        break;
    }

    const pxFont = Math.round(fontSize * scale);
    const lineHeight = Math.round(fontSize * 1.55 * scale);
    ctx.font = `${fontWeight} ${pxFont}px ${fontFamily}`;
    ctx.fillStyle = fill;
    ctx.textBaseline = "top";

    const paragraphs = block.text.split("\n");
    for (const para of paragraphs) {
      const wrapped = wrapCanvasLine(ctx, para, contentW - leftIndent);
      for (const line of wrapped) {
        ensureSpace(lineHeight);
        // Re-apply font in case a new page context was created
        ctx.font = `${fontWeight} ${pxFont}px ${fontFamily}`;
        ctx.fillStyle = fill;
        ctx.textBaseline = "top";

        if (align === "center") {
          ctx.textAlign = "center";
          ctx.fillText(line, pageW / 2, y);
        } else if (align === "right") {
          ctx.textAlign = "right";
          ctx.fillText(line, pageW - marginX, y);
        } else {
          ctx.textAlign = "left";
          ctx.fillText(line, marginX + leftIndent, y);
        }
        y += lineHeight;
      }
    }

    y += Math.round((block.spaceAfter ?? 8) * scale);
  }

  // Stamp footer disclaimer & page numbers on every canvas page
  pages.forEach((canvas, idx) => {
    const c = canvas.getContext("2d")!;
    const footFont = Math.round(9.5 * scale);
    c.font = `400 ${footFont}px "Inter", "Tiro Devanagari Hindi", sans-serif`;
    c.fillStyle = "#64748B";
    c.textBaseline = "bottom";
    c.textAlign = "left";
    c.fillText(
      "Khulasa helps you draft. Verify details on the official RTI portal (rtionline.gov.in).",
      marginX,
      pageH - Math.round(28 * scale)
    );
    c.textAlign = "right";
    c.fillText(`Page ${idx + 1} of ${pages.length}`, pageW - marginX, pageH - Math.round(28 * scale));

    if (idx > 0) doc.addPage();
    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    doc.addImage(imgData, "JPEG", 0, 0, 210, 297);
  });

  doc.save(filename);
}

/**
 * Native crisp vector jsPDF renderer for Latin/English RTI documents.
 */
function renderBlocksNativeVectorPdf(blocks: PdfParagraphBlock[], filename: string): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 20;
  const marginTop = 20;
  const marginBottom = 22;
  const contentWidth = pageWidth - marginX * 2;

  let y = marginTop;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageHeight - marginBottom) {
      doc.addPage();
      y = marginTop;
    }
  };

  for (const block of blocks) {
    if (block.style === "divider") {
      ensureSpace(6);
      doc.setDrawColor(190, 198, 210);
      doc.setLineWidth(0.3);
      doc.line(marginX, y + 1, pageWidth - marginX, y + 1);
      y += block.spaceAfter ?? 5;
      continue;
    }

    let fontSize = 10.5;
    let fontStyle: "normal" | "bold" = "normal";
    let fontName: "times" | "helvetica" = "times";
    let textColor: [number, number, number] = [16, 37, 66];
    let align: "left" | "center" | "right" = "left";
    let indentMm = 0;

    switch (block.style) {
      case "heading":
        fontSize = 13.5;
        fontStyle = "bold";
        align = "center";
        break;
      case "subheading":
        fontSize = 11;
        fontStyle = "bold";
        break;
      case "bold":
        fontSize = 10.5;
        fontStyle = "bold";
        break;
      case "indent":
        fontSize = 10.5;
        indentMm = 6;
        break;
      case "muted":
        fontSize = 9;
        fontName = "helvetica";
        textColor = [90, 105, 125];
        break;
      case "right":
        fontSize = 10.5;
        align = "right";
        break;
      case "rightBold":
        fontSize = 10.5;
        fontStyle = "bold";
        align = "right";
        break;
      default:
        fontSize = 10.5;
        break;
    }

    doc.setFont(fontName, fontStyle);
    doc.setFontSize(fontSize);
    doc.setTextColor(...textColor);

    const lineHeightMm = fontSize * 0.48;
    const lines: string[] = doc.splitTextToSize(block.text, contentWidth - indentMm);

    for (const line of lines) {
      ensureSpace(lineHeightMm + 1);
      if (align === "center") {
        doc.text(line, pageWidth / 2, y, { align: "center" });
      } else if (align === "right") {
        doc.text(line, pageWidth - marginX, y, { align: "right" });
      } else {
        doc.text(line, marginX + indentMm, y);
      }
      y += lineHeightMm;
    }

    y += (block.spaceAfter ?? 3) * 0.55;
  }

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110, 122, 138);
    doc.text(
      "Khulasa helps you draft. Verify details on the official RTI portal (rtionline.gov.in).",
      marginX,
      pageHeight - 10
    );
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - marginX, pageHeight - 10, { align: "right" });
  }

  doc.save(filename);
}

function exportBlocksToPdf(blocks: PdfParagraphBlock[], filename: string): void {
  if (containsNonLatinScript(blocks)) {
    renderBlocksViaCanvasToPdf(blocks, filename);
  } else {
    renderBlocksNativeVectorPdf(blocks, filename);
  }
}

export function downloadRtiApplicationPdf(record: RtiRecord): void {
  const isHi = record.outputLanguage === "hi";
  const applicantName = record.applicant.fullName.trim() || (isHi ? "[आवेदक का पूरा नाम]" : "[Applicant Full Name]");
  const applicantAddress =
    record.applicant.postalAddress.trim() ||
    (isHi ? "[आवेदक का डाक पता एवं पिन कोड]" : "[Applicant Complete Postal Address]");
  const pinStr = record.applicant.pinCode.trim() ? ` - ${record.applicant.pinCode.trim()}` : "";
  const contactLine = [record.applicant.contactPhone.trim(), record.applicant.contactEmail.trim()]
    .filter(Boolean)
    .join(" | ");
  const placeStr = record.applicant.place.trim() || (isHi ? "[स्थान / शहर]" : "[City / Town]");
  const dateStr = formatReadableDate(record.filingDate, record.outputLanguage);

  const blocks: PdfParagraphBlock[] = isHi
    ? [
        {
          text: "सूचना का अधिकार अधिनियम, 2005 की धारा 6(1) के अंतर्गत सूचना हेतु आवेदन",
          style: "heading",
          spaceAfter: 10,
        },
        { text: "", style: "divider", spaceAfter: 10 },
        { text: "सेवा में,", style: "bold", spaceAfter: 3 },
        { text: record.office.pioDesignation, style: "body", spaceAfter: 2 },
        { text: record.office.department, style: "body", spaceAfter: 2 },
        { text: record.office.locationNote, style: "muted", spaceAfter: 10 },
        { text: `विषय: ${record.subject}`, style: "subheading", spaceAfter: 8 },
        { text: "महोदय / महोदया,", style: "body", spaceAfter: 5 },
        {
          text: `संक्षिप्त पृष्ठभूमि: ${record.summary}`,
          style: "body",
          spaceAfter: 6,
        },
        {
          text: `मांगी गई सूचना की संबंधित अवधि: ${record.periodOfInformation || "अद्यतन तिथि तक"}`,
          style: "bold",
          spaceAfter: 6,
        },
        {
          text: "कृपया सूचना का अधिकार अधिनियम, 2005 की धारा 6(1) के अंतर्गत निम्नलिखित बिंदुओं पर प्रमाणित एवं बिंदुवार जानकारी प्रदान करें:",
          style: "body",
          spaceAfter: 6,
        },
        ...record.questions.map((q, idx) => ({
          text: `${idx + 1}. ${q}`,
          style: "indent" as const,
          spaceAfter: 6,
        })),
        { text: "", style: "divider", spaceAfter: 8 },
        {
          text: record.applicant.isBpl
            ? `शुल्क विवरण (BPL छूट): आवेदक गरीबी रेखा से नीचे (BPL) श्रेणी से संबंधित है (संदर्भ: ${record.applicant.bplCardReference || "BPL प्रमाणपत्र संलग्न"}), अतः धारा 7(5) के परंतुक के तहत आवेदन शुल्क से मुक्त है। (कृपया rtionline.gov.in पर वर्तमान नियम सत्यापित करें / verify current fee on rtionline.gov.in)`
            : "आवेदन शुल्क टिप्पणी (Fee Note): कृपया वर्तमान आरटीआई आवेदन शुल्क एवं भुगतान माध्यम (IPO / कोर्ट फीस स्टाम्प / ऑनलाइन भुगतान) आधिकारिक पोर्टल पर सत्यापित करें — verify current fee on rtionline.gov.in.",
          style: "bold",
          spaceAfter: 8,
        },
        {
          text: "घोषणा (Declaration): मैं एतद्द्वारा घोषित करता/करती हूँ कि मैं भारत का नागरिक हूँ तथा मांगी गई सूचना आरटीआई अधिनियम, 2005 की धारा 8 एवं 9 के अंतर्गत किसी भी छूट की श्रेणी में नहीं आती है।",
          style: "body",
          spaceAfter: 14,
        },
        { text: "भवदीय / आवेदक के हस्ताक्षर:", style: "rightBold", spaceAfter: 14 },
        { text: `हस्ताक्षर: _______________________`, style: "right", spaceAfter: 4 },
        { text: `नाम: ${applicantName}`, style: "rightBold", spaceAfter: 3 },
        { text: `डाक पता: ${applicantAddress}${pinStr}`, style: "right", spaceAfter: 3 },
        ...(contactLine ? [{ text: `संपर्क: ${contactLine}`, style: "right" as const, spaceAfter: 6 }] : []),
        { text: `स्थान: ${placeStr}`, style: "body", spaceAfter: 2 },
        { text: `दिनांक: ${dateStr}`, style: "body", spaceAfter: 6 },
      ]
    : [
        {
          text: "APPLICATION UNDER SECTION 6(1) OF THE RIGHT TO INFORMATION ACT, 2005",
          style: "heading",
          spaceAfter: 8,
        },
        { text: "", style: "divider", spaceAfter: 8 },
        { text: "To,", style: "bold", spaceAfter: 2 },
        { text: record.office.pioDesignation, style: "body", spaceAfter: 2 },
        { text: record.office.department, style: "body", spaceAfter: 2 },
        { text: record.office.locationNote, style: "muted", spaceAfter: 8 },
        { text: `Subject: ${record.subject}`, style: "subheading", spaceAfter: 6 },
        { text: "Respected Sir / Madam,", style: "body", spaceAfter: 4 },
        {
          text: `Brief Context: ${record.summary}`,
          style: "body",
          spaceAfter: 5,
        },
        {
          text: `Period to which Information Relates: ${record.periodOfInformation || "Up to the date of reply"}`,
          style: "bold",
          spaceAfter: 5,
        },
        {
          text: "Please furnish certified, point-wise information and copies of relevant official records under Section 6(1) read with Section 2(f) & 2(j) of the Right to Information Act, 2005 on the following points:",
          style: "body",
          spaceAfter: 6,
        },
        ...record.questions.map((q, idx) => ({
          text: `${idx + 1}. ${q}`,
          style: "indent" as const,
          spaceAfter: 5,
        })),
        { text: "", style: "divider", spaceAfter: 6 },
        {
          text: record.applicant.isBpl
            ? `Application Fee Note (BPL Exemption): The applicant belongs to the Below Poverty Line (BPL) category (Card/Ref: ${record.applicant.bplCardReference || "Copy enclosed"}) and is exempt from application fee under the proviso to Section 7(5) of the RTI Act, 2005. Please verify current fee on rtionline.gov.in.`
            : "Application Fee Note: Please verify current fee on rtionline.gov.in (or your respective State RTI rules) and enclose/pay the applicable fee via Indian Postal Order, Court Fee Stamp, Demand Draft, or Online Portal.",
          style: "bold",
          spaceAfter: 7,
        },
        {
          text: "Declaration: I hereby state that I am a citizen of India. To the best of my knowledge, the information sought does not fall within the exemptions of Sections 8 and 9 of the Right to Information Act, 2005.",
          style: "body",
          spaceAfter: 12,
        },
        { text: "Yours faithfully,", style: "rightBold", spaceAfter: 14 },
        { text: "Signature: _________________________", style: "right", spaceAfter: 4 },
        { text: `Name: ${applicantName}`, style: "rightBold", spaceAfter: 2 },
        { text: `Address: ${applicantAddress}${pinStr}`, style: "right", spaceAfter: 2 },
        ...(contactLine ? [{ text: `Contact: ${contactLine}`, style: "right" as const, spaceAfter: 6 }] : []),
        { text: `Place: ${placeStr}`, style: "body", spaceAfter: 2 },
        { text: `Date: ${dateStr}`, style: "body", spaceAfter: 4 },
      ];

  const slug = record.subject
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);

  exportBlocksToPdf(blocks, `khulasa-rti-${slug || "application"}.pdf`);
}

export function downloadAppealPdf(record: RtiRecord, appeal: AppealDocument): void {
  const isSecond = appeal.stage === "second";
  const isHi = record.outputLanguage === "hi";
  const applicantName = record.applicant.fullName.trim() || (isHi ? "[अपीलकर्ता का नाम]" : "[Appellant Full Name]");
  const applicantAddress =
    record.applicant.postalAddress.trim() || (isHi ? "[अपीलकर्ता का डाक पता]" : "[Appellant Postal Address]");
  const pinStr = record.applicant.pinCode.trim() ? ` - ${record.applicant.pinCode.trim()}` : "";
  const contactLine = [record.applicant.contactPhone.trim(), record.applicant.contactEmail.trim()]
    .filter(Boolean)
    .join(" | ");
  const placeStr = record.applicant.place.trim() || (isHi ? "[स्थान]" : "[Place]");
  const appealDateStr = formatReadableDate(appeal.generatedAt.slice(0, 10), record.outputLanguage);

  const headingText = isSecond
    ? isHi
      ? "सूचना का अधिकार अधिनियम, 2005 की धारा 19(3) के अंतर्गत द्वितीय अपील"
      : "SECOND APPEAL UNDER SECTION 19(3) OF THE RIGHT TO INFORMATION ACT, 2005"
    : isHi
    ? "सूचना का अधिकार अधिनियम, 2005 की धारा 19(1) के अंतर्गत प्रथम अपील"
    : "FIRST APPEAL UNDER SECTION 19(1) OF THE RIGHT TO INFORMATION ACT, 2005";

  const blocks: PdfParagraphBlock[] = [
    { text: headingText, style: "heading", spaceAfter: 8 },
    { text: "", style: "divider", spaceAfter: 8 },
    { text: isHi ? "समक्ष / सेवा में," : "Before / To,", style: "bold", spaceAfter: 2 },
    { text: appeal.authorityTitle, style: "body", spaceAfter: 2 },
    { text: appeal.authorityDepartment, style: "body", spaceAfter: 2 },
    { text: record.office.locationNote, style: "muted", spaceAfter: 8 },
    { text: `${isHi ? "विषय" : "Subject"}: ${appeal.subject}`, style: "subheading", spaceAfter: 6 },
    {
      text: isHi ? "1. अपीलकर्ता का विवरण:" : "1. Particulars of the Appellant:",
      style: "bold",
      spaceAfter: 3,
    },
    {
      text: `${applicantName}, ${applicantAddress}${pinStr}${contactLine ? ` (${contactLine})` : ""}`,
      style: "indent",
      spaceAfter: 6,
    },
    {
      text: isHi ? "2. संबंधित जन सूचना अधिकारी (PIO):" : "2. Particulars of the Public Information Officer (PIO):",
      style: "bold",
      spaceAfter: 3,
    },
    {
      text: `${record.office.pioDesignation}, ${record.office.department}`,
      style: "indent",
      spaceAfter: 6,
    },
    {
      text: isHi ? "3. तथ्यों का कालक्रम (Chronology of Facts):" : "3. Brief Facts & Chronology of Silence:",
      style: "bold",
      spaceAfter: 4,
    },
    ...appeal.factsAndChronology.map((item, idx) => ({
      text: `3.${idx + 1} ${item}`,
      style: "indent" as const,
      spaceAfter: 4,
    })),
    {
      text: isHi ? "4. अपील के विधिक आधार (Grounds of Appeal):" : "4. Legal Grounds for Appeal:",
      style: "bold",
      spaceAfter: 4,
    },
    ...appeal.legalGrounds.map((item, idx) => ({
      text: `4.${idx + 1} ${item}`,
      style: "indent" as const,
      spaceAfter: 4,
    })),
    {
      text: isHi ? "5. प्रार्थना (Prayer / Relief Sought):" : "5. Prayer / Relief Sought:",
      style: "bold",
      spaceAfter: 4,
    },
    ...appeal.prayer.map((item, idx) => ({
      text: `(${String.fromCharCode(97 + idx)}) ${item}`,
      style: "indent" as const,
      spaceAfter: 4,
    })),
    {
      text: isHi ? "6. संलग्नक सूची (Self-Attested Enclosures):" : "6. Index of Self-Attested Enclosures:",
      style: "bold",
      spaceAfter: 4,
    },
    ...appeal.enclosuresList.map((item, idx) => ({
      text: `${idx + 1}. ${item}`,
      style: "indent" as const,
      spaceAfter: 3,
    })),
    { text: "", style: "divider", spaceAfter: 6 },
    {
      text: isHi
        ? "सत्यापन: मैं एतद्द्वारा सत्यापित करता/करती हूँ कि उपरोक्त अपील में वर्णित सभी तथ्य एवं तिथियाँ मेरी जानकारी और विश्वास के अनुसार सत्य हैं।"
        : "Verification: I hereby declare that the particulars and dates stated above are true and correct to the best of my knowledge and belief.",
      style: "body",
      spaceAfter: 12,
    },
    {
      text: isHi ? "अपीलकर्ता के हस्ताक्षर: _________________________" : "Signature of Appellant: _________________________",
      style: "rightBold",
      spaceAfter: 4,
    },
    { text: `${applicantName}`, style: "right", spaceAfter: 6 },
    { text: `${isHi ? "स्थान" : "Place"}: ${placeStr}`, style: "body", spaceAfter: 2 },
    { text: `${isHi ? "दिनांक" : "Date"}: ${appealDateStr}`, style: "body", spaceAfter: 4 },
  ];

  const stageLabel = isSecond ? "second-appeal-sec19-3" : "first-appeal-sec19-1";
  exportBlocksToPdf(blocks, `khulasa-${stageLabel}.pdf`);
}
