import { notFound } from "next/navigation";
import { getModule } from "@/lib/db/modules";
import { PresenterView } from "./present-view";

export default async function PresenterPage(props: PageProps<"/teacher/modules/[slug]/present">) {
  const { slug } = await props.params;
  const mod = await getModule(slug);
  if (!mod) return notFound();

  return <PresenterView mod={mod} />;
}
