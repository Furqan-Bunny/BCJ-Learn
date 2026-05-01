import type { ModuleDef, Lesson, LessonContent } from "@/types";

const ownerIds = ["t-nancy", "t-summer", "t-victoria", "t-isabel", "t-mark"];

// ─── Helper to compute total duration ──────────────────────────────────
function totalDurationFor(lessons: Lesson[]): number {
  return lessons.reduce((s, l) => s + l.durationMinutes, 0);
}

// ─── Module 1 — Operations & Leadership ────────────────────────────────
const m1Lessons: Lesson[] = [
  {
    id: "m1-l1",
    moduleSlug: "operations-leadership",
    order: 1,
    title: "Daily Rhythm & Walkthroughs",
    description:
      "How an Account Manager runs the morning, walks the building, and sets the tone for the crew.",
    durationMinutes: 30,
    contents: [
      {
        id: "m1-l1-c1",
        type: "video",
        title: "Walkthrough demo with VP Ops",
        durationMinutes: 8,
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        videoThumbnail: "/thumbs/walkthrough.jpg",
      },
      {
        id: "m1-l1-c2",
        type: "document",
        title: "The Daily Rhythm",
        durationMinutes: 6,
        documentPages: [
          "# The Daily Rhythm\n\nA strong Account Manager arrives 15 minutes before the crew. The first stop is the lobby — what you see there is what the client will see when they arrive. The second stop is the back-of-house storage — supplies and chemicals must be stocked and labelled. The third stop is the staff sign-in. By the time the crew shows up, you should know exactly what the day's priorities are.",
          "## Walkthroughs\n\nA walkthrough is the single most important act of leadership in our line of work. You walk the building like a client would — entry, lobby, restrooms, common areas, executive floor, kitchen. You look not only for what's dirty, but for what's drifting: scuff marks not yet noticed, a soap dispenser running low, ceiling tile out of place. You write it down. You assign it. You verify it.",
          "## Crew Briefings\n\nA briefing is short — three minutes. State the priorities. Acknowledge yesterday's wins. Name one thing the crew is doing well. Name one thing to watch for today. End on a clear ask. Do not lecture. People remember tone before content.",
        ],
        fileName: "M1-L1-DailyRhythm.docx",
        fileSize: "82 KB",
      },
      {
        id: "m1-l1-c3",
        type: "slides",
        title: "Briefings & Walkthrough slides",
        durationMinutes: 10,
        slides: [
          { title: "The 3 things you balance daily", bullets: ["Building cleanliness", "Client satisfaction", "Crew morale"] },
          { title: "The arrival routine", bullets: ["15 min before crew", "Lobby check", "BOH supplies", "Sign-in confirmation"] },
          { title: "The walkthrough", bullets: ["Walk like a client", "Entry → lobby → restrooms → common → exec → kitchen", "Watch for drift, not just dirt"] },
          { title: "Briefings: 3 minutes", bullets: ["Priorities", "Yesterday's win", "Today's risk", "Clear ask"] },
          { title: "Reading the building", bullets: ["First 30 days = learn quirks", "Write them down", "Train the crew"] },
          { title: "Calendar discipline", bullets: ["Fixed walkthrough time", "Weekly client check-in", "Monthly inventory"] },
        ],
        fileName: "M1-L1-Briefings.pptx",
        fileSize: "1.2 MB",
      },
      {
        id: "m1-l1-c4",
        type: "link",
        title: "BCJ field-ops checklist (printable)",
        durationMinutes: 2,
        externalUrl: "https://example.com/bcj-checklist.pdf",
      },
    ],
  },
  {
    id: "m1-l2",
    moduleSlug: "operations-leadership",
    order: 2,
    title: "Quality, Communication & Crisis",
    description:
      "Holding the bar on quality, talking to clients without surprises, and being the calmest person in the room when things go wrong.",
    durationMinutes: 30,
    contents: [
      {
        id: "m1-l2-c1",
        type: "video",
        title: "Crew briefing — what good looks like",
        durationMinutes: 4,
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        videoThumbnail: "/thumbs/briefing.jpg",
      },
      {
        id: "m1-l2-c2",
        type: "document",
        title: "Quality standards & client communication",
        durationMinutes: 8,
        documentPages: [
          "# Quality Standards\n\nClients don't usually grade you on perfection — they grade you on consistency. If the lobby is spotless on Monday and average on Wednesday, that's a problem. Set a baseline you can hit every day, and protect it. The 80/100 you can sustain beats the 95/100 you can't.",
          "# Client Communication\n\nClients want predictability and zero surprises. Send a brief end-of-week note: what was completed, what's coming, anything they should know. Five lines. Keep it factual. Save the colour for in-person.",
          "# Dealing with Complaints\n\nA complaint is a gift. Acknowledge it within an hour, even if you can't act yet. Go see the issue in person if at all possible. Fix it, then send a short note explaining what you did and how you'll prevent it. Never go quiet. Silence is what makes complaints become contracts lost.",
        ],
        fileName: "M1-L2-QualityComms.docx",
        fileSize: "64 KB",
      },
      {
        id: "m1-l2-c3",
        type: "slides",
        title: "Crisis posture & escalation",
        durationMinutes: 10,
        slides: [
          { title: "Consistency > peaks", bullets: ["80/100 daily beats 95/100 weekly"] },
          { title: "Client comms cadence", bullets: ["End-of-week note (5 lines)", "Weekly check-in call", "Monthly report"] },
          { title: "Complaints are gifts", bullets: ["Acknowledge in 1 hour", "See it in person", "Fix it", "Tell them what you did"] },
          { title: "Crisis posture", bullets: ["Be the calmest person", "Acknowledge → plan → act → update → document"] },
          { title: "Escalation path", bullets: ["You first", "Regional next", "VP Ops only when stuck"] },
          { title: "What ends accounts", bullets: ["Surprises", "Silence after complaints", "Inconsistent quality"] },
        ],
        fileName: "M1-L2-CrisisEscalation.pptx",
        fileSize: "980 KB",
      },
    ],
  },
];

// ─── Module 2 — Quality Control & Safety ───────────────────────────────
const m2Lessons: Lesson[] = [
  {
    id: "m2-l1",
    moduleSlug: "quality-control-safety",
    order: 1,
    title: "Inspections & Standards",
    description:
      "How to inspect a building like a regional, score consistently, and trend over four weeks.",
    durationMinutes: 28,
    contents: [
      {
        id: "m2-l1-c1",
        type: "video",
        title: "Inspection walkthrough demo",
        durationMinutes: 6,
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        videoThumbnail: "/thumbs/qc.jpg",
      },
      {
        id: "m2-l1-c2",
        type: "document",
        title: "The 12-area inspection",
        durationMinutes: 10,
        documentPages: [
          "# The Inspection Loop\n\nEvery building gets inspected weekly by you, and once a quarter by Regional. Your inspection covers 12 areas. Score each 1–5. The total tells you trend, not absolute. The trend over four weeks is what matters.",
          "# Restroom Standards\n\nClients judge buildings by restrooms more than by lobbies. The bar: spotless, fully stocked, no smell, no streaks. Inspect twice a day at minimum. Document.",
          "# Floor Care Basics\n\nHigh-traffic floors need touching every day. Mid-traffic every other day. Low-traffic weekly. Buff schedule depends on finish; consult the floor-care chart.",
        ],
        fileName: "M2-L1-Inspections.docx",
        fileSize: "92 KB",
      },
      {
        id: "m2-l1-c3",
        type: "slides",
        title: "Scoring rubric (1–5)",
        durationMinutes: 8,
        slides: [
          { title: "Inspection cadence", bullets: ["Weekly by you", "Quarterly by Regional"] },
          { title: "12 areas covered", bullets: ["Lobby · Restrooms · Common · Exec floor · Kitchen · Outdoor · BOH · Storage · Glass · Floors · Trash zones · Air"] },
          { title: "Restroom bar", bullets: ["Spotless", "Fully stocked", "No smell", "No streaks", "Twice-daily check"] },
          { title: "Floor care frequency", bullets: ["High-traffic = daily", "Mid = every other day", "Low = weekly"] },
        ],
        fileName: "M2-L1-Rubric.pptx",
        fileSize: "1.4 MB",
      },
      {
        id: "m2-l1-c4",
        type: "link",
        title: "OSHA poster — Wet floor signage rules",
        externalUrl: "https://www.osha.gov/walking-working-surfaces",
      },
    ],
  },
  {
    id: "m2-l2",
    moduleSlug: "quality-control-safety",
    order: 2,
    title: "Chemicals, PPE & Incidents",
    description:
      "Safety-first chemical handling, PPE expectations, and how to log every incident within 24 hours.",
    durationMinutes: 32,
    contents: [
      {
        id: "m2-l2-c1",
        type: "video",
        title: "Chemical handling basics",
        durationMinutes: 5,
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        videoThumbnail: "/thumbs/chemicals.jpg",
      },
      {
        id: "m2-l2-c2",
        type: "document",
        title: "OSHA essentials & incident reporting",
        durationMinutes: 12,
        documentPages: [
          "# Chemical Safety\n\nNever mix products. Even 'compatible' ones often aren't. Always read the SDS. Store chemicals in labelled, ventilated cabinets. PPE is non-negotiable when diluting concentrate.",
          "# OSHA Essentials\n\nWet floor signs, slip protocol, lifting technique, ladder use. Every crew member trained quarterly. You document the training and keep a binder. If OSHA asks, you can produce it within 5 minutes.",
          "# Incident Reporting\n\nAny injury, near-miss, or chemical spill must be logged within 24 hours. No exceptions. The report goes to Regional and Safety. This is how we get better, not how we get blamed.",
        ],
        fileName: "M2-L2-Safety.docx",
        fileSize: "108 KB",
      },
      {
        id: "m2-l2-c3",
        type: "slides",
        title: "Quarterly equipment audit",
        durationMinutes: 8,
        slides: [
          { title: "PPE rules", bullets: ["Always required for chemicals", "Issued day 1", "Replaced quarterly or on damage"] },
          { title: "Mixing rules", bullets: ["Never mix without SDS check", "Default = don't mix"] },
          { title: "Incident window", bullets: ["24 hours to log", "Goes to Regional + Safety"] },
          { title: "Equipment audit", bullets: ["All powered tools logged", "Quarterly review", "Replace before failure"] },
        ],
        fileName: "M2-L2-Equipment.pptx",
        fileSize: "780 KB",
      },
    ],
  },
];

// ─── Module 3 — Finance & Payroll ──────────────────────────────────────
const m3Lessons: Lesson[] = [
  {
    id: "m3-l1",
    moduleSlug: "finance-payroll",
    order: 1,
    title: "Reading a P&L",
    description: "Revenue, direct labour, supplies, gross margin — variance to budget by line item.",
    durationMinutes: 25,
    contents: [
      {
        id: "m3-l1-c1",
        type: "video",
        title: "Reading a WinTeam P&L",
        durationMinutes: 9,
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        videoThumbnail: "/thumbs/pl.jpg",
      },
      {
        id: "m3-l1-c2",
        type: "document",
        title: "P&L line by line",
        durationMinutes: 10,
        documentPages: [
          "# Reading a P&L\n\nRevenue at the top, direct labour and supplies in the middle, gross margin at the bottom. Variance to budget by line item is the conversation. Anything over 5% needs an explanation.",
          "# Supplies Budget\n\nYour monthly supplies budget is fixed. Going over means you ordered too aggressively or somebody is wasting product. Both are coachable.",
        ],
        fileName: "M3-L1-PL.docx",
        fileSize: "76 KB",
      },
      {
        id: "m3-l1-c3",
        type: "slides",
        title: "Variance review template",
        durationMinutes: 6,
        slides: [
          { title: "Variance tolerance", bullets: ["5% on budgeted hours", "Anything over needs explanation"] },
          { title: "P&L structure", bullets: ["Revenue", "Direct labour", "Supplies", "Gross margin"] },
          { title: "Supplies discipline", bullets: ["Monthly budget is fixed", "Over = coachable"] },
        ],
        fileName: "M3-L1-Variance.pptx",
        fileSize: "920 KB",
      },
    ],
  },
  {
    id: "m3-l2",
    moduleSlug: "finance-payroll",
    order: 2,
    title: "Overtime, Payroll & Receivables",
    description: "OT discipline, WinTeam exception cycle, and aging receivables before they age you.",
    durationMinutes: 25,
    contents: [
      {
        id: "m3-l2-c1",
        type: "document",
        title: "WinTeam payroll cycle",
        durationMinutes: 10,
        documentPages: [
          "# Overtime Discipline\n\nOT is the silent margin killer. The rule: any OT must be approved in writing the same day. Weekly OT report on Mondays. If you're seeing 3+ weeks of OT in a row, the staffing model is broken — escalate.",
          "# WinTeam Payroll Cycle\n\nClock-ins close Sunday night. Exceptions (missed punches, manager edits) due Monday by noon. Variances over 15% trigger a call from Victoria. Be ready.",
          "# Invoicing & Receivables\n\nClient invoices go out the 1st. If a client is over 30 days, you escalate the same day. Past 60 days, Regional is involved. Receivables age fast — treat them like fresh produce.",
        ],
        fileName: "M3-L2-Payroll.docx",
        fileSize: "94 KB",
      },
      {
        id: "m3-l2-c2",
        type: "slides",
        title: "Receivables aging buckets",
        durationMinutes: 8,
        slides: [
          { title: "OT approval", bullets: ["Same day, in writing", "Weekly OT report on Mondays"] },
          { title: "Payroll deadlines", bullets: ["Sunday night = clock-ins close", "Monday noon = exceptions due"] },
          { title: "Receivables", bullets: ["30 days = escalate", "60 days = Regional involved", "Treat like fresh produce"] },
        ],
        fileName: "M3-L2-Receivables.pptx",
        fileSize: "640 KB",
      },
      {
        id: "m3-l2-c3",
        type: "link",
        title: "WinTeam exceptions cheat sheet",
        externalUrl: "https://example.com/winteam-exceptions",
      },
    ],
  },
];

// ─── Module 4 — HR & Culture ───────────────────────────────────────────
const m4Lessons: Lesson[] = [
  {
    id: "m4-l1",
    moduleSlug: "hr-culture",
    order: 1,
    title: "Hiring & Onboarding",
    description: "Where great hires come from and what their first week should look like.",
    durationMinutes: 30,
    contents: [
      {
        id: "m4-l1-c1",
        type: "video",
        title: "Onboarding day 1 walkthrough",
        durationMinutes: 7,
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        videoThumbnail: "/thumbs/onboarding.jpg",
      },
      {
        id: "m4-l1-c2",
        type: "document",
        title: "Hiring + first-week plan",
        durationMinutes: 10,
        documentPages: [
          "# Hiring\n\nReferrals first. Walk-ins second. Posted listings third. The best hires are people who already know somebody on the crew. Always do a working interview — 4 hours alongside the team. Watch how they handle slow tasks.",
          "# Onboarding First Week\n\nDay 1: tour, paperwork, PPE issued, shadowing. Day 2: same supervisor, hands-on. Day 3: same area, lighter shadow. By end of week 1, the new hire owns one zone.",
        ],
        fileName: "M4-L1-Hiring.docx",
        fileSize: "82 KB",
      },
      {
        id: "m4-l1-c3",
        type: "slides",
        title: "Working interview rubric",
        durationMinutes: 7,
        slides: [
          { title: "Hiring source priority", bullets: ["Referrals", "Walk-ins", "Postings"] },
          { title: "Working interview", bullets: ["4 hours", "Watch slow tasks", "Talk to existing crew"] },
          { title: "Onboarding week", bullets: ["Day 1: tour + paperwork + PPE", "Day 2: hands-on", "Day 3: lighter shadow", "End of week 1: owns one zone"] },
        ],
        fileName: "M4-L1-WorkingInterview.pptx",
        fileSize: "740 KB",
      },
    ],
  },
  {
    id: "m4-l2",
    moduleSlug: "hr-culture",
    order: 2,
    title: "1:1s, Recognition & Hard Conversations",
    description: "Monthly check-ins, public praise, and how to address performance without drama.",
    durationMinutes: 30,
    contents: [
      {
        id: "m4-l2-c1",
        type: "video",
        title: "Recognition habits",
        durationMinutes: 4,
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        videoThumbnail: "/thumbs/recognition.jpg",
      },
      {
        id: "m4-l2-c2",
        type: "document",
        title: "Performance conversations",
        durationMinutes: 12,
        documentPages: [
          "# Performance Conversations\n\nMonthly 1:1s with every direct report. Structured: what's working, what's stuck, what's next. Take notes. End with a clear ask.",
          "# Recognition\n\nRecognize publicly. Correct privately. The cheapest tool you have is a sincere thank-you within 24 hours of the act.",
          "# Difficult Conversations\n\nWhen a crew member's performance slips, the longer you wait the worse it gets. Address it the same week. Be specific: 'The west wing wasn't fully buffed Tuesday' is actionable. 'You're not pulling your weight' is not. Always offer a path forward.",
        ],
        fileName: "M4-L2-Performance.docx",
        fileSize: "98 KB",
      },
      {
        id: "m4-l2-c3",
        type: "slides",
        title: "1:1 template",
        durationMinutes: 8,
        slides: [
          { title: "1:1 cadence", bullets: ["Monthly with every direct report"] },
          { title: "1:1 structure", bullets: ["What's working", "What's stuck", "What's next", "Clear ask"] },
          { title: "Recognition rule", bullets: ["Publicly", "Within 24 hours", "Sincere"] },
          { title: "Hard conversation rule", bullets: ["Same week", "Specific", "Always offer a path forward"] },
        ],
        fileName: "M4-L2-OneOnOne.pptx",
        fileSize: "560 KB",
      },
    ],
  },
];

// ─── Module 5 — Business Development ───────────────────────────────────
const m5Lessons: Lesson[] = [
  {
    id: "m5-l1",
    moduleSlug: "business-development",
    order: 1,
    title: "Account Growth",
    description: "Asking the expansion question and turning a clean account into more clean accounts.",
    durationMinutes: 28,
    contents: [
      {
        id: "m5-l1-c1",
        type: "video",
        title: "Asking the expansion question",
        durationMinutes: 5,
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        videoThumbnail: "/thumbs/expand.jpg",
      },
      {
        id: "m5-l1-c2",
        type: "document",
        title: "Account growth playbook",
        durationMinutes: 12,
        documentPages: [
          "# Account Growth\n\nThe simplest growth: ask. Once a quarter, in person, ask the client what's not working that BCJ might help with. Carpet care. Window cleaning. Day porters. Kitchen-line cleaning. Most expansions start with a 30-second answer to that question.",
        ],
        fileName: "M5-L1-Growth.docx",
        fileSize: "62 KB",
      },
      {
        id: "m5-l1-c3",
        type: "slides",
        title: "Quarterly expansion script",
        durationMinutes: 6,
        slides: [
          { title: "The expansion question", bullets: ["What's not working that BCJ might help with?", "Carpet · Windows · Day porters · Kitchen lines"] },
          { title: "Cadence", bullets: ["Once a quarter", "In person if possible", "After a strong inspection week"] },
        ],
        fileName: "M5-L1-Script.pptx",
        fileSize: "480 KB",
      },
    ],
  },
  {
    id: "m5-l2",
    moduleSlug: "business-development",
    order: 2,
    title: "Pricing & Renewals",
    description: "Holding price, framing renewals, and turning crews into ambassadors.",
    durationMinutes: 27,
    contents: [
      {
        id: "m5-l2-c1",
        type: "video",
        title: "Handling price pushback",
        durationMinutes: 6,
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        videoThumbnail: "/thumbs/price.jpg",
      },
      {
        id: "m5-l2-c2",
        type: "document",
        title: "Renewal math + frames",
        durationMinutes: 10,
        documentPages: [
          "# Pricing Conversations\n\nNever apologise for price. State the value. If a client pushes back, ask which line item they want to drop, not how to discount the whole.",
          "# Renewal Math\n\nA renewal at flat price is a 3% loss after inflation. Build a 3–5% increase into the renewal conversation every year. Frame it: 'Here's what we did this year, here's what we're investing next year.'",
        ],
        fileName: "M5-L2-Renewals.docx",
        fileSize: "58 KB",
      },
      {
        id: "m5-l2-c3",
        type: "slides",
        title: "Renewal pitch deck",
        durationMinutes: 8,
        slides: [
          { title: "Pricing rule", bullets: ["Never apologise for price", "State the value"] },
          { title: "Renewal math", bullets: ["Flat price = 3% real loss", "Target 3–5% increase yearly"] },
          { title: "Framing", bullets: ["What we did this year", "What we're investing next year"] },
        ],
        fileName: "M5-L2-Renewal.pptx",
        fileSize: "910 KB",
      },
    ],
  },
];

// ─── Final modules array ──────────────────────────────────────────────
export const modules: ModuleDef[] = [
  {
    slug: "operations-leadership",
    number: 1,
    title: "Operations & Leadership",
    description:
      "How a BCJ Account Manager runs a clean, on-time, profitable account week-over-week.",
    scheduledMonth: "June 2026",
    scheduledDate: "2026-06-12",
    ownerTeacherIds: [ownerIds[0]],
    status: "published",
    passThreshold: 0.85,
    questionCount: 25,
    timeLimitMinutes: 30,
    questionsApproved: 80,
    questionsTotal: 80,
    lessons: m1Lessons,
    flashcards: [
      { front: "Variance tolerance on budgeted hours", back: "5%" },
      { front: "Pass threshold on this quiz", back: "85%" },
      { front: "How early should you arrive before the crew?", back: "15 minutes" },
      { front: "Briefing length", back: "3 minutes" },
      { front: "Acknowledge a complaint within…", back: "1 hour" },
      { front: "First 30 days at a new account", back: "Learn the building's quirks" },
      { front: "Three things you balance daily", back: "Cleanliness · Satisfaction · Morale" },
      { front: "What ends accounts", back: "Surprises and silence" },
    ],
  },
  {
    slug: "quality-control-safety",
    number: 2,
    title: "Quality Control & Safety",
    description:
      "Inspection routines, OSHA basics, chemical handling, and how to keep a building (and a crew) safe.",
    scheduledMonth: "July 2026",
    scheduledDate: "2026-07-10",
    ownerTeacherIds: [ownerIds[1], ownerIds[3]],
    status: "published",
    passThreshold: 0.85,
    questionCount: 25,
    timeLimitMinutes: 30,
    questionsApproved: 76,
    questionsTotal: 80,
    lessons: m2Lessons,
    flashcards: [
      { front: "Inspection cadence", back: "Weekly by you, quarterly by Regional" },
      { front: "Areas covered per inspection", back: "12" },
      { front: "PPE for diluting concentrate", back: "Always required" },
      { front: "Incident reporting window", back: "24 hours" },
      { front: "Restroom inspection cadence", back: "Twice daily minimum" },
    ],
  },
  {
    slug: "finance-payroll",
    number: 3,
    title: "Finance & Payroll",
    description:
      "Reading a P&L for your account, controlling overtime, and handling the WinTeam payroll exceptions.",
    scheduledMonth: "August 2026",
    scheduledDate: "2026-08-14",
    ownerTeacherIds: [ownerIds[2]],
    status: "published",
    passThreshold: 0.85,
    questionCount: 25,
    timeLimitMinutes: 30,
    questionsApproved: 64,
    questionsTotal: 80,
    lessons: m3Lessons,
    flashcards: [
      { front: "Variance tolerance on budgeted hours", back: "5%" },
      { front: "When OT must be approved", back: "Same day, in writing" },
      { front: "WinTeam exception deadline", back: "Monday by noon" },
      { front: "Receivable escalation point", back: "30 days past due" },
    ],
  },
  {
    slug: "hr-culture",
    number: 4,
    title: "HR & Culture",
    description:
      "Hiring, onboarding, performance conversations, and the BCJ values that hold the team together.",
    scheduledMonth: "September 2026",
    scheduledDate: "2026-09-11",
    ownerTeacherIds: [ownerIds[3]],
    status: "draft",
    passThreshold: 0.85,
    questionCount: 25,
    timeLimitMinutes: 30,
    questionsApproved: 24,
    questionsTotal: 80,
    lessons: m4Lessons,
    flashcards: [
      { front: "Hiring source priority", back: "Referrals > Walk-ins > Postings" },
      { front: "Working interview length", back: "4 hours" },
      { front: "1:1 cadence", back: "Monthly with every direct report" },
    ],
  },
  {
    slug: "business-development",
    number: 5,
    title: "Business Development",
    description:
      "Growing the account: scope expansion, pricing conversations, and turning crews into ambassadors.",
    scheduledMonth: "October 2026",
    scheduledDate: "2026-10-09",
    ownerTeacherIds: [ownerIds[4]],
    status: "draft",
    passThreshold: 0.85,
    questionCount: 25,
    timeLimitMinutes: 30,
    questionsApproved: 0,
    questionsTotal: 80,
    lessons: m5Lessons,
    flashcards: [
      { front: "Quarterly expansion question", back: "What's not working that BCJ might help with?" },
      { front: "Renewal target increase", back: "3–5%" },
      { front: "Flat-price renewal = ", back: "Roughly a 3% real loss" },
    ],
  },
];

export const moduleBySlug = (slug: string) => modules.find((m) => m.slug === slug);

// Helper used by UI for "60 minutes total"
export function moduleTotalMinutes(slug: string): number {
  const m = moduleBySlug(slug);
  return m ? totalDurationFor(m.lessons) : 0;
}

export function moduleContentCounts(slug: string): {
  videos: number;
  documents: number;
  slides: number;
  links: number;
  totalItems: number;
} {
  const m = moduleBySlug(slug);
  if (!m) return { videos: 0, documents: 0, slides: 0, links: 0, totalItems: 0 };
  let videos = 0, documents = 0, slides = 0, links = 0;
  for (const l of m.lessons) {
    for (const c of l.contents) {
      if (c.type === "video") videos++;
      else if (c.type === "document") documents++;
      else if (c.type === "slides") slides++;
      else if (c.type === "link") links++;
    }
  }
  return { videos, documents, slides, links, totalItems: videos + documents + slides + links };
}
