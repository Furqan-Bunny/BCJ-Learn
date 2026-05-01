"use client";

import * as React from "react";
import {
  Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Mail, User, Users, Sparkles } from "lucide-react";
import type { Cohort } from "@/types";
import { toast } from "sonner";

const COHORTS: Cohort[] = ["Atlanta", "Dallas", "Phoenix"];

export function AddManagerSheet() {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [cohort, setCohort] = React.useState<Cohort | "">("");
  const [submitting, setSubmitting] = React.useState(false);

  const canSubmit = name.trim() && email.trim() && cohort;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setOpen(false);
      toast.success(`${name} added to BCJ Learn`, {
        description: `Cohort: ${cohort} · Invitation email queued. They'll be invited to the next delivery of any module they haven't passed.`,
      });
      setName("");
      setEmail("");
      setCohort("");
    }, 600);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" /> Add manager
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-2">
          <Badge variant="outline" className="w-fit text-[10px] uppercase tracking-wider">
            New Account Manager
          </Badge>
          <SheetTitle className="text-xl tracking-tight">Add an Account Manager</SheetTitle>
          <SheetDescription>
            New hires are auto-invited to any module they haven&rsquo;t yet passed. They&rsquo;ll receive a welcome email with the next training day and a link to log in.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="px-4 pb-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="m-name" className="text-xs flex items-center gap-1">
              <User className="size-3" /> Full name
            </Label>
            <Input
              id="m-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Jordan Patel"
              autoFocus
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="m-email" className="text-xs flex items-center gap-1">
              <Mail className="size-3" /> Work email
            </Label>
            <Input
              id="m-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jordan@bcj.com"
              className="h-10"
            />
            <p className="text-[11px] text-muted-foreground">Used for sign-in + all training emails.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="m-cohort" className="text-xs flex items-center gap-1">
              <Users className="size-3" /> Cohort
            </Label>
            <Select value={cohort} onValueChange={(v) => setCohort(v as Cohort)}>
              <SelectTrigger id="m-cohort" className="h-10 w-full">
                <SelectValue placeholder="Pick a cohort" />
              </SelectTrigger>
              <SelectContent>
                {COHORTS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-[var(--ai)]/30 bg-[var(--ai)]/5 p-3 flex items-start gap-2">
            <Sparkles className="size-3.5 text-[var(--ai)] shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Auto-assignment:</span> They&rsquo;ll be invited to the 5-module program. Modules they haven&rsquo;t taken yet will queue invitations for the next delivery of each.
            </div>
          </div>
        </form>

        <SheetFooter className="border-t pt-4">
          <SheetClose asChild>
            <Button variant="outline">Cancel</Button>
          </SheetClose>
          <Button
            onClick={handleSubmit as unknown as React.MouseEventHandler<HTMLButtonElement>}
            disabled={!canSubmit || submitting}
          >
            {submitting ? "Adding…" : "Add manager"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
