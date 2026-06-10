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
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { editUserAndReinvite } from "@/lib/server/admin-actions";

export interface EditableUser {
  id: string;
  name: string;
  email: string;
  title?: string | null;
}

export function EditUserSheet({
  user,
  open,
  onOpenChange,
  showTitle = false,
}: {
  user: EditableUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showTitle?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // Re-seed the fields whenever a different user is opened.
  React.useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setEmail(user.email ?? "");
      setTitle(user.title ?? "");
    }
  }, [user]);

  async function handleSave() {
    if (!user) return;
    if (!name.trim()) { toast.error("Name is required"); return; }
    if (!email.trim()) { toast.error("Email is required"); return; }
    setSaving(true);
    const res = await editUserAndReinvite({
      userId: user.id,
      name: name.trim(),
      email: email.trim(),
      title: showTitle ? (title.trim() || null) : undefined,
    });
    setSaving(false);
    if (!res.ok) { toast.error(res.error ?? "Could not save changes"); return; }
    toast.success(res.resent ? "Saved — invite re-sent" : "Changes saved");
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
          {showTitle && (
            <div className="space-y-1.5">
              <Label htmlFor="eu-title" className="text-xs">Title (optional)</Label>
              <Input id="eu-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Office Manager" className="h-10" />
            </div>
          )}
        </div>

        <SheetFooter>
          <SheetClose asChild><Button variant="outline">Cancel</Button></SheetClose>
          <Button onClick={handleSave} disabled={saving || !name.trim() || !email.trim()}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
