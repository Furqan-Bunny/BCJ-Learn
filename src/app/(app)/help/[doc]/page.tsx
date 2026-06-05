import { notFound, redirect } from "next/navigation";
import { promises as fs } from "fs";
import path from "path";
import { marked } from "marked";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { getHelpDoc } from "../docs-config";
import { HelpDocView } from "./help-doc-view";

export default async function HelpDocPage(props: { params: Promise<{ doc: string }> }) {
  const { doc } = await props.params;
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const meta = getHelpDoc(doc);
  if (!meta || !meta.roles.includes(me.role)) return notFound();

  // Markdown source lives in /docs (single source, also exported to PDF).
  let markdown: string;
  try {
    markdown = await fs.readFile(path.join(process.cwd(), "docs", `${doc}.md`), "utf8");
  } catch {
    return notFound();
  }
  const html = await marked.parse(markdown);

  return <HelpDocView title={meta.title} html={html} />;
}
