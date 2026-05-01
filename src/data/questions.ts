import { faker } from "@faker-js/faker";
import type { Question, QuestionPool } from "@/types";
import { modules } from "./modules";

faker.seed(20260502);

const SAMPLE_QUESTIONS: Record<string, Array<{ q: string; opts: string[]; correct: number; expl: string }>> = {
  "operations-leadership": [
    { q: "How early should an Account Manager arrive before the crew?", opts: ["5 minutes", "15 minutes", "30 minutes", "Just on time"], correct: 1, expl: "Arriving 15 minutes early lets you walk the lobby and BOH before sign-in." },
    { q: "What is the recommended length of a daily crew briefing?", opts: ["1 minute", "3 minutes", "10 minutes", "15 minutes"], correct: 1, expl: "Three minutes — priorities, yesterday's win, today's risk, clear ask." },
    { q: "What's the right window to acknowledge a client complaint?", opts: ["Within 1 hour", "By end of day", "Within 24 hours", "Within a week"], correct: 0, expl: "Acknowledge within 1 hour, even if you cannot act yet." },
    { q: "Which is the better quality posture for an account?", opts: ["95/100 weekly", "80/100 daily and consistent", "Spotless on inspection day", "Whatever the client asks for that week"], correct: 1, expl: "Consistency beats peaks; clients judge on predictability." },
    { q: "What should an end-of-week client note look like?", opts: ["A single emoji", "Five lines, factual", "A two-page report", "Whatever you wrote last week, copied"], correct: 1, expl: "Five factual lines: completed, coming, anything to know." },
    { q: "When OT begins to appear three weeks in a row, you should…", opts: ["Approve it and move on", "Ignore it; it'll normalise", "Escalate — staffing model is broken", "Cut crew hours arbitrarily"], correct: 2, expl: "Pattern OT signals a structural staffing issue — escalate." },
    { q: "Which of these is an actionable feedback statement?", opts: ["You're not pulling your weight", "I'm disappointed in you", "The west wing wasn't fully buffed Tuesday", "You always miss things"], correct: 2, expl: "Specific and observable beats personal." },
    { q: "First 30 days at a new account, your priority is to…", opts: ["Cut headcount", "Rebid the contract", "Learn the building's quirks", "Replace the equipment"], correct: 2, expl: "Learn the building first; improvements come later." },
    { q: "Variance tolerance on budgeted hours at BCJ is…", opts: ["1%", "5%", "10%", "Whatever the client asks"], correct: 1, expl: "5% — anything beyond requires explanation." },
    { q: "The pass threshold for this quiz is…", opts: ["70%", "75%", "85%", "100%"], correct: 2, expl: "85% across all modules." },
    { q: "Your fixed-time commitments (walkthroughs, check-ins) should be…", opts: ["Whatever's easiest", "Different each week", "Predictable, on the same schedule", "Skipped when you're busy"], correct: 2, expl: "Predictability is a leadership signal." },
    { q: "What makes complaints become contracts lost?", opts: ["Apologising too much", "Going silent after them", "Replying too quickly", "Documenting them"], correct: 1, expl: "Silence is what kills accounts — never go quiet." },
    { q: "How should consumables (paper towels, soap) be managed?", opts: ["Reorder when you run out", "Set par levels and count weekly", "Order monthly regardless of stock", "Wait for client to complain"], correct: 1, expl: "Par levels + weekly count + 1-week buffer." },
    { q: "Which is the right escalation path?", opts: ["You → Regional → VP Ops", "Straight to VP Ops", "Email everyone at once", "Tell the client first"], correct: 0, expl: "Try yourself, then Regional, VP Ops only when stuck." },
    { q: "What do clients usually grade you on?", opts: ["Perfection", "Cost", "Consistency", "Loud presence"], correct: 2, expl: "Consistency. Same standard every visit." },
  ],
  "quality-control-safety": [
    { q: "How many areas does a standard inspection cover?", opts: ["6", "8", "12", "20"], correct: 2, expl: "Twelve areas, each scored 1–5." },
    { q: "Inspection cadence at the Account Manager level is…", opts: ["Daily", "Weekly", "Monthly", "Quarterly"], correct: 1, expl: "Weekly by you; quarterly by Regional." },
    { q: "When can you mix two cleaning chemicals?", opts: ["If they're 'compatible'", "If the bottles are similar", "Never without checking SDS", "On odd-numbered weeks"], correct: 2, expl: "Always read the SDS first; default rule is don't mix." },
    { q: "Incident reports must be filed within…", opts: ["1 hour", "24 hours", "1 week", "End of month"], correct: 1, expl: "24 hours — every injury, near-miss, or spill." },
    { q: "Restroom inspection should happen at minimum…", opts: ["Once a week", "Once a day", "Twice a day", "When clients complain"], correct: 2, expl: "Twice daily — restrooms are how clients judge buildings." },
    { q: "PPE is required when…", opts: ["Only on inspection days", "Diluting concentrate or handling chemicals", "Just when supervisors are watching", "Never if you're experienced"], correct: 1, expl: "Always non-negotiable around chemicals." },
    { q: "A wet floor sign should be deployed during…", opts: ["Any wet-cleaning operation", "Only if a client is nearby", "Only on Mondays", "Never — they're tripping hazards"], correct: 0, expl: "Always — it's a base safety standard." },
    { q: "Quarterly equipment audit covers…", opts: ["Only vacuums", "All powered tools", "Just chemicals", "Just PPE"], correct: 1, expl: "All powered tools logged and audited quarterly." },
  ],
  "finance-payroll": [
    { q: "Variance tolerance on budgeted hours is…", opts: ["3%", "5%", "10%", "15%"], correct: 1, expl: "5% — anything more requires explanation." },
    { q: "Overtime must be approved…", opts: ["Same day, in writing", "End of week", "Only by Regional", "Never required"], correct: 0, expl: "Same-day, written approval — every time." },
    { q: "WinTeam payroll exceptions are due…", opts: ["Friday EOD", "Monday by noon", "Whenever you remember", "Last day of the month"], correct: 1, expl: "Monday noon — clock-ins close Sunday night." },
    { q: "When a client invoice ages past 30 days you…", opts: ["Wait two more weeks", "Escalate the same day", "Email politely once a month", "Drop the invoice"], correct: 1, expl: "Escalate same day — receivables age fast." },
    { q: "A flat-price renewal in real terms is roughly a…", opts: ["1% gain", "Break-even", "3% real loss", "5% gain"], correct: 2, expl: "Inflation makes flat = a real loss." },
    { q: "Your monthly supplies budget is…", opts: ["A guideline", "Fixed; going over is coachable", "Whatever vendor sells you", "Negotiable each month"], correct: 1, expl: "Fixed budget; overruns are coachable." },
  ],
  "hr-culture": [
    { q: "Hiring source priority at BCJ is…", opts: ["Postings → Walk-ins → Referrals", "Referrals → Walk-ins → Postings", "Whatever's cheapest", "Random"], correct: 1, expl: "Referrals first — best long-term fit." },
    { q: "A working interview should last about…", opts: ["30 minutes", "1 hour", "4 hours", "A full week"], correct: 2, expl: "Four hours alongside the team — slow tasks reveal fit." },
    { q: "1:1 cadence with direct reports is…", opts: ["Annual", "Quarterly", "Monthly", "Weekly"], correct: 2, expl: "Monthly — structured: working / stuck / next." },
    { q: "Recognition should be…", opts: ["Public; corrections private", "Both public", "Both private", "Saved for the holiday party"], correct: 0, expl: "Public recognition, private correction." },
    { q: "By end of week 1, a new hire should…", opts: ["Run the account", "Own one zone", "Train others", "Be on probation"], correct: 1, expl: "Own one zone with reduced shadowing." },
  ],
  "business-development": [
    { q: "The simplest growth move quarterly is to…", opts: ["Drop the price", "Ask the client what's not working", "Send a brochure", "Hire an account manager"], correct: 1, expl: "Ask. Most expansions begin with that question." },
    { q: "Renewal target annual increase is…", opts: ["0%", "1–2%", "3–5%", "10%+"], correct: 2, expl: "3–5% covers inflation and signals investment." },
    { q: "When a client pushes back on price you should…", opts: ["Discount the whole", "Ask which line item to drop", "Apologise repeatedly", "Walk away"], correct: 1, expl: "Reframe to scope, not whole-deal discount." },
  ],
};

// Generate retake (easier) variant of a question — same correct answer, simpler wording
function easierVariant(q: { q: string; opts: string[]; correct: number; expl: string }, idx: number) {
  return {
    q: q.q.replace(/\?$/, " (review)?"),
    opts: q.opts,
    correct: q.correct,
    expl: q.expl,
    seed: idx,
  };
}

const STATUSES = ["approved", "approved", "approved", "approved", "pending", "pending", "edited", "rejected"] as const;

export const questions: Question[] = [];

for (const mod of modules) {
  const samples = SAMPLE_QUESTIONS[mod.slug] || [];
  // First-attempt pool: 50 questions per module (samples + filler)
  for (let i = 0; i < 50; i++) {
    const sample = samples[i % Math.max(samples.length, 1)];
    if (!sample) continue;
    questions.push({
      id: `q-${mod.slug}-fa-${i + 1}`,
      moduleSlug: mod.slug,
      pool: "first-attempt" as QuestionPool,
      status: i < mod.questionsApproved * 0.6 ? "approved" : faker.helpers.arrayElement(STATUSES),
      text: i < samples.length ? sample.q : `${sample.q}`,
      options: sample.opts.map((text, oi) => ({
        id: `o-${i}-${oi}`,
        text,
        correct: oi === sample.correct,
      })),
      explanation: sample.expl,
      generatedByAI: true,
      createdAt: faker.date.recent({ days: 30 }).toISOString(),
      approvedAt: i < mod.questionsApproved * 0.6 ? faker.date.recent({ days: 14 }).toISOString() : undefined,
      approvedBy: i < mod.questionsApproved * 0.6 ? mod.ownerTeacherIds[0] : undefined,
      hits: faker.number.int({ min: 0, max: 80 }),
      missRate: faker.number.float({ min: 0.05, max: 0.45, fractionDigits: 2 }),
    });
  }
  // Retake pool: 30 questions per module
  for (let i = 0; i < 30; i++) {
    const sample = samples[i % Math.max(samples.length, 1)];
    if (!sample) continue;
    const easier = easierVariant(sample, i);
    questions.push({
      id: `q-${mod.slug}-rt-${i + 1}`,
      moduleSlug: mod.slug,
      pool: "retake" as QuestionPool,
      status: i < mod.questionsApproved * 0.4 ? "approved" : faker.helpers.arrayElement(STATUSES),
      text: easier.q,
      options: easier.opts.map((text, oi) => ({
        id: `o-rt-${i}-${oi}`,
        text,
        correct: oi === easier.correct,
      })),
      explanation: easier.expl,
      generatedByAI: true,
      createdAt: faker.date.recent({ days: 30 }).toISOString(),
      approvedAt: i < mod.questionsApproved * 0.4 ? faker.date.recent({ days: 14 }).toISOString() : undefined,
      approvedBy: i < mod.questionsApproved * 0.4 ? mod.ownerTeacherIds[0] : undefined,
      hits: faker.number.int({ min: 0, max: 30 }),
      missRate: faker.number.float({ min: 0.02, max: 0.3, fractionDigits: 2 }),
    });
  }
}

export const questionsForModule = (slug: string, pool?: QuestionPool) =>
  questions.filter((q) => q.moduleSlug === slug && (!pool || q.pool === pool));
