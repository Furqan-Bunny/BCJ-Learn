import { getAccessibleModuleOr404 } from "@/lib/auth/module-access";
import { TeacherContentView } from "./content-view";

export default async function TeacherContentPage(props: PageProps<"/teacher/modules/[slug]/content">) {
  const { slug } = await props.params;
  const mod = await getAccessibleModuleOr404(slug);
  return <TeacherContentView mod={mod} />;
}
