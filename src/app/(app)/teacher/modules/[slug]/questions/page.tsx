import { notFound } from "next/navigation";
import { getModule } from "@/lib/db/modules";
import { listQuestionsForModule } from "@/lib/db/questions";
import { TeacherQuestionsView } from "./questions-view";

export default async function TeacherQuestionsPage(props: PageProps<"/teacher/modules/[slug]/questions">) {
  const { slug } = await props.params;
  const [mod, questions] = await Promise.all([
    getModule(slug),
    listQuestionsForModule(slug),
  ]);
  if (!mod) return notFound();

  return <TeacherQuestionsView mod={mod} initialQuestions={questions} />;
}
