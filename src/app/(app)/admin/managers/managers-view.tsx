"use client";

import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  MoreHorizontal,
  Bell,
  RefreshCcw,
  Trash2,
  Ban,
  Filter,
  Send,
  X as XIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { AddManagerSheet } from "@/components/admin/add-manager-sheet";
import { BulkImportSheet } from "@/components/admin/bulk-import-sheet";
import type { Manager, Cohort, ManagerStatus } from "@/types";
import { fmtRelative, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchLoadingBar, motion } from "@/components/shared/animations";
import { sendReminder, sendBulkReminders } from "@/lib/server/reminder-actions";
import { deactivateUser, resendInvite, deleteUser } from "@/lib/server/admin-actions";

const COHORTS: Cohort[] = ["Atlanta", "Nashville", "Charlotte"];
const STATUSES: ManagerStatus[] = ["pending", "active", "at-risk", "completed", "inactive"];

export function AdminManagersView({ managers }: { managers: Manager[] }) {
  const router = useRouter();
  const data = managers;
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = React.useState({});

  // Pre-seed the faceted filters from drill-through links (e.g. the admin
  // dashboard pie slices → ?status=, cohort rows → ?cohort=). Reuses the
  // existing status / markets column filterFns.
  const searchParams = useSearchParams();
  React.useEffect(() => {
    const status = searchParams.get("status");
    const cohort = searchParams.get("cohort");
    const seed: ColumnFiltersState = [];
    if (status) seed.push({ id: "status", value: [status] });
    if (cohort) seed.push({ id: "markets", value: [cohort] });
    if (seed.length) setColumnFilters(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const columns = React.useMemo<ColumnDef<Manager>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        enableSorting: false,
        size: 40,
      },
      {
        accessorKey: "name",
        header: "Employee",
        cell: ({ row }) => {
          const m = row.original;
          return (
            <div className="flex items-center gap-3">
              <Avatar className="size-9 border">
                <AvatarImage src={m.avatarUrl ?? undefined} alt={m.name} className="object-cover" />
                <AvatarFallback style={{ background: m.avatarColor, color: "white" }} className="text-xs font-semibold">
                  {initials(m.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="font-medium truncate">{m.name}</div>
                <div className="text-xs text-muted-foreground truncate">{m.email}</div>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "markets",
        header: "Markets",
        cell: ({ row }) => {
          const mkts = row.original.markets?.length ? row.original.markets : (row.original.cohort ? [row.original.cohort] : []);
          if (mkts.length === 0) return <span className="text-muted-foreground">—</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {mkts.map((mk) => (
                <Badge key={mk} variant="secondary" className="font-medium">{mk}</Badge>
              ))}
            </div>
          );
        },
        // Multi-select filter: a row matches if ANY of its markets is in the
        // selected value list (overlap).
        filterFn: (row, _id, value) => {
          const wanted = value as string[];
          if (!wanted || wanted.length === 0) return true;
          const mkts = row.original.markets?.length ? row.original.markets : (row.original.cohort ? [row.original.cohort] : []);
          return mkts.some((m) => wanted.includes(m));
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const m = row.original;
          if (m.status === "pending") {
            return (
              <div className="space-y-1">
                <StatusBadge variant="pending" />
                <div className="text-[11px] text-muted-foreground">
                  {m.inviteSentAt ? `Invited ${fmtRelative(m.inviteSentAt)}` : "Invite sent"}
                  {m.inviteExpiresAt ? ` · expires ${fmtRelative(m.inviteExpiresAt)}` : ""}
                </div>
              </div>
            );
          }
          return <StatusBadge variant={m.status} />;
        },
        filterFn: (row, _id, value) =>
          (value as ManagerStatus[]).length === 0 || (value as ManagerStatus[]).includes(row.original.status),
      },
      {
        accessorKey: "modulesCompleted",
        header: "Progress",
        cell: ({ row }) => {
          const m = row.original;
          const pct = (m.modulesCompleted / 5) * 100;
          return (
            <div className="flex items-center gap-2 min-w-[140px]">
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={cn("h-full transition-all", m.status === "at-risk" ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs font-mono tabular-nums w-9 text-right">{m.modulesCompleted}/5</span>
            </div>
          );
        },
      },
      {
        accessorKey: "averageScore",
        header: "Avg score",
        cell: ({ getValue }) => {
          const v = Number(getValue());
          return v ? <span className="font-mono tabular-nums font-semibold">{v}%</span> : <span className="text-muted-foreground">—</span>;
        },
      },
      {
        accessorKey: "lastActiveAt",
        header: "Last active",
        cell: ({ row }) => {
          const m = row.original;
          return <span className="text-muted-foreground text-sm">{m.status === "pending" ? "—" : fmtRelative(m.lastActiveAt)}</span>;
        },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        size: 40,
        cell: ({ row }) => {
          const m = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => router.push(`/admin/managers/${m.id}`)}>
                  View profile
                </DropdownMenuItem>
                {m.status === "pending" && (
                  <DropdownMenuItem
                    onClick={async () => {
                      const res = await resendInvite(m.id);
                      if (!res.ok) { toast.error(res.error ?? "Could not resend invite"); return; }
                      toast.success(`Invite resent to ${m.name}`);
                      router.refresh();
                    }}
                  >
                    <Send className="mr-2 size-4" /> Resend invite
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={async () => {
                    const res = await sendReminder(m.id);
                    if (!res.ok) { toast.error(res.error ?? "Could not send"); return; }
                    toast.success(`Reminder sent to ${m.name}`);
                    router.refresh();
                  }}
                >
                  <Bell className="mr-2 size-4" /> Send reminder
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(`/admin/managers/${m.id}`)}>
                  <RefreshCcw className="mr-2 size-4" /> Reassign retake…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-rose-600"
                  onClick={async () => {
                    if (!confirm(`Deactivate ${m.name}?`)) return;
                    const res = await deactivateUser(m.id);
                    if (!res.ok) { toast.error(res.error ?? "Could not deactivate"); return; }
                    toast.success(`${m.name} deactivated`);
                    router.refresh();
                  }}
                >
                  <Ban className="mr-2 size-4" /> Deactivate
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-rose-600"
                  onClick={async () => {
                    if (!confirm(`Permanently delete ${m.name} and all their data? This cannot be undone.`)) return;
                    const res = await deleteUser(m.id);
                    if (!res.ok) { toast.error(res.error ?? "Could not delete"); return; }
                    toast.success(`${m.name} deleted`);
                    router.refresh();
                  }}
                >
                  <Trash2 className="mr-2 size-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, rowSelection, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _id, filter) => {
      const m = row.original;
      const hay = `${m.name} ${m.email} ${(m.markets ?? [m.cohort]).join(" ")}`.toLowerCase();
      return hay.includes(String(filter).toLowerCase());
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const cohortFilter = (table.getColumn("markets")?.getFilterValue() as Cohort[] | undefined) ?? [];
  const statusFilter = (table.getColumn("status")?.getFilterValue() as ManagerStatus[] | undefined) ?? [];
  const selectedRows = table.getFilteredSelectedRowModel().rows;

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Employees"
        description={`${data.length} employees across ${COHORTS.length} markets. Search, filter, sort, and act in one place.`}
        actions={
          <div className="flex items-center gap-2">
            <BulkImportSheet />
            <AddManagerSheet />
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className={cn("size-4 absolute left-3 top-1/2 -translate-y-1/2 transition-colors", globalFilter ? "text-primary" : "text-muted-foreground")} />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search by name, email, market…"
            className="pl-9 h-9 transition-shadow focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_15%,transparent)]"
          />
          <SearchLoadingBar active={!!globalFilter} />
          {globalFilter && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => setGlobalFilter("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 size-6 rounded hover:bg-accent flex items-center justify-center"
            >
              <XIcon className="size-3.5" />
            </motion.button>
          )}
        </div>

        <FacetedFilter
          label="Market"
          options={COHORTS}
          values={cohortFilter}
          onChange={(v) => table.getColumn("markets")?.setFilterValue(v.length ? v : undefined)}
        />
        <FacetedFilter
          label="Status"
          options={STATUSES}
          values={statusFilter}
          onChange={(v) => table.getColumn("status")?.setFilterValue(v.length ? v : undefined)}
          renderOption={(o) => <StatusBadge variant={o as ManagerStatus} />}
        />

        {(cohortFilter.length > 0 || statusFilter.length > 0 || globalFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setGlobalFilter("");
              setColumnFilters([]);
            }}
          >
            <XIcon className="size-3.5 mr-1" /> Reset
          </Button>
        )}

        <div className="ml-auto text-xs text-muted-foreground">
          {table.getFilteredRowModel().rows.length} of {data.length}
        </div>
      </div>

      {selectedRows.length > 0 && (
        <div className="mb-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 flex items-center gap-3">
          <Badge>{selectedRows.length} selected</Badge>
          <span className="text-sm text-muted-foreground">Apply an action to all:</span>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const ids = selectedRows.map((r) => r.original.id);
              const res = await sendBulkReminders(ids);
              if (!res.ok) { toast.error(res.error ?? "Could not send"); return; }
              toast.success(`Reminder sent to ${res.sent}${res.failed ? ` (${res.failed} failed)` : ""}`);
              router.refresh();
            }}
          >
            <Bell className="mr-1.5 size-3.5" /> Send reminder
          </Button>
          <Button size="sm" variant="outline" disabled title="Open an individual profile to reassign a retake">
            <RefreshCcw className="mr-1.5 size-3.5" /> Reassign retake
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setRowSelection({})}>
            Clear
          </Button>
        </div>
      )}

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className="text-xs uppercase tracking-wider text-muted-foreground">
                    {h.isPlaceholder ? null : h.column.getCanSort() ? (
                      <button
                        onClick={h.column.getToggleSortingHandler()}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getIsSorted() === "asc" ? <ChevronUp className="size-3" /> :
                         h.column.getIsSorted() === "desc" ? <ChevronDown className="size-3" /> :
                         <ChevronsUpDown className="size-3 opacity-40" />}
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer"
                  onClick={() => (window.location.href = `/admin/managers/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                  <Filter className="size-6 mx-auto mb-2 opacity-50" />
                  No employees match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="flex items-center justify-between mt-4 text-sm">
        <div className="text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="size-4 mr-1" /> Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next <ChevronRight className="size-4 ml-1" />
          </Button>
        </div>
      </div>
    </>
  );
}

function FacetedFilter<T extends string>({
  label,
  options,
  values,
  onChange,
  renderOption,
}: {
  label: string;
  options: T[];
  values: T[];
  onChange: (next: T[]) => void;
  renderOption?: (o: T) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const isActive = values.length > 0;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("border-dashed", isActive && "border-solid")}>
          <Filter className="size-3.5 mr-1.5" />
          {label}
          {isActive && (
            <>
              <span className="mx-2 h-4 w-px bg-border" />
              <Badge variant="secondary" className="rounded-sm px-1.5 text-xs font-normal">
                {values.length}
              </Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="space-y-1">
          {options.map((o) => {
            const checked = values.includes(o);
            return (
              <button
                key={o}
                onClick={() => onChange(checked ? values.filter((v) => v !== o) : [...values, o])}
                className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded hover:bg-accent transition-colors"
              >
                <Checkbox checked={checked} className="pointer-events-none" />
                <span className="text-sm flex-1 capitalize">{renderOption ? renderOption(o) : o}</span>
              </button>
            );
          })}
          {isActive && (
            <>
              <div className="my-1 border-t" />
              <button
                onClick={() => onChange([])}
                className="w-full text-left px-2 py-1.5 rounded text-xs text-muted-foreground hover:bg-accent"
              >
                Clear filter
              </button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
