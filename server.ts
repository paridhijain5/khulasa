import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "1mb" }));

  // Health endpoint
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // 1. RTI Intake: Citizen problem (EN or HI) -> Plain summary + 3-5 sharp RTI questions + office match
  app.post("/api/rti/intake", async (req: Request, res: Response) => {
    try {
      const { problem, outputLanguage = "en", officesCatalog = [] } = req.body ?? {};
      if (!problem || typeof problem !== "string" || problem.trim().length < 5) {
        res.status(400).json({ error: "Please describe your issue in at least a few words." });
        return;
      }

      const ai = getGenAIClient();
      const langLabel = outputLanguage === "hi" ? "Hindi (Devanagari script, plain citizen-friendly Hindi)" : "English (clear, everyday plain English)";

      const catalogContext = Array.isArray(officesCatalog) && officesCatalog.length > 0
        ? officesCatalog
            .map((o: { id: string; category: string; department: string }) => `${o.id}: [${o.category}] ${o.department}`)
            .join("\n")
        : "";

      const systemInstruction = `You are Khulasa's Right to Information (RTI Act, 2005, India) drafting specialist helping ordinary citizens.
Your job is to turn an everyday grievance or delay described in English, Hindi, or Hinglish into:
1. A concise, empathetic, plain-language summary of the citizen's problem (2-3 sentences).
2. A formal, concise RTI Subject line (under 14 words).
3. A suggested period of information (e.g., "Past 8 months up to date of reply").
4. Between 3 and 5 specific, answerable RTI questions under Section 2(f) and Section 6(1) of the RTI Act, 2005.
CRITICAL RULES FOR RTI QUESTIONS:
- NEVER ask open-ended "Why..." opinions that Public Information Officers reject as not falling under Section 2(f).
- Instead, ask for verifiable records: daily progress report on the application/complaint, certified copies of file notings/order sheets, current status and exact stage of pendency, designation (NOT personal name) of the official currently holding the file, Citizen Charter timeline/norms for this service, and reasons recorded on file for any delay.
- Do NOT invent any personal names, phone numbers, or street addresses of officials. Use generic official designations only (e.g. "Public Information Officer", "Dealing Assistant / Nodal Officer").
- Write summary, subject, periodOfInformation, questions, and helpfulTip in ${langLabel}.
- Choose matchedOfficeId strictly from the provided catalog IDs if one fits, otherwise return the closest catalog ID.`;

      const prompt = `Citizen's Problem Description:
"""
${problem.trim()}
"""

Available Generic Office Catalog IDs:
${catalogContext}

Return structured JSON matching the schema.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.STRING,
                description: "Plain-language summary of the citizen's problem in 2-3 clear sentences.",
              },
              subject: {
                type: Type.STRING,
                description: "Formal Subject line for the RTI application.",
              },
              periodOfInformation: {
                type: Type.STRING,
                description: "Time period to which the requested information relates.",
              },
              questions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "3 to 5 specific, record-based answerable RTI questions.",
              },
              matchedCategory: {
                type: Type.STRING,
                description: "Best matching category slug such as scholarship, municipal, electricity, ration, police, university, water, health, revenue, or pension.",
              },
              matchedOfficeId: {
                type: Type.STRING,
                description: "Exact office ID from the catalog that best matches this problem.",
              },
              helpfulTip: {
                type: Type.STRING,
                description: "One practical tip for the citizen (e.g., attaching application ID or receipt reference).",
              },
            },
            required: [
              "summary",
              "subject",
              "periodOfInformation",
              "questions",
              "matchedCategory",
              "matchedOfficeId",
              "helpfulTip",
            ],
          },
        },
      });

      const rawText = (response.text ?? "{}").trim();
      const parsed = JSON.parse(rawText);

      // Ensure 3-5 questions
      if (Array.isArray(parsed.questions)) {
        parsed.questions = parsed.questions.slice(0, 5);
      }

      res.json(parsed);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to generate RTI draft.";
      console.error("Error in /api/rti/intake:", message);
      res.status(500).json({ error: message });
    }
  });

  // 2. Appeal Auto-Drafter: First Appeal (Sec 19(1)) & Second Appeal (Sec 19(3))
  app.post("/api/rti/appeal", async (req: Request, res: Response) => {
    try {
      const {
        stage = "first",
        outputLanguage = "en",
        rtiSubject,
        rtiSummary,
        questions = [],
        department,
        pioDesignation,
        jurisdiction,
        filingDate,
        deadlineDate,
        daysElapsed,
        firstAppealDate,
        referenceNumber,
      } = req.body ?? {};

      if (!rtiSubject || !filingDate) {
        res.status(400).json({ error: "Missing RTI details or filing date for appeal drafting." });
        return;
      }

      const ai = getGenAIClient();
      const langLabel = outputLanguage === "hi" ? "Hindi (Devanagari script, clear formal legal Hindi)" : "English (clear, formal citizen-accessible English)";
      const isSecond = stage === "second";

      const systemInstruction = `You are Khulasa's RTI Appellate Legal Drafting Specialist under the Right to Information Act, 2005 (India).
Draft a complete, accurate ${isSecond ? "Second Appeal under Section 19(3) to the Central / State Information Commission" : "First Appeal under Section 19(1) to the First Appellate Authority (FAA)"}.
CRITICAL RULES:
- Use ONLY generic institutional designations (e.g., "The First Appellate Authority", "The Hon'ble State / Central Information Commission"). Do NOT invent personal names or street addresses.
- Cite accurate provisions of the RTI Act, 2005:
  * Section 7(1): Mandatory 30-day statutory time limit for the PIO to supply information.
  * Section 7(2): Failure to provide decision within 30 days constitutes "Deemed Refusal" of the request.
  * Section 7(6): Because the 30-day period has expired without reply, all requested information must now be provided FREE OF CHARGE.
  * ${isSecond ? "Section 19(3): Right to prefer Second Appeal before the Information Commission within 90 days after First Appeal period/decision, and Section 20(1) prayer for show-cause / disciplinary inquiry if silence was without reasonable cause." : "Section 19(1): Right to prefer First Appeal within 30 days from the expiry of the 30-day statutory period to the officer senior in rank to the PIO."}
- Incorporate the exact dates provided (Original RTI Filing Date, 30-Day Statutory Deadline Date, Days Elapsed${firstAppealDate ? `, First Appeal Date: ${firstAppealDate}` : ""}).
- Write all fields in ${langLabel}.`;

      const prompt = `Draft Stage: ${isSecond ? "SECOND APPEAL (Section 19(3) to Information Commission)" : "FIRST APPEAL (Section 19(1) to First Appellate Authority)"}
Department: ${department}
PIO Designation: ${pioDesignation}
Jurisdiction: ${jurisdiction || "State / Central Public Authority"}
Original RTI Reference Number: ${referenceNumber || "Filed via Speed Post / Online Portal"}
Original RTI Filing Date: ${filingDate}
30-Day Statutory Deadline Date: ${deadlineDate}
Total Days Elapsed Since Filing: ${daysElapsed} days
${firstAppealDate ? `First Appeal Filing Date: ${firstAppealDate}` : ""}
Original Subject: ${rtiSubject}
Problem Context: ${rtiSummary}
Original RTI Questions:
${Array.isArray(questions) ? questions.map((q: string, idx: number) => `${idx + 1}. ${q}`).join("\n") : ""}

Return structured JSON matching the schema.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              authorityTitle: {
                type: Type.STRING,
                description: "Generic official designation of the appellate authority or Information Commission.",
              },
              authorityDepartment: {
                type: Type.STRING,
                description: "Generic department or Commission name (no invented street address).",
              },
              subject: {
                type: Type.STRING,
                description: "Formal appeal subject line citing Section 19(1) or Section 19(3) and original filing date.",
              },
              factsAndChronology: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "3 to 5 clear numbered chronological statements with exact dates and elapsed days.",
              },
              legalGrounds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "3 to 4 legal grounds citing Section 7(1), Section 7(2) deemed refusal, Section 7(6) free supply, and Section 19.",
              },
              prayer: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "2 to 4 clear reliefs prayed for by the appellant.",
              },
              enclosuresList: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of self-attested enclosures the citizen should attach (e.g., Copy of original RTI application, postal/portal receipt).",
              },
            },
            required: [
              "authorityTitle",
              "authorityDepartment",
              "subject",
              "factsAndChronology",
              "legalGrounds",
              "prayer",
              "enclosuresList",
            ],
          },
        },
      });

      const rawText = (response.text ?? "{}").trim();
      const parsed = JSON.parse(rawText);

      // Guarantee explicit statutory citation of Section 19(1) or Section 19(3) of the RTI Act, 2005
      const requiredSec = isSecond ? "19(3)" : "19(1)";
      if (typeof parsed.subject === "string" && !parsed.subject.includes(requiredSec)) {
        parsed.subject =
          outputLanguage === "hi"
            ? `सूचना का अधिकार अधिनियम, 2005 की धारा ${requiredSec} के अंतर्गत अपील — ${parsed.subject}`
            : `${isSecond ? "Second" : "First"} Appeal under Section ${requiredSec} of the RTI Act, 2005 — ${parsed.subject}`;
      }
      if (Array.isArray(parsed.legalGrounds)) {
        const hasCitation = parsed.legalGrounds.some(
          (g: string) => typeof g === "string" && g.includes(requiredSec)
        );
        if (!hasCitation) {
          parsed.legalGrounds.unshift(
            outputLanguage === "hi"
              ? `सूचना का अधिकार अधिनियम, 2005 की धारा ${requiredSec} के अंतर्गत अपीलकर्ता को यह ${isSecond ? "द्वितीय" : "प्रथम"} अपील दायर करने का वैधानिक अधिकार प्राप्त है।`
              : `This ${isSecond ? "Second" : "First"} Appeal is maintainable under Section ${requiredSec} of the Right to Information Act, 2005, read with Sections 7(1), 7(2), and 7(6) of the Act.`
          );
        }
      }

      res.json(parsed);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to generate RTI appeal draft.";
      console.error("Error in /api/rti/appeal:", message);
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Khulasa server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
