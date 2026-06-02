"use client";

// Invite-a-teacher or invite-an-admin sheet. Mirrors AddManagerSheet but
// without cohort — neither role has one. Reused by /admin/teachers and
// /admin/admins.

import * as React from "react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Mail, User, ShieldCheck, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { inviteUser } from "@/lib/server/admin-actions";
import { useRouter } from "next/navigation";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

interface AddStaffSheetProps {
  role: "teacher" | "admin";
  triggerLabel?: string;
}

const COPY: Record<
  AddStaffSheetProps["role"],
  { eyebrow: string; title: string; description: string; nameHint: string; defaultLabel: string; icon: React.ComponentType<{ className?: string }> }
> = {
  teacher: {
    eyebrow: "New Department Lead",
    title: "Invite a Department Lead",
    description:
      "Department Leads own one or more modules — they upload content, generate AI questions, and approve the question bank. After inviting, assign them a module from the module detail page.",
    nameHint: "e.g., Priya Mehta",
    defaultLabel: "Invite Department Lead",
    icon: BookOpen,
  },
  admin: {
    eyebrow: "New Administrator",
    title: "Invite an Administrator",
    description:
      "Administrators see the full back office — managers, teachers, modules, reports, settings, and audit log. Use sparingly.",
    nameHint: "e.g., Sam Chen",
    defaultLabel: "Invite admin",
    icon: ShieldCheck,
  },
};

export function AddStaffSheet({ role, triggerLabel }: AddStaffSheetProps) {
  const router = useRouter();
  const copy = COPY[role];
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const canSubmit = name.trim().length > 0 && /\S+@\S+\.\S+/.test(email.trim());

  function reset() {
    setName("");
    setEmail("");
    setTitle("");
  }

  async function handleSubmit(e?: React.FormEvent | React.MouseEvent) {
    if (e && "preventDefault" in e) e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);

    if (DEMO_MODE) {
      await new Promise((r) => setTimeout(r, 400));
      toast.success(`${name} invited (demo)`, {
        description: "Demo mode — no real invite email sent.",
      });
      setSubmitting(false);
      setOpen(false);
      reset();
      return;
    }

    const result = await inviteUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      title: title.trim() || undefined,
    });
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error ?? "Failed to send invite");
      return;
    }

    toast.success(`${name} invited`, {
      description: `Invitation email sent to ${email}. They have 7 days to set up their account.`,
    });
    setOpen(false);
    reset();
    router.refresh();
  }

  const Icon = copy.icon;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" /> {triggerLabel ?? copy.defaultLabel}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-2">
          <Badge variant="outline" className="w-fit text-[10px] uppercase tracking-wider">
            {copy.eyebrow}
          </Badge>
          <SheetTitle className="text-xl tracking-tight">{copy.title}</SheetTitle>
          <SheetDescription>{copy.description}</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="px-4 pb-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`s-name-${role}`} className="text-xs flex items-center gap-1">
              <User className="size-3" /> Full name
            </Label>
            <Input
              id={`s-name-${role}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={copy.nameHint}
              autoFocus
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`s-email-${role}`} className="text-xs flex items-center gap-1">
              <Mail className="size-3" /> Work email
            </Label>
            <Input
              id={`s-email-${role}`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={`${role}@bcj.com`}
              className="h-10"
            />
            <p className="text-[11px] text-muted-foreground">Used for sign-in + all platform emails.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`s-title-${role}`} className="text-xs flex items-center gap-1">
              <Icon className="size-3" /> Title{" "}
              <span className="text-muted-foreground/70 font-normal">(optional)</span>
            </Label>
            <Input
              id={`s-title-${role}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={role === "admin" ? "e.g., Director of Operations" : "e.g., Senior Trainer"}
              className="h-10"
            />
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 flex items-start gap-2">
            <Icon className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">What they get:</span>{" "}
              {role === "teacher"
                ? "An invitation email with a link to set their password, then access to the Department Lead workspace — module content uploads, AI question authoring, and the question bank for the modules they own."
                : "An invitation email with a link to set their password, then access to the full administrator workspace — managers, teachers, modules, reports, notifications, branding, and audit log."}
            </div>
          </div>
        </form>

        <SheetFooter className="border-t pt-4">
          <SheetClose asChild>
            <Button variant="outline">Cancel</Button>
          </SheetClose>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting ? "Sending invite…" : `Invite ${role === "teacher" ? "Department Lead" : "admin"}`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
