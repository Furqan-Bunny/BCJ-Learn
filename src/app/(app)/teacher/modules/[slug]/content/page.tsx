import { notFound } from "next/navigation";
import { getModule } from "@/lib/db/modules";
import { TeacherContentView } from "./content-view";

export default async function TeacherContentPage(props: PageProps<"/teacher/modules/[slug]/content">) {
  const { slug } = await props.params;
  const mod = await getModule(slug);
  if (!mod) return notFound();
  return <TeacherContentView mod={mod} />;
}
