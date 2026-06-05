import { getAccessibleModuleOr404 } from "@/lib/auth/module-access";
import { listQuestionsForModule } from "@/lib/db/questions";
import { TeacherQuestionsView } from "./questions-view";

export default async function TeacherQuestionsPage(props: PageProps<"/teacher/modules/[slug]/questions">) {
  const { slug } = await props.params;
  const mod = await getAccessibleModuleOr404(slug);
  const questions = await listQuestionsForModule(slug);

  return <TeacherQuestionsView mod={mod} initialQuestions={questions} />;
}
