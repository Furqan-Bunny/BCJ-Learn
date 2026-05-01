"use client";

import * as React from "react";
import Link from "next/link";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  type ColumnFiltersState,
  useReactTable,
} from "@tanstack/react-table";
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Filter,
  X as XIcon,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Target,
  Users,
  AlertTriangle,
  Download,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { KpiCard } from "@/components/shared/kpi-card";
import { attempts } from "@/data/attempts";
import { managers } from "@/data/users";
import { modules } from "@/data/modules";
import type { Attempt, AttemptStatus, QuestionPool } from "@/types";
import { fmtDate, fmtPct, fmtDuration, fmtRelative, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AttemptRow {
  id: string;
  managerName: string;
  managerEmail: string;
  managerAvatarColor: string;
  managerId: string;
  cohort: string;
  moduleSlug: string;
  moduleNumber: number;
  moduleTitle: string;
  pool: QuestionPool;
  status: AttemptStatus;
  startedAt: string;
  scorePct: number;
  durationSec?: number;
  correctCount: number;
  totalCount: number;
}

export default function AdminResults() {
  const rows: AttemptRow[] = React.useMemo(
    () =>
      attempts
        .map((a): AttemptRow | null => {
          const m = managers.find((x) => x.id === a.managerId);
          const mod = modules.find((x) => x.slug === a.moduleSlug);
          if (!m || !mod) return null;
          return {
            id: a.id,
            managerName: m.name,
            managerEmail: m.email,
            managerAvatarColor: m.avatarColor,
            managerId: m.id,
            cohort: m.cohort,
            moduleSlug: mod.slug,
            moduleNumber: mod.number,
            moduleTitle: mod.title,
            pool: a.pool,
            status: a.status,
            startedAt: a.startedAt,
            scorePct: a.scorePct,
            durationSec: a.durationSec,
            correctCount: a.correctCount,
            totalCount: a.totalCount,
          };
        })
        .filter((x): x is AttemptRow => !!x)
        .sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt)),
    [],
  );

  const [globalFilter, setGlobalFilter] = React.useState("");
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "startedAt", desc: true }]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  const totalAttempts = rows.length;
  const passedCount = rows.filter((r) => r.status === "passed").length;
  const failedCount = rows.filter((r) => r.status === "failed").length;
  const passRate = totalAttempts ? Math.round((passedCount / totalAttempts) * 100) : 0;
  const avgScore = totalAttempts
    ? Math.round(rows.reduce((s, r) => s + r.scorePct, 0) / totalAttempts)
    : 0;

  const columns = React.useMemo<ColumnDef<AttemptRow>[]>(
    () => [
      {
        accessorKey: "managerName",
        header: "Manager",
        cell: ({ row }) => {
          const r = row.original;
          return (
            <Link href={`/admin/managers/${r.managerId}`} className="flex items-center gap-3 group">
              <Avatar className="size-8 border">
                <AvatarFallback style={{ background: r.managerAvatarColor, color: "white" }} className="text-[10px] font-semibold">
                  {initials(r.managerName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="font-medium text-sm group-hover:text-primary transition-colors truncate">{r.managerName}</div>
                <div className="text-[10px] text-muted-foreground truncate">{r.cohort}</div>
              </div>
            </Link>
          );
        },
      },
      {
        accessorKey: "moduleNumber",
        header: "Module",
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex items-center gap-2 min-w-0">
              <Badge variant="secondary" className="font-mono shrink-0">M{r.moduleNumber}</Badge>
              <span className="text-sm truncate">{r.moduleTitle}</span>
            </div>
          );
        },
        filterFn: (row, _id, value) =>
          (value as string[]).length === 0 || (value as string[]).includes(row.original.moduleSlug),
      },
      {
        accessorKey: "pool",
        header: "Pool",
        cell: ({ row }) => <StatusBadge variant={row.original.pool} />,
        filterFn: (row, _id, value) =>
          (value as QuestionPool[]).length === 0 || (value as QuestionPool[]).includes(row.original.pool),
      },
      {
        accessorKey: "scorePct",
        header: "Score",
        cell: ({ row }) => {
          const r = row.original;
          const passed = r.status === "passed";
          return (
            <div className="flex items-center gap-2">
              <span className={cn(
                "font-mono tabular-nums font-semibold text-sm",
                passed ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
              )}>{fmtPct(r.scorePct)}</span>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {r.correctCount}/{r.totalCount}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge variant={row.original.status as "passed" | "failed"} />,
        filterFn: (row, _id, value) =>
          (value as AttemptStatus[]).length === 0 || (value as AttemptStatus[]).includes(row.original.status),
      },
      {
        accessorKey: "durationSec",
        header: "Time",
        cell: ({ row }) => <span className="text-sm text-muted-foreground tabular-nums">{fmtDuration(row.original.durationSec)}</span>,
      },
      {
        accessorKey: "startedAt",
        header: "Date",
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{fmtRelative(row.original.startedAt)}</span>,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        size: 50,
        cell: ({ row }) => (
          <Button asChild variant="ghost" size="icon" className="size-8">
            <Link href={`/admin/results/${row.original.id}`}>
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
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
      const r = row.original;
      const hay = `${r.managerName} ${r.managerEmail} ${r.moduleTitle} ${r.cohort}`.toLowerCase();
      return hay.includes(String(filter).toLowerCase());
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 15 } },
  });

  const moduleFilter = (table.getColumn("moduleNumber")?.getFilterValue() as string[] | undefined) ?? [];
  const poolFilter = (table.getColumn("pool")?.getFilterValue() as QuestionPool[] | undefined) ?? [];
  const statusFilter = (table.getColumn("status")?.getFilterValue() as AttemptStatus[] | undefined) ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Reporting"
        title="All test results"
        description={`Every quiz attempt across the program — ${totalAttempts} total. Filter by module, search by manager, drill into any attempt.`}
        actions={
          <Button variant="outline" onClick={() => toast.success("Results exported as CSV")}>
            <Download className="mr-2 size-4" /> Export CSV
          </Button>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total attempts" value={totalAttempts} icon={Users} />
        <KpiCard label="Pass rate" value={`${passRate}%`} icon={Trophy} accent="success" />
        <KpiCard label="Avg score" value={`${avgScore}%`} icon={Target} />
        <KpiCard label="Failed attempts" value={failedCount} icon={AlertTriangle} accent="warning" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[280px] max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search by manager, email, module, cohort…"
            className="pl-9 h-9"
          />
        </div>

        <FacetedFilter
          label="Module"
          options={modules.map((m) => ({ value: m.slug, label: `M${m.number} · ${m.title}` }))}
          values={moduleFilter}
          onChange={(v) => table.getColumn("moduleNumber")?.setFilterValue(v.length ? v : undefined)}
        />
        <FacetedFilter
          label="Pool"
          options={[
            { value: "first-attempt", label: "First attempt" },
            { value: "retake", label: "Retake (easier)" },
          ]}
          values={poolFilter}
          onChange={(v) => table.getColumn("pool")?.setFilterValue(v.length ? v : undefined)}
        />
        <FacetedFilter
          label="Status"
          options={[
            { value: "passed", label: "Passed" },
            { value: "failed", label: "Failed" },
          ]}
          values={statusFilter}
          onChange={(v) => table.getColumn("status")?.setFilterValue(v.length ? v : undefined)}
        />

        {(moduleFilter.length || poolFilter.length || statusFilter.length || globalFilter) ? (
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
                  No attempts match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
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

function FacetedFilter({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (next: string[]) => void;
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
      <PopoverContent className="w-64 p-2" align="start">
        <div className="space-y-1">
          {options.map((o) => {
            const checked = values.includes(o.value);
            return (
              <button
                key={o.value}
                onClick={() => onChange(checked ? values.filter((v) => v !== o.value) : [...values, o.value])}
                className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded hover:bg-accent transition-colors"
              >
                <Checkbox checked={checked} className="pointer-events-none" />
                <span className="text-sm flex-1">{o.label}</span>
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
