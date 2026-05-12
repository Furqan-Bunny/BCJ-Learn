import { redirect } from "next/navigation";
import { getCurrentUserForRole } from "@/lib/supabase/current-user";
import { listModules } from "@/lib/db/modules";
import { listQuestionsForModule } from "@/lib/db/questions";
import { dbClient } from "@/lib/supabase/db-client";
import { TeacherQuestionLibraryView } from "./questions-view";

export default async function TeacherQuestionLibraryPage() {
  const me = await getCurrentUserForRole("teacher");
  if (!me) redirect("/login");

  const sb = await dbClient();
  const { data: ownerRows } = await sb
    .from("module_owners")
    .select("module_slug")
    .eq("teacher_id", me.id);
  const ownedSlugs = ((ownerRows ?? []) as { module_slug: string }[]).map((r) => r.module_slug);

  const [allModules, ...questionsLists] = await Promise.all([
    listModules(),
    ...ownedSlugs.map((s) => listQuestionsForModule(s)),
  ]);

  const myModules = allModules.filter((m) => ownedSlugs.includes(m.slug));
  const myQuestions = questionsLists.flat();

  return <TeacherQuestionLibraryView myModules={myModules} myQuestions={myQuestions} />;
}
