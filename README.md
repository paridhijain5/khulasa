# Khulasa

**Your right to know is one form away.**

Khulasa is an RTI (Right to Information) companion for ordinary citizens in India. It takes someone from "my scholarship hasn't arrived" to a ready-to-file application, then keeps watching the clock and drafts the appeals if the department stays silent.

Built by **Team Vanta** for **NexHack 3.0: Build What's Next**
Track: **Smart Society and Social Impact**

- **Live demo:** YOUR-VERCEL-LINK
- **Demo video:** YOUR-YOUTUBE-LINK

![Khulasa home screen](screenshots/home.png)

---

## The problem

Most people never file an RTI. They don't know which office to write to, how to word the questions, or what to do when the department doesn't answer. Vague questions get rejected as "opinion", and silence after 30 days leaves people stuck with no next step.

## What Khulasa does

1. **Plain-language intake.** Describe the problem in English or Hindi. Gemini turns it into 3 to 5 specific, answerable RTI questions.
2. **Right-office finder.** Matches the problem to a public department and Public Information Officer (PIO) from a built-in set of 42 generic offices (scholarship, municipal, electricity, ration, police, university). Every line is editable.
3. **Ready-to-file PDF.** Generates a formatted A4 Section 6(1) application with a fee note and signature block.
4. **Silence Clock (signature feature).** Log the filing date and a 30-day countdown starts, shown as a postal-seal clock. A downloadable `.ics` calendar reminder is included. If the deadline passes, Khulasa slams an **OVERDUE** stamp and drafts the **First Appeal (Section 19(1))**, then the **Second Appeal (Section 19(3))** to the Information Commission, with dates filled in.
5. **Time Travel (demo mode).** Fast-forward the clock by 30 or 60 days to see the appeals appear instantly.
6. **Responsiveness Board.** Log an anonymous outcome (replied, rejected, ignored) and see departments ranked by response rate.
7. **Hindi and English** interface.

![Silence Clock](screenshots/clock.png)
![Board](screenshots/board.png)

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | React, TypeScript, Vite, CSS |
| AI | Google Gemini API (structured JSON output) |
| Documents | Client-side PDF generation, `.ics` calendar files |
| Storage | Browser localStorage (no backend) |
| Fonts | Fraunces, IBM Plex Mono, Inter, Tiro Devanagari Hindi |
| Hosting | Vercel |

## Run it locally

**Requirements:** Node.js 18 or newer, and a free Gemini API key from [aistudio.google.com](https://aistudio.google.com).

```bash
git clone https://github.com/paridhijain5/khulasa.git
cd khulasa
npm install
```

Create a file named `.env.local` in the project root:

```
GEMINI_API_KEY=your-key-here
```

Then start the app:

```bash
npm run dev
```

Open the address shown in the terminal (usually http://localhost:3000).

## How to try it (2 minutes)

1. Click **Start an RTI** and type: *"My post-matric scholarship was verified 8 months ago but nothing has arrived."*
2. Review the generated questions and the suggested office.
3. Download the **PDF**.
4. Open **My RTIs**, set a filing date, and press **Time Travel +30D**.
5. See the **OVERDUE** stamp and the auto-drafted **First Appeal**. Press **+60D** for the Second Appeal.
6. Open the **Board** and log an outcome.

## Important notes

- **Khulasa helps you draft. Verify details on the official RTI portal ([rtionline.gov.in](https://rtionline.gov.in)).** It does not give legal advice, and fees, formats and timelines should always be checked against official sources.
- Office entries are **generic department names**, not verified contact details. Always confirm the correct PIO address before filing.
- Board figures are **illustrative sample data**, not real statistics.
- All user data stays in the browser. Nothing is stored on a server.

## Future scope

- Shared, anonymised Responsiveness Board backed by a database, building a public accountability dataset
- Automatic email and SMS reminders
- Verified office directory covering more departments and states
- Support for more Indian languages
- Direct filing through the official portal

## License

MIT
