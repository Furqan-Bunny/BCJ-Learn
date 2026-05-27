import { listQuestionsLite } from "@/lib/db/questions";
import { listModules } from "@/lib/db/modules";
import { listTeachers } from "@/lib/db/profiles";
import { AdminQuestionLibraryView } from "./questions-view";

export default async function AdminQuestionsPage() {
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
