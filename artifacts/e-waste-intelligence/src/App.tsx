import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useGetEWasteData, type EWasteRecord } from "@workspace/api-client-react";
import {
  Activity,
  AlertCircle,
  ArrowUpDown,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Database,
  Download,
  Factory,
  Leaf,
  MapPin,
  Menu,
  Moon,
  Printer,
  RefreshCw,
  Recycle,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Users,
  X,
} from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Route, Switch, useLocation, Router as WouterRouter } from "wouter";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

const CHART_COLORS = {
  forest: "#1f5c50",
  saffron: "#d19b37",
  slate: "#51788a",
  coral: "#c86f52",
  lilac: "#8f7a9c",
  ink: "#173b35",
};

const CHART_COLOR_LIST = [
  CHART_COLORS.forest,
  CHART_COLORS.saffron,
  CHART_COLORS.slate,
  CHART_COLORS.coral,
  CHART_COLORS.lilac,
];

const INTERVAL_OPTIONS = [
  { label: "Every 5 min", ms: 5 * 60 * 1000 },
  { label: "Every 15 min", ms: 15 * 60 * 1000 },
  { label: "Every hour", ms: 60 * 60 * 1000 },
  { label: "Every 24 hours", ms: 24 * 60 * 60 * 1000 },
];

type FilterKey = "year" | "state" | "city" | "e_waste_type" | "sector" | "collection_channel";
type SortKey = "collection_month" | "city" | "state" | "e_waste_type" | "sector" | "collection_channel" | "e_waste_collected_kg" | "material_recovered_kg" | "recovery_rate_pct";

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}

function formatMass(value: number) {
  return value >= 1000 ? `${formatNumber(value / 1000, 1)} t` : `${formatNumber(value)} kg`;
}

function formatMassAxis(value: number) {
  return value >= 1000 ? `${formatNumber(value / 1000, 0)}t` : `${formatNumber(value)}kg`;
}

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => `"${String(row[header] ?? "").replaceAll('"', '""')}"`).join(","),
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ExportButton({ filename, rows, isDark }: { filename: string; rows: Record<string, unknown>[]; isDark: boolean }) {
  return (
    <button
      type="button"
      onClick={() => downloadCsv(filename, rows)}
      disabled={!rows.length}
      className="print:hidden flex h-7 w-7 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition hover:border-primary/40 hover:text-primary disabled:opacity-40"
      aria-label={`Export ${filename}`}
      title="Export chart data"
      style={{ backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "hsl(var(--muted) / 0.5)" }}
    >
      <Download className="h-3.5 w-3.5" />
    </button>
  );
}

function ChartCard({
  title,
  eyebrow,
  filename,
  rows,
  isDark,
  className = "",
  children,
}: {
  title: string;
  eyebrow?: string;
  filename: string;
  rows: Record<string, unknown>[];
  isDark: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`data-card rounded-xl ${className}`}>
      <div className="flex items-start justify-between gap-3 px-5 pb-1 pt-5">
        <div>
          {eyebrow && <p className="eyebrow mb-1 text-primary/75">{eyebrow}</p>}
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
        </div>
        <ExportButton filename={filename} rows={rows} isDark={isDark} />
      </div>
      <div className="px-4 pb-5 pt-3">{children}</div>
    </section>
  );
}

function EmptyChart({ label = "No records match these filters." }: { label?: string }) {
  return (
    <div className="flex h-[254px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/25 text-center">
      <BarChart3 className="h-7 w-7 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="min-w-[145px] flex-1">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <select
        className="filter-select h-10 w-full rounded-lg border border-input bg-background px-3 pr-8 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All {label.toLowerCase()}s</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  accent = "forest",
  loading,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Leaf;
  accent?: "forest" | "saffron" | "slate" | "coral";
  loading: boolean;
}) {
  const accents = {
    forest: "bg-primary/10 text-primary",
    saffron: "bg-accent/25 text-[#9b6d16]",
    slate: "bg-[#51788a]/10 text-[#416675]",
    coral: "bg-[#c86f52]/10 text-[#ad5941]",
  };
  return (
    <section className="data-card rounded-xl p-4">
      {loading ? (
        <div className="space-y-3">
          <div className="h-3 w-28 animate-pulse rounded bg-muted" />
          <div className="h-8 w-36 animate-pulse rounded bg-muted" />
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
            <span className={`rounded-md p-2 ${accents[accent]}`}><Icon className="h-4 w-4" /></span>
          </div>
          <p className="metric-number mt-3 text-[27px] font-bold text-primary">{value}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
        </>
      )}
    </section>
  );
}

function Dashboard() {
  const query = useGetEWasteData();
  const queryClient = useQueryClient();
  const rows = query.data ?? [];
  const loading = query.isLoading || query.isFetching;
  const [isDark, setIsDark] = useState(false);
  const [filters, setFilters] = useState<Record<FilterKey, string>>({
    year: "", state: "", city: "", e_waste_type: "", sector: "", collection_channel: "",
  });
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [intervalMs, setIntervalMs] = useState(INTERVAL_OPTIONS[0].ms);
  const [refreshMenuOpen, setRefreshMenuOpen] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const refreshRef = useRef<HTMLDivElement>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("collection_month");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    if (!loading) {
      const timeout = window.setTimeout(() => setIsSpinning(false), 600);
      return () => window.clearTimeout(timeout);
    }
    setIsSpinning(true);
    return undefined;
  }, [loading]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (refreshRef.current && !refreshRef.current.contains(event.target as Node)) setRefreshMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = window.setInterval(() => queryClient.invalidateQueries({ queryKey: query.queryKey }), intervalMs);
    return () => window.clearInterval(interval);
  }, [autoRefresh, intervalMs, queryClient, query.queryKey]);

  const options = useMemo(() => {
    const unique = (key: FilterKey) => [...new Set(rows.map((row) => String(row[key])))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return {
      year: unique("year"),
      state: unique("state"),
      city: unique("city"),
      e_waste_type: unique("e_waste_type"),
      sector: unique("sector"),
      collection_channel: unique("collection_channel"),
    };
  }, [rows]);

  const filteredRows = useMemo(() => rows.filter((row) =>
    (Object.entries(filters) as [FilterKey, string][]).every(([key, value]) => !value || String(row[key]) === value),
  ), [filters, rows]);

  const metrics = useMemo(() => {
    const collected = filteredRows.reduce((sum, row) => sum + row.e_waste_collected_kg, 0);
    const formal = filteredRows.reduce((sum, row) => sum + row.formal_collected_kg, 0);
    const informal = filteredRows.reduce((sum, row) => sum + row.informal_collected_kg, 0);
    const recovered = filteredRows.reduce((sum, row) => sum + row.material_recovered_kg, 0);
    return {
      collected, formal, informal, recovered,
      rate: collected ? (recovered / collected) * 100 : 0,
      jobs: filteredRows.reduce((sum, row) => sum + row.estimated_jobs_supported, 0),
    };
  }, [filteredRows]);

  const monthlyData = useMemo(() => {
    const map = new Map<string, { month: string; formal: number; informal: number; total: number }>();
    filteredRows.forEach((row) => {
      const key = row.collection_month || `${row.year}-${String(row.month).padStart(2, "0")}`;
      const item = map.get(key) ?? { month: row.month_name.slice(0, 3), formal: 0, informal: 0, total: 0 };
      item.formal += row.formal_collected_kg;
      item.informal += row.informal_collected_kg;
      item.total += row.e_waste_collected_kg;
      map.set(key, item);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, item]) => item);
  }, [filteredRows]);

  const aggregate = useMemo(() => {
    const by = (key: keyof EWasteRecord, metric: keyof EWasteRecord) => {
      const map = new Map<string, number>();
      filteredRows.forEach((row) => {
        const group = String(row[key]);
        map.set(group, (map.get(group) ?? 0) + Number(row[metric]));
      });
      return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    };
    return {
      states: by("state", "e_waste_collected_kg"),
      cities: by("city", "e_waste_collected_kg").slice(0, 10),
      methods: by("recycling_method", "material_recovered_kg").slice(0, 7),
      materials: by("primary_material", "material_recovered_kg"),
      sectors: by("sector", "estimated_revenue_inr"),
      types: (() => {
        const map = new Map<string, { collected: number; recovered: number }>();
        filteredRows.forEach((row) => {
          const current = map.get(row.e_waste_type) ?? { collected: 0, recovered: 0 };
          current.collected += row.e_waste_collected_kg;
          current.recovered += row.material_recovered_kg;
          map.set(row.e_waste_type, current);
        });
        return [...map.entries()].map(([name, value]) => ({ name, value: value.collected ? (value.recovered / value.collected) * 100 : 0 })).sort((a, b) => b.value - a.value);
      })(),
    };
  }, [filteredRows]);

  const shares = useMemo(() => [
    { name: "Formal", value: metrics.formal, color: CHART_COLORS.forest },
    { name: "Informal", value: metrics.informal, color: CHART_COLORS.saffron },
  ], [metrics.formal, metrics.informal]);

  const comparison = useMemo(() => {
    const weightedAverage = (metric: "compliance_score_pct" | "worker_safety_score_pct", sector: "formal" | "informal") => {
      const weightKey = sector === "formal" ? "formal_collected_kg" : "informal_collected_kg";
      const totalWeight = filteredRows.reduce((sum, row) => sum + row[weightKey], 0);
      return totalWeight
        ? filteredRows.reduce((sum, row) => sum + row[metric] * row[weightKey], 0) / totalWeight
        : 0;
    };
    return [
      { label: "Compliance", formal: weightedAverage("compliance_score_pct", "formal"), informal: weightedAverage("compliance_score_pct", "informal") },
      { label: "Worker safety", formal: weightedAverage("worker_safety_score_pct", "formal"), informal: weightedAverage("worker_safety_score_pct", "informal") },
    ];
  }, [filteredRows]);

  const searchedRows = useMemo(() => {
    const queryText = search.trim().toLowerCase();
    const matching = filteredRows.filter((row) => !queryText || [
      row.collection_month, row.city, row.state, row.e_waste_type, row.sector, row.collection_channel,
    ].join(" ").toLowerCase().includes(queryText));
    return [...matching].sort((a, b) => {
      const first = a[sortKey];
      const second = b[sortKey];
      const left = typeof first === "number" ? first : String(first);
      const right = typeof second === "number" ? second : String(second);
      const result = left < right ? -1 : left > right ? 1 : 0;
      return sortDirection === "asc" ? result : -result;
    });
  }, [filteredRows, search, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(searchedRows.length / pageSize));
  const tableRows = searchedRows.slice(page * pageSize, (page + 1) * pageSize);

  const setFilter = (key: FilterKey, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(0);
  };

  const resetFilters = () => {
    setFilters({ year: "", state: "", city: "", e_waste_type: "", sector: "", collection_channel: "" });
    setPage(0);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDirection((current) => current === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDirection("asc");
    }
    setPage(0);
  };

  const handleRefresh = () => {
    setIsSpinning(true);
    void query.refetch();
  };

  const lastRefreshed = query.dataUpdatedAt ? new Date(query.dataUpdatedAt).toLocaleString("en-IN", { hour: "numeric", minute: "2-digit", day: "numeric", month: "short" }) : null;
  const gridColor = isDark ? "rgba(255,255,255,0.09)" : "#dddcd3";
  const tickColor = isDark ? "#9db0aa" : "#697d76";
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const chartRows = (items: { name: string; value: number }[]) => items.map((item) => ({ category: item.name, value: Number(item.value.toFixed(2)) }));

  return (
    <div className="app-shell min-h-[100dvh] text-foreground">
      <aside className={`fixed inset-y-0 left-0 z-40 w-[232px] bg-sidebar px-5 py-6 text-sidebar-foreground transition-transform duration-200 lg:translate-x-0 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><Recycle className="h-5 w-5" /></div>
            <div>
              <p className="font-semibold tracking-tight">E-Waste</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/55">Intelligence</p>
            </div>
          </div>
          <button type="button" className="lg:hidden" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-12">
          <p className="eyebrow px-2 text-sidebar-foreground/45">Workspace</p>
          <nav className="mt-3 space-y-1">
            <button type="button" className="flex w-full items-center gap-3 rounded-lg bg-sidebar-accent px-3 py-2.5 text-left text-sm font-medium text-sidebar-accent-foreground"><Activity className="h-4 w-4 text-sidebar-primary" /> Overview</button>
            <button type="button" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-sidebar-foreground/65 transition hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"><MapPin className="h-4 w-4" /> Regional lens</button>
            <button type="button" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-sidebar-foreground/65 transition hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"><ShieldCheck className="h-4 w-4" /> Compliance watch</button>
          </nav>
        </div>
        <div className="absolute inset-x-5 bottom-6 rounded-xl border border-sidebar-border bg-sidebar-accent/45 p-3">
          <div className="flex items-center gap-2 text-[12px] font-medium"><span className="h-2 w-2 rounded-full bg-sidebar-primary" /> Dataset connected</div>
          <p className="mt-2 text-[11px] leading-relaxed text-sidebar-foreground/55">Synthetic India recovery records are ready for analysis.</p>
        </div>
      </aside>

      <main className="min-w-0 lg:pl-[232px]">
        <div className="mx-auto max-w-[1540px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <button type="button" className="mt-1 rounded-lg border border-border bg-card p-2 lg:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Menu className="h-4 w-4" /></button>
              <div>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-accent" /><p className="eyebrow text-primary/70">National recovery monitor</p></div>
                <h1 className="mt-2 text-[clamp(1.8rem,3vw,2.65rem)] font-semibold tracking-[-0.055em]">E-Waste Intelligence</h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">A decision-support view of formal and informal recovery across India.</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1"><Database className="h-3 w-3 text-primary" /> Uploaded dataset</span>
                  {lastRefreshed && <span>Last refresh {lastRefreshed}</span>}
                </div>
              </div>
            </div>
            <div className="print-hidden flex items-center gap-2">
              <div className="relative" ref={refreshRef}>
                <div className="flex h-9 overflow-hidden rounded-lg border border-border bg-card">
                  <button type="button" onClick={handleRefresh} disabled={loading} className="flex items-center gap-2 px-3 text-xs font-medium transition hover:bg-muted disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${isSpinning ? "animate-spin" : ""}`} /> Refresh</button>
                  <button type="button" onClick={() => setRefreshMenuOpen((open) => !open)} className="border-l border-border px-2 transition hover:bg-muted" aria-label="Auto-refresh options"><ChevronDown className="h-3.5 w-3.5" /></button>
                </div>
                {refreshMenuOpen && (
                  <div className="absolute right-0 top-11 z-30 w-52 rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-xl">
                    <div className="flex items-center justify-between border-b border-border px-2 pb-2">
                      <span className="text-xs font-medium">Auto-refresh</span>
                      <button type="button" role="switch" aria-checked={autoRefresh} onClick={() => setAutoRefresh((enabled) => !enabled)} className={`relative h-5 w-9 rounded-full transition ${autoRefresh ? "bg-primary" : "bg-muted"}`}><span className={`absolute top-1 h-3 w-3 rounded-full bg-background transition ${autoRefresh ? "left-5" : "left-1"}`} /></button>
                    </div>
                    <p className="px-2 pb-1 pt-2 text-[10px] uppercase tracking-wider text-muted-foreground">Interval</p>
                    {INTERVAL_OPTIONS.map((option) => <button type="button" key={option.ms} onClick={() => { setIntervalMs(option.ms); setAutoRefresh(true); setRefreshMenuOpen(false); }} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition hover:bg-muted"><span>{option.label}</span>{intervalMs === option.ms && autoRefresh && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}</button>)}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => window.print()} disabled={loading} className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-medium transition hover:border-primary/40 hover:text-primary disabled:opacity-40"><Printer className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Print / PDF</span></button>
              <button type="button" onClick={() => setIsDark((dark) => !dark)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card transition hover:border-primary/40 hover:text-primary" aria-label="Toggle dark mode">{isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
            </div>
          </header>

          <section className="data-card mb-5 rounded-xl p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Analysis filters</h2>{activeFilterCount > 0 && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{activeFilterCount} active</span>}</div>
              <button type="button" onClick={resetFilters} disabled={!activeFilterCount} className="text-xs font-medium text-muted-foreground transition hover:text-primary disabled:opacity-40">Reset all</button>
            </div>
            <div className="flex flex-wrap gap-3">
              <FilterSelect label="Year" value={filters.year} options={options.year} onChange={(value) => setFilter("year", value)} />
              <FilterSelect label="State" value={filters.state} options={options.state} onChange={(value) => setFilter("state", value)} />
              <FilterSelect label="City" value={filters.city} options={options.city} onChange={(value) => setFilter("city", value)} />
              <FilterSelect label="E-Waste type" value={filters.e_waste_type} options={options.e_waste_type} onChange={(value) => setFilter("e_waste_type", value)} />
              <FilterSelect label="Sector" value={filters.sector} options={options.sector} onChange={(value) => setFilter("sector", value)} />
              <FilterSelect label="Channel" value={filters.collection_channel} options={options.collection_channel} onChange={(value) => setFilter("collection_channel", value)} />
            </div>
          </section>

          {query.isError ? (
            <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"><div className="flex items-center gap-3"><AlertCircle className="h-5 w-5 text-destructive" /><div><p className="font-semibold">Dataset unavailable</p><p className="text-muted-foreground">We could not load the recovery records.</p></div></div><button type="button" onClick={handleRefresh} className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium">Retry</button></div>
          ) : null}

          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <MetricCard label="Total collected" value={formatMass(metrics.collected)} detail={`${filteredRows.length.toLocaleString()} records in view`} icon={Database} loading={loading} />
            <MetricCard label="Formal collection" value={formatMass(metrics.formal)} detail={`${metrics.collected ? formatPercent(metrics.formal / metrics.collected * 100) : "0.0%"} of collected`} icon={Factory} accent="slate" loading={loading} />
            <MetricCard label="Informal collection" value={formatMass(metrics.informal)} detail={`${metrics.collected ? formatPercent(metrics.informal / metrics.collected * 100) : "0.0%"} of collected`} icon={Users} accent="saffron" loading={loading} />
            <MetricCard label="Material recovered" value={formatMass(metrics.recovered)} detail="Recovered material mass" icon={Leaf} accent="forest" loading={loading} />
            <MetricCard label="Calculated recovery" value={formatPercent(metrics.rate)} detail="Total recovered / collected" icon={CheckCircle2} accent="forest" loading={loading} />
            <MetricCard label="Jobs supported" value={formatNumber(metrics.jobs)} detail="Estimated livelihoods enabled" icon={BriefcaseBusiness} accent="coral" loading={loading} />
          </div>

          <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.75fr)]">
            <ChartCard title="Monthly collection flow" eyebrow="Mass balance · kg" filename="monthly-collection-flow.csv" rows={monthlyData as unknown as Record<string, unknown>[]} isDark={isDark}>
              {loading ? <div className="h-[282px] animate-pulse rounded-lg bg-muted" /> : monthlyData.length ? <ResponsiveContainer width="100%" height={282}><ComposedChart data={monthlyData} margin={{ top: 10, right: 10, left: -16, bottom: 0 }}><defs><linearGradient id="totalFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CHART_COLORS.forest} stopOpacity={0.28} /><stop offset="100%" stopColor={CHART_COLORS.forest} stopOpacity={0.02} /></linearGradient></defs><CartesianGrid className="chart-grid" strokeDasharray="2 5" stroke={gridColor} vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false} tickFormatter={formatMassAxis} /><Tooltip contentStyle={{ borderRadius: 10, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))", fontSize: 12 }} formatter={(value: number) => formatMass(value)} /><Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} /><Area type="monotone" dataKey="total" name="Total" stroke={CHART_COLORS.forest} fill="url(#totalFill)" strokeWidth={2.5} isAnimationActive={false} /><Line type="monotone" dataKey="formal" name="Formal" stroke={CHART_COLORS.slate} strokeWidth={2} dot={false} isAnimationActive={false} /><Line type="monotone" dataKey="informal" name="Informal" stroke={CHART_COLORS.saffron} strokeWidth={2} dot={false} isAnimationActive={false} /></ComposedChart></ResponsiveContainer> : <EmptyChart />}
            </ChartCard>
            <ChartCard title="Formal vs informal share" eyebrow="Channel mix" filename="formal-informal-share.csv" rows={shares as unknown as Record<string, unknown>[]} isDark={isDark}>
              {loading ? <div className="h-[282px] animate-pulse rounded-lg bg-muted" /> : shares.some((item) => item.value > 0) ? <div className="flex h-[282px] flex-col items-center justify-center"><div className="relative h-[188px] w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={shares} dataKey="value" nameKey="name" innerRadius={61} outerRadius={88} paddingAngle={3} cornerRadius={3} stroke="none" isAnimationActive={false}>{shares.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip formatter={(value: number) => `${formatNumber(value)} kg`} contentStyle={{ borderRadius: 10, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", fontSize: 12 }} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="metric-number text-xl font-bold text-primary">{formatPercent(metrics.collected ? metrics.formal / metrics.collected * 100 : 0)}</span><span className="text-[10px] uppercase tracking-wider text-muted-foreground">formal</span></div></div><div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs">{shares.map((item) => <span key={item.name} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: item.color }} />{item.name}<strong>{metrics.collected ? formatPercent(item.value / metrics.collected * 100) : "0.0%"}</strong></span>)}</div></div> : <EmptyChart />}
            </ChartCard>
          </div>

          <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
            <ChartCard title="Collection by state" eyebrow="Geographic distribution" filename="collection-by-state.csv" rows={chartRows(aggregate.states)} isDark={isDark}>
              {loading ? <div className="h-[330px] animate-pulse rounded-lg bg-muted" /> : aggregate.states.length ? <ResponsiveContainer width="100%" height={330}><BarChart data={aggregate.states} layout="vertical" margin={{ left: 18, right: 16, top: 4, bottom: 4 }}><CartesianGrid className="chart-grid" strokeDasharray="2 5" horizontal={false} stroke={gridColor} /><XAxis type="number" tickFormatter={formatCompact} tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} /><YAxis dataKey="name" type="category" width={82} tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: "hsl(var(--muted) / 0.5)" }} formatter={(value: number) => `${formatNumber(value)} kg`} contentStyle={{ borderRadius: 10, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", fontSize: 12 }} /><Bar dataKey="value" name="Collected" fill={CHART_COLORS.forest} fillOpacity={0.84} radius={[0, 4, 4, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer> : <EmptyChart />}
            </ChartCard>
            <ChartCard title="Top 10 cities" eyebrow="Collection hotspots" filename="top-10-cities.csv" rows={chartRows(aggregate.cities)} isDark={isDark}>
              {loading ? <div className="h-[330px] animate-pulse rounded-lg bg-muted" /> : aggregate.cities.length ? <ResponsiveContainer width="100%" height={330}><BarChart data={aggregate.cities} margin={{ left: -10, right: 10, top: 8, bottom: 52 }}><CartesianGrid className="chart-grid" strokeDasharray="2 5" vertical={false} stroke={gridColor} /><XAxis dataKey="name" angle={-38} textAnchor="end" interval={0} tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} /><YAxis tickFormatter={formatCompact} tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: "hsl(var(--muted) / 0.5)" }} formatter={(value: number) => `${formatNumber(value)} kg`} contentStyle={{ borderRadius: 10, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", fontSize: 12 }} /><Bar dataKey="value" name="Collected" fill={CHART_COLORS.slate} fillOpacity={0.84} radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer> : <EmptyChart />}
            </ChartCard>
          </div>

          <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <ChartCard title="Recovery rate by e-waste type" eyebrow="Efficiency signal" filename="recovery-rate-by-type.csv" rows={chartRows(aggregate.types)} isDark={isDark}>
              {loading ? <div className="h-[310px] animate-pulse rounded-lg bg-muted" /> : aggregate.types.length ? <ResponsiveContainer width="100%" height={310}><BarChart data={aggregate.types} margin={{ left: 4, right: 14, top: 8, bottom: 44 }}><CartesianGrid className="chart-grid" strokeDasharray="2 5" vertical={false} stroke={gridColor} /><XAxis dataKey="name" angle={-32} textAnchor="end" interval={0} tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} /><Tooltip formatter={(value: number) => formatPercent(value)} contentStyle={{ borderRadius: 10, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", fontSize: 12 }} /><Bar dataKey="value" name="Recovery rate" fill={CHART_COLORS.coral} fillOpacity={0.85} radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer> : <EmptyChart />}
            </ChartCard>
            <ChartCard title="Recycling methods" eyebrow="Recovery pathway" filename="recycling-methods.csv" rows={chartRows(aggregate.methods)} isDark={isDark}>
              {loading ? <div className="h-[310px] animate-pulse rounded-lg bg-muted" /> : aggregate.methods.length ? <div className="grid h-[310px] grid-cols-[minmax(0,1fr)_125px] items-center gap-2"><ResponsiveContainer width="100%" height={270}><PieChart><Pie data={aggregate.methods} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={102} innerRadius={58} paddingAngle={2} cornerRadius={3} stroke="none" isAnimationActive={false}>{aggregate.methods.map((entry, index) => <Cell key={entry.name} fill={CHART_COLOR_LIST[index % CHART_COLOR_LIST.length]} />)}</Pie><Tooltip formatter={(value: number) => `${formatNumber(value)} kg`} contentStyle={{ borderRadius: 10, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", fontSize: 12 }} /></PieChart></ResponsiveContainer><div className="space-y-2 text-[11px]">{aggregate.methods.slice(0, 5).map((item, index) => <div key={item.name} className="flex items-start gap-2"><span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: CHART_COLOR_LIST[index % CHART_COLOR_LIST.length] }} /><span className="leading-tight">{item.name}</span></div>)}</div></div> : <EmptyChart />}
            </ChartCard>
          </div>

          <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
            <ChartCard title="Material recovery" eyebrow="Recovered composition" filename="material-recovery.csv" rows={chartRows(aggregate.materials)} isDark={isDark}>
              {loading ? <div className="h-[270px] animate-pulse rounded-lg bg-muted" /> : aggregate.materials.length ? <ResponsiveContainer width="100%" height={270}><BarChart data={aggregate.materials} margin={{ left: -10, right: 8, top: 8, bottom: 48 }}><CartesianGrid className="chart-grid" strokeDasharray="2 5" vertical={false} stroke={gridColor} /><XAxis dataKey="name" angle={-38} textAnchor="end" interval={0} tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} /><YAxis tickFormatter={formatCompact} tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} /><Tooltip formatter={(value: number) => `${formatNumber(value)} kg`} contentStyle={{ borderRadius: 10, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", fontSize: 12 }} /><Bar dataKey="value" name="Recovered" fill={CHART_COLORS.saffron} fillOpacity={0.85} radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer> : <EmptyChart />}
            </ChartCard>
            <ChartCard title="Compliance & worker safety" eyebrow="Operating conditions" filename="compliance-worker-safety.csv" rows={comparison as unknown as Record<string, unknown>[]} isDark={isDark}>
              {loading ? <div className="h-[270px] animate-pulse rounded-lg bg-muted" /> : <ResponsiveContainer width="100%" height={270}><BarChart data={comparison} margin={{ left: -10, right: 8, top: 8, bottom: 10 }}><CartesianGrid className="chart-grid" strokeDasharray="2 5" vertical={false} stroke={gridColor} /><XAxis dataKey="label" tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} /><Tooltip formatter={(value: number) => formatPercent(value)} contentStyle={{ borderRadius: 10, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", fontSize: 12 }} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="formal" name="Formal" fill={CHART_COLORS.forest} radius={[4, 4, 0, 0]} isAnimationActive={false} /><Bar dataKey="informal" name="Informal" fill={CHART_COLORS.saffron} radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer>}
            </ChartCard>
            <ChartCard title="Revenue by sector" eyebrow="Estimated value · INR" filename="revenue-by-sector.csv" rows={chartRows(aggregate.sectors)} isDark={isDark}>
              {loading ? <div className="h-[270px] animate-pulse rounded-lg bg-muted" /> : aggregate.sectors.length ? <ResponsiveContainer width="100%" height={270}><BarChart data={aggregate.sectors} margin={{ left: 2, right: 14, top: 10, bottom: 10 }}><CartesianGrid className="chart-grid" strokeDasharray="2 5" vertical={false} stroke={gridColor} /><XAxis dataKey="name" tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} /><YAxis tickFormatter={formatCompact} tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} /><Tooltip formatter={(value: number) => formatInr(value)} contentStyle={{ borderRadius: 10, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", fontSize: 12 }} /><Bar dataKey="value" name="Estimated revenue" fill={CHART_COLORS.lilac} fillOpacity={0.84} radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer> : <EmptyChart />}
            </ChartCard>
          </div>

          <section className="data-card mb-5 rounded-xl">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-5">
              <div><p className="eyebrow mb-1 text-primary/75">Record explorer</p><h2 className="text-[15px] font-semibold">Collection records</h2><p className="mt-1 text-xs text-muted-foreground">Search, sort and inspect the rows behind the overview.</p></div>
              <div className="print-hidden flex items-center gap-2"><div className="relative"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><input type="search" placeholder="Search records" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} className="h-9 w-48 rounded-lg border border-input bg-background pl-9 pr-3 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 sm:w-64" /></div><button type="button" onClick={() => downloadCsv("e-waste-records.csv", searchedRows as unknown as Record<string, unknown>[])} disabled={!searchedRows.length} className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-medium transition hover:border-primary/40 hover:text-primary disabled:opacity-40"><Download className="h-3.5 w-3.5" /> Export rows</button></div>
            </div>
            {loading ? <div className="space-y-2 p-5"><div className="h-10 animate-pulse rounded bg-muted" />{[1, 2, 3, 4, 5].map((item) => <div key={item} className="h-11 animate-pulse rounded bg-muted/70" />)}</div> : (
              <>
                <div className="table-scroll overflow-x-auto">
                  <table className="w-full min-w-[980px] text-left text-sm">
                    <thead className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-[0.1em] text-muted-foreground"><tr>{([
                      ["collection_month", "Date"], ["city", "City"], ["state", "State"], ["e_waste_type", "E-Waste type"], ["sector", "Sector"], ["collection_channel", "Channel"], ["e_waste_collected_kg", "Collected"], ["material_recovered_kg", "Recovered"], ["recovery_rate_pct", "Recovery rate"],
                    ] as [SortKey, string][]).map(([key, label]) => <th key={key} className="whitespace-nowrap px-4 py-3 font-semibold"><button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1.5 transition hover:text-primary">{label}<ArrowUpDown className={`h-3 w-3 ${sortKey === key ? "text-primary" : "opacity-40"}`} /></button></th>)}</tr></thead>
                    <tbody className="divide-y divide-border/70">{tableRows.length ? tableRows.map((row) => <tr key={row.record_id} className="transition hover:bg-muted/30"><td className="whitespace-nowrap px-4 py-3 font-mono text-[12px] text-muted-foreground">{row.collection_month}</td><td className="px-4 py-3 font-medium">{row.city}</td><td className="px-4 py-3">{row.state}</td><td className="px-4 py-3">{row.e_waste_type}</td><td className="px-4 py-3">{row.sector}</td><td className="px-4 py-3"><span className="rounded-full bg-primary/8 px-2 py-1 text-[11px] text-primary">{row.collection_channel}</span></td><td className="px-4 py-3 font-mono text-[12px]">{formatNumber(row.e_waste_collected_kg)} kg</td><td className="px-4 py-3 font-mono text-[12px]">{formatNumber(row.material_recovered_kg)} kg</td><td className="px-4 py-3 font-mono text-[12px] font-semibold text-primary">{formatPercent(row.recovery_rate_pct)}</td></tr>) : <tr><td colSpan={9} className="h-40 text-center text-sm text-muted-foreground"><div className="flex flex-col items-center gap-2"><Search className="h-6 w-6 opacity-40" /><span>No records match the current view.</span></div></td></tr>}</tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4 text-xs text-muted-foreground"><span>Showing {searchedRows.length ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, searchedRows.length)} of {searchedRows.length} records</span><div className="flex items-center gap-2"><button type="button" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0} className="flex h-8 items-center gap-1 rounded-md border border-border px-2.5 transition hover:border-primary/40 hover:text-primary disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" /> Previous</button><span className="px-2 font-mono text-[11px]">Page {page + 1} / {totalPages}</span><button type="button" onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))} disabled={page >= totalPages - 1} className="flex h-8 items-center gap-1 rounded-md border border-border px-2.5 transition hover:border-primary/40 hover:text-primary disabled:opacity-40">Next <ChevronRight className="h-3.5 w-3.5" /></button></div></div>
              </>
            )}
          </section>

          <section className="flex flex-col gap-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-4 sm:flex-row sm:items-start sm:gap-4 sm:p-5"><div className="rounded-lg bg-primary/10 p-2.5 text-primary"><CircleHelp className="h-4 w-4" /></div><div><h2 className="text-sm font-semibold">About this dataset</h2><p className="mt-1 max-w-4xl text-xs leading-relaxed text-muted-foreground">This educational dataset models e-waste collection and recovery patterns across Indian cities. Formal and informal channels are represented to support comparative analysis; values are synthetic estimates for learning and scenario planning, not official national statistics.</p></div></section>
          <footer className="flex flex-wrap items-center justify-between gap-3 py-6 text-[11px] text-muted-foreground"><span>E-Waste Intelligence · India recovery workspace</span><span className="font-mono">{filteredRows.length.toLocaleString()} / {rows.length.toLocaleString()} records in view</span></footer>
        </div>
      </main>
    </div>
  );
}

function Router() {
  return (
    <ErrorBoundary resetKey={useLocation()[0]}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;