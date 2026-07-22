"use client";

// Edit a user's name / email / (optional) title. If the user hasn't accepted
// their invite yet, saving re-mints the token and re-sends the invite to the
// (possibly new) email. Controlled (no trigger) so it can open from a row's
// dropdown menu. Reusable across the Admins / Department Leads / Employees pages.

import * as React from "react";
import {
  Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { editUserAndReinvite } from "@/lib/server/admin-actions";
import type { Role } from "@/types";

const ROLE_LABEL: Record<Role, string> = {
  manager: "Employee",
  teacher: "Department Lead",
  admin: "Admin",
};

// Canonical markets (same list used by the Add-Manager sheet).
const COHORTS = ["Atlanta", "Nashville", "Charlotte"] as const;

export interface EditableUser {
  id: string;
  name: string;
  email: string;
  title?: string | null;
  role?: Role;
  /** Employee's currently-assigned market(s). Used when `showMarkets` is set. */
  markets?: string[];
}

export function EditUserSheet({
  user,
  open,
  onOpenChange,
  showTitle = false,
  showRole = false,
  showMarkets = false,
}: {
  user: EditableUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showTitle?: boolean;
  /** Show a role selector so an admin can promote/demote (Employee / Lead / Admin). */
  showRole?: boolean;
  /** Show a market multi-select (employees only). */
  showMarkets?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [role, setRole] = React.useState<Role>("manager");
  const [markets, setMarkets] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);

  // Re-seed the fields whenever a different user is opened.
  React.useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setEmail(user.email ?? "");
      setTitle(user.title ?? "");
      setRole(user.role ?? "manager");
      // Normalise to the canonical set so legacy values don't leave a stale toggle.
      setMarkets((user.markets ?? []).filter((m) => (COHORTS as readonly string[]).includes(m)));
    }
  }, [user]);

  function toggleMarket(m: string) {
    setMarkets((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

  // Market field is only relevant for employees; hide it if the role is switched away.
  const marketsVisible = showMarkets && role === "manager";
  const marketsInvalid = marketsVisible && markets.length === 0;

  const roleChanged = showRole && !!user && role !== (user.role ?? "manager");

  async function handleSave() {
    if (!user) return;
    if (!name.trim()) { toast.error("Name is required"); return; }
    if (!email.trim()) { toast.error("Email is required"); return; }
    if (marketsInvalid) { toast.error("Pick at least one market"); return; }
    setSaving(true);
    const res = await editUserAndReinvite({
      userId: user.id,
      name: name.trim(),
      email: email.trim(),
      title: showTitle ? (title.trim() || null) : undefined,
      role: showRole ? role : undefined,
      markets: marketsVisible ? markets : undefined,
    });
    setSaving(false);
    if (!res.ok) { toast.error(res.error ?? "Could not save changes"); return; }
    if (res.removedOwnership?.length) {
      toast.success(`Role updated to ${ROLE_LABEL[role]}`, {
        description: `Removed as owner of: ${res.removedOwnership.join(", ")}. Reassign ${res.removedOwnership.length === 1 ? "it" : "them"} to another lead from the module page.`,
        duration: 8000,
      });
    } else {
      toast.success(
        roleChanged ? `Role updated to ${ROLE_LABEL[role]}` : res.resent ? "Saved — invite re-sent" : "Changes saved",
      );
    }
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit {user?.name || "user"}</SheetTitle>
          <SheetDescription>
            Update their details. If they haven&rsquo;t accepted their invite yet, saving re-sends it to the email below.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="eu-name" className="text-xs">Full name</Label>
            <Input id="eu-name" value={name} onChange={(e) => setName(e.target.value)} className="h-10" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eu-email" className="text-xs">Work email</Label>
            <Input id="eu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10" />
          </div>
          {showRole && (
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Employee</SelectItem>
                  <SelectItem value="teacher">Department Lead</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              {roleChanged && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  Changing the role changes what this person can see and do after they next load the app.
                </p>
              )}
            </div>
          )}
          {marketsVisible && (
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Users className="size-3" /> Markets
                <span className="text-muted-foreground/70 font-normal">(pick one or more)</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {COHORTS.map((c) => {
                  const sel = markets.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleMarket(c)}
                      aria-pressed={sel}
                      className={`px-3 h-9 rounded-md border text-sm transition-colors ${
                        sel
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card border-border hover:bg-accent"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {showTitle && (
            <div className="space-y-1.5">
              <Label htmlFor="eu-title" className="text-xs">Title (optional)</Label>
              <Input id="eu-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Office Manager" className="h-10" />
            </div>
          )}
        </div>

        <SheetFooter>
          <SheetClose asChild><Button variant="outline">Cancel</Button></SheetClose>
          <Button onClick={handleSave} disabled={saving || !name.trim() || !email.trim() || marketsInvalid}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
