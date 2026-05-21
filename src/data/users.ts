import { faker } from "@faker-js/faker";
import type { Admin, Cohort, Manager, ManagerStatus, Teacher } from "@/types";

faker.seed(20260501);

const COHORTS: Cohort[] = ["Atlanta", "Dallas", "Phoenix"];

function avatarColor(seed: string): string {
  const palette = [
    "#041D39", "#3B5F86", "#557AAA", "#2A8C82", "#8C5A2A",
    "#7A3F8C", "#3F8C5A", "#8C3F3F", "#5A8C3F", "#3F5A8C",
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

// ─── Admins ────────────────────────────────────────────
export const admins: Admin[] = [
  {
    id: "a-nancy",
    name: "Nancy Park",
    email: "nancy@bcj.com",
    avatarColor: avatarColor("Nancy Park"),
    role: "admin",
    title: "Director of Operations",
    joinedAt: "2024-03-01",
    lastActiveAt: faker.date.recent({ days: 1 }).toISOString(),
  },
  {
    id: "a-isabel",
    name: "Isabel Reyes",
    email: "isabel@bcj.com",
    avatarColor: avatarColor("Isabel Reyes"),
    role: "admin",
    title: "VP Operations",
    joinedAt: "2022-08-15",
    lastActiveAt: faker.date.recent({ days: 2 }).toISOString(),
  },
  {
    id: "a-majed",
    name: "Majed Hassan",
    email: "majed@bcj.com",
    avatarColor: avatarColor("Majed Hassan"),
    role: "admin",
    title: "Founder & CEO",
    joinedAt: "2018-01-01",
    lastActiveAt: faker.date.recent({ days: 5 }).toISOString(),
  },
];

// ─── Teachers ──────────────────────────────────────────
export const teachers: Teacher[] = [
  {
    id: "t-nancy",
    name: "Nancy Park",
    email: "nancy@bcj.com",
    avatarColor: avatarColor("Nancy Park"),
    role: "teacher",
    ownedModuleSlugs: ["operations-leadership"],
    bio: "20 years in operations, owner of Module 1.",
    joinedAt: "2024-03-01",
    lastActiveAt: faker.date.recent({ days: 1 }).toISOString(),
  },
  {
    id: "t-summer",
    name: "Summer Reid",
    email: "summer@bcj.com",
    avatarColor: avatarColor("Summer Reid"),
    role: "teacher",
    ownedModuleSlugs: ["quality-control-safety"],
    bio: "QC & safety specialist, owns Module 2.",
    joinedAt: "2024-06-12",
    lastActiveAt: faker.date.recent({ days: 1 }).toISOString(),
  },
  {
    id: "t-victoria",
    name: "Victoria Liu",
    email: "victoria@bcj.com",
    avatarColor: avatarColor("Victoria Liu"),
    role: "teacher",
    ownedModuleSlugs: ["finance-payroll"],
    bio: "Senior accountant, runs Module 3.",
    joinedAt: "2023-04-04",
    lastActiveAt: faker.date.recent({ days: 2 }).toISOString(),
  },
  {
    id: "t-isabel",
    name: "Isabel Reyes",
    email: "isabel@bcj.com",
    avatarColor: avatarColor("Isabel Reyes"),
    role: "teacher",
    ownedModuleSlugs: ["hr-culture", "quality-control-safety"],
    bio: "VP Operations, also leads Module 4.",
    joinedAt: "2022-08-15",
    lastActiveAt: faker.date.recent({ days: 3 }).toISOString(),
  },
  {
    id: "t-mark",
    name: "Mark Donaldson",
    email: "mark@bcj.com",
    avatarColor: avatarColor("Mark Donaldson"),
    role: "teacher",
    ownedModuleSlugs: ["business-development"],
    bio: "BD lead, owns Module 5.",
    joinedAt: "2023-09-20",
    lastActiveAt: faker.date.recent({ days: 2 }).toISOString(),
  },
];

// ─── Managers (60 generated) ──────────────────────────
const STATUSES: { value: ManagerStatus; weight: number }[] = [
  { value: "active", weight: 70 },
  { value: "at-risk", weight: 12 },
  { value: "completed", weight: 12 },
  { value: "inactive", weight: 6 },
];

function pickWeighted<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((a, b) => a + b.weight, 0);
  let n = faker.number.int({ min: 1, max: total });
  for (const item of items) {
    n -= item.weight;
    if (n <= 0) return item;
  }
  return items[0];
}

const FLAG_REASONS = [
  "Failed twice on Module 1",
  "Missed Module 2 deadline",
  "Hasn't logged in for 14 days",
  "Below 70% on first attempt",
  "No quiz attempt yet",
];

export const managers: Manager[] = Array.from({ length: 60 }, (_, i) => {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const name = `${firstName} ${lastName}`;
  const email = faker.internet.email({ firstName, lastName, provider: "bcj.com" }).toLowerCase();
  const cohort = faker.helpers.arrayElement(COHORTS);
  const status = pickWeighted(STATUSES).value;

  let modulesCompleted = 0;
  let averageScore = 0;
  let failedAttempts = 0;
  const flaggedReasons: string[] = [];

  if (status === "completed") {
    modulesCompleted = 5;
    averageScore = faker.number.int({ min: 86, max: 99 });
  } else if (status === "active") {
    modulesCompleted = faker.number.int({ min: 0, max: 3 });
    averageScore = faker.number.int({ min: 78, max: 96 });
  } else if (status === "at-risk") {
    modulesCompleted = faker.number.int({ min: 0, max: 2 });
    averageScore = faker.number.int({ min: 55, max: 80 });
    failedAttempts = faker.number.int({ min: 1, max: 3 });
    flaggedReasons.push(faker.helpers.arrayElement(FLAG_REASONS));
    if (faker.datatype.boolean(0.4)) flaggedReasons.push(faker.helpers.arrayElement(FLAG_REASONS));
  } else {
    modulesCompleted = 0;
    averageScore = 0;
  }

  return {
    id: `m-${i + 1}`,
    name,
    email,
    avatarColor: avatarColor(name),
    role: "manager",
    cohort,
    status,
    modulesCompleted,
    averageScore,
    failedAttempts,
    flaggedReasons: [...new Set(flaggedReasons)],
    joinedAt: faker.date.between({ from: "2024-01-01", to: "2026-04-01" }).toISOString(),
    lastActiveAt: faker.date.recent({ days: status === "inactive" ? 30 : 14 }).toISOString(),
  };
});

export const allUsers = [...admins, ...teachers, ...managers];
export const userById = (id: string) => allUsers.find((u) => u.id === id);
