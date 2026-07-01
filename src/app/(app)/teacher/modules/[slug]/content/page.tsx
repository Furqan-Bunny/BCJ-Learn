import { getOwnedModuleOr404 } from "@/lib/auth/module-access";
import { TeacherContentView } from "./content-view";

export default async function TeacherContentPage(props: PageProps<"/teacher/modules/[slug]/content">) {
  const { slug } = await props.params;
  // Editing content is owner-only (admins pass). Non-owning leads get a 404
  // rather than a read-only editor whose Save would be rejected server-side.
  const mod = await getOwnedModuleOr404(slug);
  return <TeacherContentView mod={mod} />;
}
