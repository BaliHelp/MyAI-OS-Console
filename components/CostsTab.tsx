'use client';

import { useState, useMemo, useEffect } from "react";
import { DollarSign, TrendingDown, BarChart2, Clock, ChevronDown } from "lucide-react";
import { UsageLog, Language } from "@/lib/types";
import { translations } from "@/lib/i18n";

// ── Provider Cost Constants ─────────────────────────────────────────────────
// Price per 1,000,000 tokens (USD). Edit these constants to update pricing.
const PROVIDER_COSTS: Record<string, { input: number; output: number; label: string; color: string }> = {
  gemini:   { input: 0.075,  output: 0.30,  label: "Gemini",   color: "#5B8DEF" },
  gpt:      { input: 0.15,   output: 0.60,  label: "GPT-4o-mini", color: "#10B981" },
  claude:   { input: 3.00,   output: 15.00, label: "Claude 3.5 Sonnet", color: "#E879F9" },
  grok:     { input: 2.00,   output: 2.00,  label: "Grok",     color: "#F59E0B" },
  deepseek: { input: 0.14,   output: 0.28,  label: "Deepseek", color: "#6366F1" },
};
const DEFAULT_COST = { input: 1.00, output: 1.00, label: "Unknown", color: "#9CA3AF" };

type TimeRange = 'today' | '7d' | '30d' | '90d' | '180d' | '1y' | 'all';

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: 'today', label: 'Hari Ini' },
  { value: '7d',   label: '7 Hari' },
  { value: '30d',  label: '1 Bulan' },
  { value: '90d',  label: '3 Bulan' },
  { value: '180d', label: '6 Bulan' },
  { value: '1y',   label: '1 Tahun' },
  { value: 'all',  label: 'Semua' },
];

function getStartDate(range: TimeRange): Date | null {
  const now = new Date();
  switch (range) {
    case 'today': { const d = new Date(now); d.setHours(0,0,0,0); return d; }
    case '7d':    return new Date(now.getTime() - 7 * 86400000);
    case '30d':   return new Date(now.getTime() - 30 * 86400000);
    case '90d':   return new Date(now.getTime() - 90 * 86400000);
    case '180d':  return new Date(now.getTime() - 180 * 86400000);
    case '1y':    return new Date(now.getTime() - 365 * 86400000);
    case 'all':   return null;
  }
}

function calcCost(provider: string, tokens: number): number {
  // gw_usage_logs stores total tokens; we use a simple 50/50 split for input/output estimation
  const cfg = PROVIDER_COSTS[provider] ?? DEFAULT_COST;
  const inputTokens = Math.floor(tokens * 0.4);
  const outputTokens = tokens - inputTokens;
  return ((inputTokens * cfg.input) + (outputTokens * cfg.output)) / 1_000_000;
}

interface CostsTabProps {
  logs: UsageLog[];
  lang: Language;
  theme: 'dark' | 'light';
  onRefreshLogs?: () => void;
}

export default function CostsTab({ logs, lang, theme, onRefreshLogs }: CostsTabProps) {
  const t = translations[lang] as any;
  const [range, setRange] = useState<TimeRange>('30d');
  const [resetDate, setResetDate] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("myai_cost_reset_date");
    if (saved) setResetDate(saved);
  }, []);

  const handleResetLogs = () => {
    const msg = lang === 'id' 
      ? "Apakah Anda yakin ingin mereset tampilan estimasi biaya? Tindakan ini HANYA memfilter tampilan agar dimulai dari 0 (riwayat log di database tetap 100% utuh untuk bukti audit)." 
      : "Are you sure you want to reset the cost estimation display? This ONLY filters the display to start from 0 (database logs remain 100% intact for audit purposes).";
    
    if (!confirm(msg)) return;

    const nowIso = new Date().toISOString();
    localStorage.setItem("myai_cost_reset_date", nowIso);
    setResetDate(nowIso);
  };

  const filteredLogs = useMemo(() => {
    let result = logs;
    if (resetDate) {
      const resetTime = new Date(resetDate).getTime();
      result = result.filter(l => new Date(l.created_at).getTime() >= resetTime);
    }
    const start = getStartDate(range);
    if (!start) return result;
    return result.filter(l => new Date(l.created_at) >= start);
  }, [logs, range, resetDate]);

  const mainLogs = useMemo(() => filteredLogs.filter(l => l.app_name !== "Internal Sandbox"), [filteredLogs]);
  const sandboxLogs = useMemo(() => filteredLogs.filter(l => l.app_name === "Internal Sandbox"), [filteredLogs]);

  const providerStats = useMemo(() => {
    const map: Record<string, { tokens: number; calls: number; cost: number }> = {};
    mainLogs.forEach(log => {
      const p = log.provider || 'unknown';
      if (!map[p]) map[p] = { tokens: 0, calls: 0, cost: 0 };
      map[p].tokens += log.tokens_used;
      map[p].calls += 1;
      map[p].cost += calcCost(p, log.tokens_used);
    });
    return Object.entries(map)
      .map(([provider, stats]) => ({
        provider,
        ...stats,
        label: (PROVIDER_COSTS[provider] ?? DEFAULT_COST).label,
        color: (PROVIDER_COSTS[provider] ?? DEFAULT_COST).color,
      }))
      .sort((a, b) => b.cost - a.cost);
  }, [mainLogs]);

  const totalCost = providerStats.reduce((s, p) => s + p.cost, 0);
  const totalTokens = providerStats.reduce((s, p) => s + p.tokens, 0);
  const totalCalls = mainLogs.length;
  const maxCost = providerStats[0]?.cost ?? 1;

  const sandboxCost = useMemo(() => {
    return sandboxLogs.reduce((sum, log) => sum + calcCost(log.provider || 'unknown', log.tokens_used), 0);
  }, [sandboxLogs]);
  const sandboxTokens = useMemo(() => sandboxLogs.reduce((sum, log) => sum + log.tokens_used, 0), [sandboxLogs]);
  const sandboxCalls = sandboxLogs.length;

  return (
    <div className="space-y-6 animate-fade-in" id="costs-tab">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold tracking-tight mb-1 text-bento-text-primary">Estimasi Biaya AI</h3>
          <p className="text-xs text-bento-text-secondary">Kalkulasi berdasarkan token yang digunakan × harga estimasi per provider</p>
        </div>

        {/* Time Range Filter & Reset Button */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {TIME_RANGE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setRange(opt.value)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-150 border ${
                  range === opt.value
                    ? 'bg-bento-accent text-white border-bento-accent'
                    : 'bg-bento-surface border-bento-border text-bento-text-secondary hover:text-bento-text-primary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {resetDate && (
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem("myai_cost_reset_date");
                setResetDate(null);
              }}
              className="px-3.5 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-150 border border-bento-border bg-bento-surface text-bento-text-secondary hover:text-bento-text-primary"
            >
              Tampilkan Semua Riwayat (Undo Reset)
            </button>
          )}

          <button
            type="button"
            onClick={handleResetLogs}
            disabled={logs.length === 0}
            className="px-3.5 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-150 border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white disabled:opacity-40 disabled:hover:bg-red-500/10 disabled:hover:text-red-400"
          >
            Reset Data
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-bento-border bg-bento-surface">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-bento-text-secondary uppercase tracking-wider">Total Estimasi</span>
            <div className="p-2 rounded-xl bg-bento-success/10 text-bento-success"><DollarSign className="h-4 w-4" /></div>
          </div>
          <span className="text-3xl font-extrabold text-bento-text-primary">${totalCost.toFixed(4)}</span>
          <div className="mt-1 space-y-0.5">
            <p className="text-[10px] text-bento-text-secondary">USD • Estimasi, bukan tagihan aktual</p>
            {sandboxCalls > 0 && (
              <p className="text-[10px] text-amber-500 font-semibold">
                Sandbox/Testing: ${sandboxCost.toFixed(4)}
              </p>
            )}
          </div>
        </div>
        <div className="p-5 rounded-2xl border border-bento-border bg-bento-surface">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-bento-text-secondary uppercase tracking-wider">Total Token</span>
            <div className="p-2 rounded-xl bg-bento-accent-muted text-bento-accent"><BarChart2 className="h-4 w-4" /></div>
          </div>
          <span className="text-3xl font-extrabold text-bento-text-primary">{totalTokens.toLocaleString()}</span>
          <div className="mt-1 space-y-0.5">
            <p className="text-[10px] text-bento-text-secondary">{totalCalls} panggilan utama</p>
            {sandboxCalls > 0 && (
              <p className="text-[10px] text-amber-500 font-semibold">
                Sandbox/Testing: {sandboxTokens.toLocaleString()} ({sandboxCalls} calls)
              </p>
            )}
          </div>
        </div>
        <div className="p-5 rounded-2xl border border-bento-border bg-bento-surface">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-bento-text-secondary uppercase tracking-wider">Avg per Panggilan</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400"><TrendingDown className="h-4 w-4" /></div>
          </div>
          <span className="text-3xl font-extrabold text-bento-text-primary">
            ${totalCalls > 0 ? (totalCost / totalCalls).toFixed(6) : '0.000000'}
          </span>
          <div className="mt-1 space-y-0.5">
            <p className="text-[10px] text-bento-text-secondary">per request utama</p>
            {sandboxCalls > 0 && (
              <p className="text-[10px] text-amber-500 font-semibold">
                Sandbox Avg: ${(sandboxCost / sandboxCalls).toFixed(6)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Provider Breakdown */}
      <div className="p-6 rounded-2xl border border-bento-border bg-bento-surface">
        <h4 className="font-bold text-sm tracking-tight mb-5 text-bento-text-primary">Rincian per Provider</h4>

        {providerStats.length === 0 ? (
          <div className="text-center py-12 opacity-50">
            <DollarSign className="h-10 w-10 mx-auto mb-2 stroke-1" />
            <p className="text-sm font-semibold">Belum ada data penggunaan</p>
            <p className="text-xs mt-1">Ganti filter waktu atau tunggu panggilan AI pertama.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {providerStats.map(p => (
              <div key={p.provider}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="text-sm font-semibold text-bento-text-primary">{p.label}</span>
                    <span className="text-[10px] text-bento-text-secondary">{p.calls} panggilan</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-bento-text-primary">${p.cost.toFixed(4)}</span>
                    <span className="text-[10px] text-bento-text-secondary ml-2">{p.tokens.toLocaleString()} tok</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-bento-surface-lighter overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(p.cost / maxCost) * 100}%`, backgroundColor: p.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pricing Reference */}
      <div className="p-5 rounded-2xl border border-bento-border bg-bento-surface">
        <h4 className="font-bold text-xs tracking-tight mb-3 text-bento-text-secondary uppercase">Tabel Harga Referensi (per 1M token)</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-bento-text-secondary border-b border-bento-border">
                <th className="text-left pb-2 font-semibold">Provider</th>
                <th className="text-right pb-2 font-semibold">Input</th>
                <th className="text-right pb-2 font-semibold">Output</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bento-border">
              {Object.entries(PROVIDER_COSTS).map(([key, cfg]) => (
                <tr key={key} className="text-bento-text-primary">
                  <td className="py-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                    {cfg.label}
                  </td>
                  <td className="py-2 text-right font-mono">${cfg.input.toFixed(3)}</td>
                  <td className="py-2 text-right font-mono">${cfg.output.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-bento-text-secondary mt-3 italic">
          * Harga estimasi untuk perencanaan anggaran. Tagihan aktual dari masing-masing provider mungkin berbeda.
          Edit konstanta PROVIDER_COSTS di components/CostsTab.tsx untuk memperbarui.
        </p>
      </div>
    </div>
  );
}
