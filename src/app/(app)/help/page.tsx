import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { docsForRole } from "./docs-config";

export default async function HelpIndexPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const docs = docsForRole(me.role);

  return (
    <>
      <PageHeader
        eyebrow="Help"
        title="Help & documentation"
        description="Guides for using BCJ Learn. Open one to read it, or use Print / Save as PDF to download a copy."
      />

      <div className="grid sm:grid-cols-2 gap-3 max-w-3xl">
        {docs.map((d) => (
          <Link key={d.slug} href={`/help/${d.slug}`}>
            <Card className="card-lift h-full hover:border-primary/40 transition-colors">
              <CardContent className="p-5 flex items-start gap-3 h-full">
                <div className="size-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <BookOpen className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold flex items-center gap-1.5">
                    {d.title} <ArrowRight className="size-3.5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{d.description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
