import Link from "next/link";
import { Sparkles, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="size-16 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-6">
          <Sparkles className="size-7" />
        </div>
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">404</div>
        <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
        <p className="text-muted-foreground mt-2">
          The page you&rsquo;re looking for doesn&rsquo;t exist (yet) or has moved.
        </p>
        <Button asChild className="mt-6">
          <Link href="/admin/dashboard"><ArrowLeft className="mr-1 size-4" /> Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
