import { notFound } from "next/navigation";
import { listQuestionsLite } from "@/lib/db/questions";
import { listModules } from "@/lib/db/modules";
import { listTeachers } from "@/lib/db/profiles";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { AdminQuestionLibraryView } from "./questions-view";

export default async function AdminQuestionsPage() {
  // Admin-only: the cross-module question library exposes every module's answer
  // key. (The section layout only blocks managers; leads must not reach this.)
  const me = await getCurrentUser();
  if (!me || me.role !== "admin") notFound();

  const [questions, modules, teachers] = await Promise.all([
    listQuestionsLite(),
    listModules(),
    listTeachers(),
  ]);

  const teacherNamesById: Record<string, string> = {};
  for (const t of teachers) teacherNamesById[t.id] = t.name;

  return (
    <AdminQuestionLibraryView
      questions={questions}
      modules={modules}
      teacherNamesById={teacherNamesById}
    />
  );
}
