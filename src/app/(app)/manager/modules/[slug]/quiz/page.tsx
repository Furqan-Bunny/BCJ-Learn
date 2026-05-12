import { notFound } from "next/navigation";
import { getModule } from "@/lib/db/modules";
import { ManagerQuizView } from "./quiz-view";

export default async function ManagerQuizPage(props: PageProps<"/manager/modules/[slug]/quiz">) {
  const { slug } = await props.params;
  const mod = await getModule(slug);
  if (!mod) return notFound();
  return <ManagerQuizView mod={mod} />;
}
