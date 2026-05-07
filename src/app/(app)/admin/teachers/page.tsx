"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/page-header";
import { teachers } from "@/data/users";
import { modules } from "@/data/modules";
import { questionsForModule } from "@/data/questions";
import { initials, fmtRelative, fmtDate } from "@/lib/format";
import {
  Search, Plus, MoreHorizontal, Mail, Edit3, Trash2, BookOpen, ListChecks, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

export default function AdminTeachersPage() {
  const [query, setQuery] = React.useState("");

  const enriched = teachers.map((t) => {
    const ownedMods = modules.filter((m) => t.ownedModuleSlugs.includes(m.slug));
    const totalQs = ownedMods.reduce((s, m) => s + m.questionsTotal, 0);
    const approvedQs = ownedMods.reduce((s, m) => s + m.questionsApproved, 0);
    return { teacher: t, ownedMods, totalQs, approvedQs };
  });

  const filtered = enriched.filter(({ teacher: t }) => {
    if (!query) return true;
    const hay = `${t.name} ${t.email} ${t.bio}`.toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Department Leads"
        description={`${teachers.length} module owners. Each Department Lead manages their own module's content and question bank.`}
        actions={
          <Button>
            <Plus className="mr-2 size-4" /> Invite Department Lead
          </Button>
        }
      />

      <div className="flex items-center gap-3 mb-4 max-w-md">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, bio…"
            className="pl-9 h-9"
          />
        </div>
        <div className="text-xs text-muted-foreground">
          {filtered.length} of {teachers.length}
        </div>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Department Lead</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Owned modules</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Question bank</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Joined</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Last active</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(({ teacher: t, ownedMods, totalQs, approvedQs }) => (
              <TableRow key={t.id} className="hover:bg-accent/40">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9 border">
                      <AvatarFallback style={{ background: t.avatarColor, color: "white" }} className="text-xs font-semibold">
                        {initials(t.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{t.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    {ownedMods.length === 0 && (
                      <span className="text-xs text-muted-foreground italic">No modules assigned</span>
                    )}
                    {ownedMods.map((m) => (
                      <Link key={m.slug} href={`/admin/modules/${m.slug}`}>
                        <Badge variant="secondary" className="hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer">
                          M{m.number} · {m.title.split(" ")[0]}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="font-mono tabular-nums text-sm">
                      <span className="font-semibold">{approvedQs}</span>
                      <span className="text-muted-foreground"> / {totalQs}</span>
                    </div>
                    <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: totalQs ? `${(approvedQs / totalQs) * 100}%` : "0%" }}
                      />
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{fmtDate(t.joinedAt)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{fmtRelative(t.lastActiveAt)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => toast.info(`Email ${t.name}`)}>
                        <Mail className="mr-2 size-4" /> Send email
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast.info("Edit drawer (mocked)")}>
                        <Edit3 className="mr-2 size-4" /> Edit profile
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast.info("Reassign module modal (mocked)")}>
                        <BookOpen className="mr-2 size-4" /> Reassign modules
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-rose-600" onClick={() => toast(`${t.name} deactivated`)}>
                        <Trash2 className="mr-2 size-4" /> Deactivate
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Per-Lead detail cards below */}
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mt-10 mb-4">
        Department Lead details
      </h3>
      <div className="grid lg:grid-cols-2 gap-4">
        {filtered.map(({ teacher: t, ownedMods, totalQs, approvedQs }) => (
          <Card key={`detail-${t.id}`}>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <Avatar className="size-12 border">
                  <AvatarFallback style={{ background: t.avatarColor, color: "white" }} className="font-semibold">
                    {initials(t.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.email}</div>
                  <p className="text-sm text-foreground/80 mt-2">{t.bio}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <Stat icon={BookOpen} label="Modules" value={String(ownedMods.length)} />
                <Stat icon={ListChecks} label="Approved Qs" value={`${approvedQs}/${totalQs}`} />
                <Stat icon={ArrowRight} label="Last active" value={fmtRelative(t.lastActiveAt).replace("ago", "")} />
              </div>

              {ownedMods.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Modules</div>
                  <div className="space-y-2">
                    {ownedMods.map((m) => {
                      const moduleApproved = questionsForModule(m.slug).filter((q) => q.status === "approved").length;
                      const moduleTotal = questionsForModule(m.slug).length;
                      return (
                        <Link key={m.slug} href={`/teacher/modules/${m.slug}/questions`}>
                          <div className="flex items-center gap-3 p-2 rounded-md hover:bg-accent/50 transition-colors cursor-pointer">
                            <div className="size-7 rounded bg-primary/10 text-primary flex items-center justify-center font-mono text-xs font-semibold">
                              M{m.number}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{m.title}</div>
                              <div className="text-xs text-muted-foreground">
                                {moduleApproved}/{moduleTotal} questions approved · {m.scheduledMonth}
                              </div>
                            </div>
                            <ArrowRight className="size-4 text-muted-foreground" />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-md border p-2.5 text-center">
      <Icon className="size-3.5 mx-auto text-muted-foreground mb-1" />
      <div className="font-semibold text-sm tabular-nums truncate">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
