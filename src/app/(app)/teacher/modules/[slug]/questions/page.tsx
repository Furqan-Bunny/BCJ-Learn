import { getOwnedModuleOr404 } from "@/lib/auth/module-access";
import { listQuestionsForModule } from "@/lib/db/questions";
import { TeacherQuestionsView } from "./questions-view";

export default async function TeacherQuestionsPage(props: PageProps<"/teacher/modules/[slug]/questions">) {
  const { slug } = await props.params;
  // Question authoring is owner-only (admins pass). Non-owning leads get a 404
  // instead of an editor whose mutations are all rejected server-side.
  const mod = await getOwnedModuleOr404(slug);
  const questions = await listQuestionsForModule(slug);

  return <TeacherQuestionsView mod={mod} initialQuestions={questions} />;
}
