"use client";

import * as React from "react";
import Link from "next/link";
import {
  ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel,
  getPaginationRowModel, getSortedRowModel,
  type SortingState, type ColumnFiltersState, useReactTable,
} from "@tanstack/react-table";
import {
  Search, ChevronUp, ChevronDown, ChevronsUpDown, Filter, X as XIcon,
  ChevronLeft, ChevronRight, Users, Trophy, AlertTriangle, ArrowUpRight, Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { KpiCard } from "@/components/shared/kpi-card";
import type { Manager, Cohort, ModuleDef } from "@/types";
import { fmtRelative, initials, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { sendReminder } from "@/lib/server/reminder-actions";

const COHORTS: Cohort[] = ["Atlanta", "Nashville", "Charlotte"];

export interface TraineeRow extends Manager {
  myModuleAttempts: number;
  myModuleBestScore: number | null;
  myModuleStatus: "passed" | "failed" | "pending";
}

export interface TeacherTraineesViewProps {
  rows: TraineeRow[];
  myModules: ModuleDef[];
}

export function TeacherTraineesView({ rows, myModules }: TeacherTraineesViewProps) {
  const router = useRouter();
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  const totalTrainees = rows.length;
  const passed = rows.filter((r) => r.myModuleStatus === "passed").length;
  const pending = rows.filter((r) => r.myModuleStatus === "pending").length;
  const atRisk = rows.filter((r) => r.status === "at-risk").length;

  const columns = React.useMemo<ColumnDef<TraineeRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Manager",
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
        accessorKey: "cohort",
        header: "Cohort",
        cell: ({ getValue }) => <Badge variant="secondary">{String(getValue())}</Badge>,
        filterFn: (row, _id, value) =>
          (value as Cohort[]).length === 0 || (value as Cohort[]).includes(row.original.cohort),
      },
      {
        accessorKey: "myModuleStatus",
        header: "Your modules",
        cell: ({ row }) => {
          const m = row.original;
          if (m.myModuleStatus === "passed") return <StatusBadge variant="passed" />;
          if (m.myModuleStatus === "failed") return <StatusBadge variant="failed" />;
          return <StatusBadge variant="scheduled" label="Scheduled" />;
        },
      },
      {
        accessorKey: "myModuleBestScore",
        header: "Best score",
        cell: ({ getValue }) => {
          const v = getValue() as number | null;
          return v != null ? (
            <span className="font-mono tabular-nums font-semibold">{fmtPct(v)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        accessorKey: "myModuleAttempts",
        header: "Attempts",
        cell: ({ getValue }) => <span className="text-sm tabular-nums">{String(getValue())}</span>,
      },
      {
        accessorKey: "status",
        header: "Overall",
        cell: ({ row }) => <StatusBadge variant={row.original.status} />,
      },
      {
        accessorKey: "lastActiveAt",
        header: "Last active",
        cell: ({ getValue }) => <span className="text-sm text-muted-foreground">{fmtRelative(String(getValue()))}</span>,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        size: 40,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={async (e) => {
                e.stopPropagation();
                const res = await sendReminder(row.original.id);
                if (!res.ok) { toast.error(res.error ?? "Could not send"); return; }
                toast.success(`Reminder sent to ${row.original.name}`);
                router.refresh();
              }}
              aria-label="Send reminder"
            >
              <Bell className="size-4" />
            </Button>
            <Button asChild variant="ghost" size="icon" className="size-8">
              <Link href={`/admin/managers/${row.original.id}`}>
                <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _id, filter) => {
      const m = row.original;
      const hay = `${m.name} ${m.email} ${m.cohort}`.toLowerCase();
      return hay.includes(String(filter).toLowerCase());
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 12 } },
  });

  const cohortFilter = (table.getColumn("cohort")?.getFilterValue() as Cohort[] | undefined) ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Team"
        title="My team"
        description={`Managers being trained on ${myModules.length === 1 ? "the module you own" : "your modules"} (${myModules.map((m) => `M${m.number}`).join(", ")}). Read-only — Admin manages user records.`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Team members" value={totalTrainees} icon={Users} />
        <KpiCard label="Passed your modules" value={passed} icon={Trophy} accent="success" />
        <KpiCard label="Not yet attempted" value={pending} icon={Users} />
        <KpiCard label="At-risk" value={atRisk} icon={AlertTriangle} accent="warning" />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search by name, email, cohort…"
            className="pl-9 h-9"
          />
        </div>
        <FacetedFilter
          label="Cohort"
          options={COHORTS}
          values={cohortFilter}
          onChange={(v) => table.getColumn("cohort")?.setFilterValue(v.length ? v : undefined)}
        />

        {(cohortFilter.length || globalFilter) ? (
          <Button variant="ghost" size="sm" onClick={() => { setGlobalFilter(""); setColumnFilters([]); }}>
            <XIcon className="size-3.5 mr-1" /> Reset
          </Button>
        ) : null}

        <div className="ml-auto text-xs text-muted-foreground">
          {table.getFilteredRowModel().rows.length} of {rows.length}
        </div>
      </div>

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
                <TableRow key={row.id}>
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
                  No managers match your filters.
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
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            <ChevronLeft className="size-4 mr-1" /> Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next <ChevronRight className="size-4 ml-1" />
          </Button>
        </div>
      </div>
    </>
  );
}

function FacetedFilter<T extends string>({
  label, options, values, onChange,
}: {
  label: string;
  options: T[];
  values: T[];
  onChange: (next: T[]) => void;
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
                <span className="text-sm flex-1">{o}</span>
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
