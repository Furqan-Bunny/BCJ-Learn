// Registry of the help documents (Markdown source in /docs) and which roles
// see each one. Single source for the Help Center index + the [doc] page.

import type { Role } from "@/types";

export interface HelpDoc {
  /** URL slug + the /docs/<file>.md basename. */
  slug: string;
  title: string;
  description: string;
  /** Roles that can open this doc. */
  roles: Role[];
}

const ALL: Role[] = ["admin", "teacher", "manager"];

export const HELP_DOCS: HelpDoc[] = [
  {
    slug: "platform-overview",
    title: "Platform Overview",
    description: "What BCJ Learn is, the roles, and how a module goes from build to a passed quiz and certificate.",
    roles: ALL,
  },
  {
    slug: "admin-guide",
    title: "Admin Guide",
    description: "Complete reference for administrators — every page, setting, and workflow.",
    roles: ["admin"],
  },
  {
    slug: "dept-lead-guide",
    title: "Department Lead Guide",
    description: "Build and present your modules, review questions, and read results.",
    roles: ["admin", "teacher"],
  },
  {
    slug: "employee-guide",
    title: "Employee Guide",
    description: "Sign in, learn, take your quiz, and earn your certificate.",
    roles: ["admin", "manager"],
  },
  {
    slug: "faq",
    title: "FAQ",
    description: "Quick answers to common questions, grouped by role.",
    roles: ALL,
  },
];

export function docsForRole(role: Role): HelpDoc[] {
  return HELP_DOCS.filter((d) => d.roles.includes(role));
}

export function getHelpDoc(slug: string): HelpDoc | undefined {
  return HELP_DOCS.find((d) => d.slug === slug);
}
