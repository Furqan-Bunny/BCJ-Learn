"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Plus, MoreHorizontal, Mail, Edit3, Trash2, ShieldCheck, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { initials, fmtRelative, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { updateUserAsAdmin } from "@/lib/server/admin-actions";
import { AddStaffSheet } from "@/components/admin/add-staff-sheet";
import type { Admin, ActivityEvent } from "@/types";

const PERMISSIONS = [
  "Manage all users",
  "Approve modules",
  "Send reminders",
  "Export reports",
  "Edit branding",
  "Audit log access",
];

export interface AdminAdminsViewProps {
  admins: Admin[];
  activityByActor: Record<string, ActivityEvent[]>;
}

export function AdminAdminsView({ admins, activityByActor }: AdminAdminsViewProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");

  const filtered = admins.filter((a) => {
    if (!query) return true;
    const hay = `${a.name} ${a.email} ${a.title}`.toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Administrators"
        description={`${admins.length} BCJ leadership members with full platform access. Be careful who you grant this role to.`}
        actions={<AddStaffSheet role="admin" />}
      />

      <div className="flex items-center gap-3 mb-4 max-w-md">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search admins…" className="pl-9 h-9" />
        </div>
        <div className="text-xs text-muted-foreground">
          {filtered.length} of {admins.length}
        </div>
      </div>

      <Card className="mb-6 border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="p-4 flex items-start gap-3">
          <Sparkles className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium">Admins have full platform access</div>
            <div className="text-muted-foreground mt-0.5">
              They can manage all users, approve modules, edit branding, and view every report. Only grant this role to BCJ leadership.
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Admin</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Title</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Joined</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Last active</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((a) => (
              <TableRow key={a.id} className="hover:bg-accent/40">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9 border">
                      <AvatarFallback style={{ background: a.avatarColor, color: "white" }} className="text-xs font-semibold">
                        {initials(a.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-medium flex items-center gap-2">
                        {a.name}
                        <ShieldCheck className="size-3.5 text-primary" />
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{a.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{a.title}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{fmtDate(a.joinedAt)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{fmtRelative(a.lastActiveAt)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => toast.info(`Email ${a.name}`)}>
                        <Mail className="mr-2 size-4" /> Send email
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast.info("Edit drawer (mocked)")}>
                        <Edit3 className="mr-2 size-4" /> Edit profile
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast.info("Permissions panel (mocked)")}>
                        <ShieldCheck className="mr-2 size-4" /> Permissions
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-rose-600"
                        onClick={async () => {
                          if (!confirm(`Revoke admin role from ${a.name}? They will become a teacher.`)) return;
                          const res = await updateUserAsAdmin({ userId: a.id, role: "teacher" });
                          if (!res.ok) { toast.error(res.error ?? "Could not revoke"); return; }
                          toast.success(`${a.name} demoted to teacher`);
                          router.refresh();
                        }}
                      >
                        <Trash2 className="mr-2 size-4" /> Revoke admin role
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mt-10 mb-4">
        Recent admin activity
      </h3>
      <div className="grid lg:grid-cols-3 gap-4 items-stretch">
        {filtered.map((a) => {
          const myActivity = (activityByActor[a.id] ?? []).slice(0, 5);
          return (
            <Card key={`activity-${a.id}`} className="h-full">
              <CardContent className="p-5 h-full">
                <div className="flex items-center gap-3 mb-4 pb-4 border-b">
                  <Avatar className="size-10 border">
                    <AvatarFallback style={{ background: a.avatarColor, color: "white" }} className="font-semibold">
                      {initials(a.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-muted-foreground">{a.title}</div>
                  </div>
                </div>

                {myActivity.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic py-4 text-center">No recent activity</div>
                ) : (
                  <ul className="space-y-2">
                    {myActivity.map((e) => (
                      <li key={e.id} className="text-xs">
                        <div className="text-foreground/90 line-clamp-2">{e.message}</div>
                        <div className="text-muted-foreground mt-0.5">{fmtRelative(e.occurredAt)}</div>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-4 pt-4 border-t">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Permissions</div>
                  <div className="flex flex-wrap gap-1">
                    {PERMISSIONS.slice(0, 4).map((p) => (
                      <Badge key={p} variant="outline" className="text-[10px] font-normal">{p}</Badge>
                    ))}
                    <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                      +{PERMISSIONS.length - 4} more
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
