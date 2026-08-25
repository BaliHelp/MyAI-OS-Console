'use client';

import { useState, useMemo, useEffect } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";
import {
  AppWindow,
  Cpu,
  DollarSign,
  RefreshCw,
  Play,
  Pause
} from "lucide-react";
import { ClientApp, ApiKey, UsageLog, Language, ApiConnection } from "@/lib/types";
import { translations } from "@/lib/i18n";
import { estimateCostUsd } from "@/lib/pricing";
import { getProviderColor, getProviderDisplayName } from "@/lib/providerDisplay";
import NetworkGraph, { GraphNode, GraphEdge, GraphNodeKind } from "@/components/overview/NetworkGraph";
import RankingCard, { UsageRankRow, ActiveModelRow } from "@/components/overview/RankingCard";
import ActivityFeed from "@/components/overview/ActivityFeed";
import { useAutoTour } from "@/components/overview/useAutoTour";

interface OverviewTabProps {
  apps: ClientApp[];
  apiKeys: ApiKey[];
  logs: UsageLog[];
  lang: Language;
  theme: 'dark' | 'light';
}

interface LiveModelEntry {
  provider: string;
  model: string;
}

export default function OverviewTab({ apps, apiKeys, logs, lang, theme }: OverviewTabProps) {
  const t = translations[lang];

  const [connections, setConnections] = useState<ApiConnection[]>([]);
  const [loadingConn, setLoadingConn] = useState(false);

  // Provider key stats (gw_provider_keys)
  const [providerKeyStats, setProviderKeyStats] = useState<{ active: number; total: number } | null>(null);

  useEffect(() => {
    fetch("/api/provider-keys")
      .then(r => r.json())
      .then((data: any[]) => {
        if (Array.isArray(data)) {
          setProviderKeyStats({
            active: data.filter(k => k.status === 'active').length,
            total: data.length,
          });
        }
      })
      .catch(() => {});
  }, []);

  const fetchConnectionStatuses = async () => {
    setLoadingConn(true);
    try {
      const res = await fetch("/api/provider-keys/test-all");
      if (res.ok) {
        const data = await res.json();

        const counts: Record<string, number> = {};
        const getProviderDisplayLabel = (p: string) => {
          if (p === 'gpt') return 'OPENAI';
          return p.toUpperCase();
        };

        const mapped: ApiConnection[] = (data || []).map((item: any) => {
          counts[item.provider] = (counts[item.provider] || 0) + 1;
          const displayName = `${getProviderDisplayLabel(item.provider)} ${counts[item.provider]}`;
          return { ...item, displayName };
        });

        setConnections(mapped);
      }
    } catch (err) {
      console.error("Failed to fetch connection statuses:", err);
    } finally {
      setLoadingConn(false);
    }
  };

  // Deferred via queueMicrotask so the effect body itself never synchronously calls setState
  // (fetchConnectionStatuses sets loading state before its first await) —
  // react-hooks/set-state-in-effect.
  useEffect(() => {
    queueMicrotask(() => { fetchConnectionStatuses(); });
  }, []);

  // Live provider -> model routing, from the public /api/v1/models endpoint. Refreshed rarely
  // (that endpoint's own cache is 5 minutes) since routing config changes far less often than
  // usage logs — no reason to couple this to the activity feed's polling cadence.
  const [liveModels, setLiveModels] = useState<LiveModelEntry[] | null>(null);

  useEffect(() => {
    fetch("/api/v1/models")
      .then(r => r.json())
      .then((data: { models?: LiveModelEntry[] }) => {
        if (Array.isArray(data.models)) setLiveModels(data.models);
      })
      .catch(() => {});
  }, []);

  // Calculations for stats
  const activeKeys = apiKeys.filter(k => k.status === 'active').length;

  const [appsListExpanded, setAppsListExpanded] = useState(false);

  const appActivityStats = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Temukan aplikasi yang memiliki log dalam 7 hari terakhir + total panggilan real per nama
    // (case-insensitive matching) — dihitung sekali di sini agar tidak diulang lagi untuk graph.
    const activeAppNames = new Set<string>();
    const callCountByName: Record<string, number> = {};
    logs.forEach(log => {
      if (!log.app_name) return;
      const key = log.app_name.trim().toLowerCase();
      callCountByName[key] = (callCountByName[key] || 0) + 1;
      if (new Date(log.created_at) >= sevenDaysAgo) {
        activeAppNames.add(key);
      }
    });

    const list = apps.map(app => {
      const nameKey = app.name.trim().toLowerCase();
      const slugKey = app.slug.trim().toLowerCase();
      const isActive = activeAppNames.has(nameKey) || activeAppNames.has(slugKey);
      const callCount = (callCountByName[nameKey] || 0) + (nameKey !== slugKey ? (callCountByName[slugKey] || 0) : 0);
      return {
        id: app.id,
        name: app.name,
        isActive,
        callCount
      };
    });

    const activeCount = list.filter(item => item.isActive).length;

    return {
      list,
      activeCount,
      totalCount: apps.length
    };
  }, [apps, logs]);

  // Cost quick-tab state — juga dipakai sebagai window waktu untuk Ranking Card & Network Graph
  // supaya seluruh mid-section merefleksikan periode yang sama.
  const [costQuickTab, setCostQuickTab] = useState<'today' | '30d' | 'all'>('30d');

  const filteredLogsByCostTab = useMemo(() => {
    const now = new Date();
    if (costQuickTab === 'today') {
      const start = new Date(now); start.setHours(0, 0, 0, 0);
      return logs.filter(l => new Date(l.created_at) >= start);
    }
    if (costQuickTab === '30d') {
      const start = new Date(now.getTime() - 30 * 86400000);
      return logs.filter(l => new Date(l.created_at) >= start);
    }
    return logs;
  }, [logs, costQuickTab]);

  const providerBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    const tokens: Record<string, number> = {};
    let total = 0;

    filteredLogsByCostTab.forEach(log => {
      const p = (log.provider || "others").toLowerCase();
      counts[p] = (counts[p] || 0) + 1;
      tokens[p] = (tokens[p] || 0) + (log.tokens_used || 0);
      total++;
    });

    const list = Object.entries(counts).map(([provider, count]) => {
      const percent = total > 0 ? Math.round((count / total) * 100) : 0;
      const providerTokens = tokens[provider] || 0;
      const calculatedCost = providerTokens > 0
        ? estimateCostUsd(provider, providerTokens)
        : (count * 0.0001);

      return {
        provider,
        displayName: getProviderDisplayName(provider),
        count,
        tokens: providerTokens,
        costUsd: calculatedCost.toFixed(4),
        percent
      };
    });

    // Urutkan berdasarkan frekuensi panggilan terbanyak
    list.sort((a, b) => b.count - a.count);
    return { list, total };
  }, [filteredLogsByCostTab]);

  const trendStats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let thisMonthCount = 0;
    let lastMonthCount = 0;

    logs.forEach(log => {
      const d = new Date(log.created_at);
      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
        thisMonthCount++;
      } else if (
        (currentMonth === 0 && d.getFullYear() === currentYear - 1 && d.getMonth() === 11) ||
        (currentMonth > 0 && d.getFullYear() === currentYear && d.getMonth() === currentMonth - 1)
      ) {
        lastMonthCount++;
      }
    });

    let percent = 0;
    let isIncrease = true;
    let hasComparison = true;

    if (lastMonthCount > 0) {
      const diff = thisMonthCount - lastMonthCount;
      percent = Math.round((Math.abs(diff) / lastMonthCount) * 100);
      isIncrease = diff >= 0;
    } else {
      percent = thisMonthCount > 0 ? 100 : 0;
      isIncrease = true;
      hasComparison = thisMonthCount > 0;
    }

    return {
      thisMonthCount,
      lastMonthCount,
      percent,
      isIncrease,
      hasComparison
    };
  }, [logs]);

  const totalCallsThisMonth = useMemo(() => {
    return logs.length;
  }, [logs]);

  const estimatedCost = useMemo(() => {
    const mainLogs = filteredLogsByCostTab.filter(l => l.app_name !== "Internal Sandbox");
    const sandboxLogs = filteredLogsByCostTab.filter(l => l.app_name === "Internal Sandbox");

    const mainCost = mainLogs.reduce((sum, log) => sum + estimateCostUsd(log.provider, log.tokens_used), 0);
    const sandboxCost = sandboxLogs.reduce((sum, log) => sum + estimateCostUsd(log.provider, log.tokens_used), 0);

    return {
      mainValue: mainCost.toFixed(4),
      mainCount: mainLogs.length,
      sandboxValue: sandboxCost.toFixed(4),
      sandboxCount: sandboxLogs.length
    };
  }, [filteredLogsByCostTab]);

  // Aggregate 14-day logs by provider for the chart
  const chartData = useMemo(() => {
    const days: { [key: string]: { dateStr: string; label: string; claude: number; gpt: number; gemini: number } } = {};

    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      const dayNum = d.getDate();
      const monthStr = d.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { month: 'short' });
      const label = `${dayNum} ${monthStr}`;

      days[dateStr] = {
        dateStr,
        label,
        claude: 0,
        gpt: 0,
        gemini: 0
      };
    }

    logs.forEach(log => {
      const dateStr = log.created_at.split('T')[0];
      if (days[dateStr]) {
        if (log.provider === 'claude') days[dateStr].claude += 1;
        else if (log.provider === 'gpt') days[dateStr].gpt += 1;
        else if (log.provider === 'gemini') days[dateStr].gemini += 1;
      }
    });

    return Object.values(days);
  }, [logs, lang]);

  // ── Network graph + ranking data (real: apps/keys/logs; live routing: /api/v1/models) ────

  const appProviderCounts = useMemo(() => {
    const map: Record<string, number> = {};
    apps.forEach(app => {
      const nameKey = app.name.trim().toLowerCase();
      const slugKey = app.slug.trim().toLowerCase();
      filteredLogsByCostTab.forEach(log => {
        const logName = (log.app_name || '').trim().toLowerCase();
        if (logName === nameKey || logName === slugKey) {
          const provider = (log.provider || 'others').toLowerCase();
          const key = `${app.id}::${provider}`;
          map[key] = (map[key] || 0) + 1;
        }
      });
    });
    return map;
  }, [apps, filteredLogsByCostTab]);

  const providerNodesData = useMemo(() => {
    const fromKeys = new Set<string>();
    apiKeys.forEach(k => { if (k.status === 'active') k.provider_scope.forEach(p => fromKeys.add(p)); });
    const fromLogs = new Set(providerBreakdown.list.map(p => p.provider));
    // Providers with a live routed model (e.g. google_tts_stt: has an active key but isn't
    // scoped to any app or used in any chat log yet) still need a node here — the graph draws a
    // Provider→Model edge for every entry in /api/v1/models, and d3-force crashes ("node not
    // found") if an edge references a provider id with no matching node.
    const fromLiveModels = new Set((liveModels || []).map(m => m.provider));
    const allProviders = new Set([...fromKeys, ...fromLogs, ...fromLiveModels]);
    const countByProvider: Record<string, number> = {};
    providerBreakdown.list.forEach(p => { countByProvider[p.provider] = p.count; });
    return Array.from(allProviders).map(provider => ({
      provider,
      count: countByProvider[provider] || 0,
    }));
  }, [apiKeys, providerBreakdown, liveModels]);

  // App tier and App→Provider edges share one hue (accent), Provider→Model edges and Model tier
  // share another (success) — a uniform two-tone "fan-in / fan-out" look (each side one color,
  // like the reference), with individual Provider nodes as the distinctly-colored junction
  // points where the two flows meet. CSS vars auto-adapt with theme, no per-theme recompute needed.
  const appGraphNodes: GraphNode[] = useMemo(() => appActivityStats.list.map(a => ({
    id: a.id,
    kind: 'app' as GraphNodeKind,
    label: a.name,
    weight: a.callCount,
    color: 'var(--accent)',
  })), [appActivityStats]);

  const providerGraphNodes: GraphNode[] = useMemo(() => providerNodesData.map(p => ({
    id: p.provider,
    kind: 'provider' as GraphNodeKind,
    label: getProviderDisplayName(p.provider),
    weight: p.count,
    color: getProviderColor(p.provider),
  })), [providerNodesData]);

  const appProviderEdges: GraphEdge[] = useMemo(() => {
    const edges: GraphEdge[] = [];
    apps.forEach(app => {
      const scopesForApp = new Set<string>();
      apiKeys
        .filter(k => k.client_app_id === app.id && k.status === 'active')
        .forEach(k => k.provider_scope.forEach(p => scopesForApp.add(p)));

      providerNodesData.forEach(p => {
        const count = appProviderCounts[`${app.id}::${p.provider}`] || 0;
        if (scopesForApp.has(p.provider) || count > 0) {
          edges.push({
            id: `ap:${app.id}:${p.provider}`,
            sourceId: app.id,
            targetId: p.provider,
            weight: count,
            color: 'var(--accent)',
          });
        }
      });
    });
    return edges;
  }, [apps, apiKeys, providerNodesData, appProviderCounts]);

  const liveModelGraphData = useMemo(() => {
    const modelNodes: GraphNode[] = [];
    const providerModelEdges: GraphEdge[] = [];
    const activeModelByProvider = new Map<string, ActiveModelRow>();
    const seenNodeIds = new Set<string>();

    (liveModels || []).forEach(m => {
      const nodeId = `model:${m.provider}:${m.model}`;
      if (!seenNodeIds.has(nodeId)) {
        seenNodeIds.add(nodeId);
        modelNodes.push({ id: nodeId, kind: 'model', label: m.model, weight: 0, color: 'var(--success)' });
      }
      providerModelEdges.push({
        id: `pm:${m.provider}:${m.model}`,
        sourceId: m.provider,
        targetId: nodeId,
        weight: null,
        color: 'var(--success)',
      });
      if (!activeModelByProvider.has(m.provider)) {
        activeModelByProvider.set(m.provider, {
          provider: m.provider,
          displayName: getProviderDisplayName(m.provider),
          model: m.model,
        });
      }
    });

    return { modelNodes, providerModelEdges, activeModelRows: Array.from(activeModelByProvider.values()) };
  }, [liveModels]);

  const usageRankRows: UsageRankRow[] = providerBreakdown.list;

  // ── Auto Tour: cycles highlight across top providers, synced between Ranking Card & Graph ──
  const tourProviderIds = useMemo(() => providerBreakdown.list.slice(0, 5).map(p => p.provider), [providerBreakdown]);
  const tour = useAutoTour(tourProviderIds, 4500);
  const [manualSelection, setManualSelection] = useState<string | null>(null);
  const highlightedId = manualSelection ?? tour.current;

  const selectHighlight = (id: string) => {
    setManualSelection(id);
    tour.pause();
  };

  const toggleTour = () => {
    if (tour.isPaused) {
      setManualSelection(null);
      tour.resume();
    } else {
      tour.pause();
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in" id="overview-tab">
      {/* Tab Header */}
      <div>
        <h3 className="text-xl font-bold tracking-tight mb-1 text-bento-text-primary" id="ov-tab-header">{t.ovTitle}</h3>
        <p className="text-xs text-bento-text-secondary">{t.ovSubtitle}</p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4" id="kpi-strip">
        <div className="p-3 sm:p-4 rounded-2xl border border-bento-border bg-bento-surface">
          <span className="text-[10px] font-bold text-bento-text-secondary uppercase tracking-wider">{t.cardTotalCalls}</span>
          <div className="mt-1 text-lg sm:text-2xl font-extrabold text-bento-text-primary">{totalCallsThisMonth}</div>
          {trendStats.hasComparison ? (
            <span className={`text-[10px] font-semibold ${trendStats.isIncrease ? 'text-bento-success' : 'text-red-400'}`}>
              {trendStats.isIncrease ? '↑' : '↓'} {trendStats.percent}%
            </span>
          ) : (
            <span className="text-[10px] text-bento-text-secondary">—</span>
          )}
        </div>
        <div className="p-3 sm:p-4 rounded-2xl border border-bento-border bg-bento-surface">
          <span className="text-[10px] font-bold text-bento-text-secondary uppercase tracking-wider">{t.cardTotalApps}</span>
          <div className="mt-1 text-lg sm:text-2xl font-extrabold text-bento-text-primary">{apps.length}</div>
          <span className="text-[10px] text-bento-text-secondary">{appActivityStats.activeCount} {lang === 'id' ? 'aktif 7 hari' : 'active in 7d'}</span>
        </div>
        <div className="p-3 sm:p-4 rounded-2xl border border-bento-border bg-bento-surface">
          <span className="text-[10px] font-bold text-bento-text-secondary uppercase tracking-wider">{t.cardEstCost}</span>
          <div className="mt-1 text-lg sm:text-2xl font-extrabold text-bento-text-primary">${estimatedCost.mainValue}</div>
          <span className="text-[10px] text-bento-text-secondary">{costQuickTab === 'today' ? 'Harian' : costQuickTab === '30d' ? '30 Hari' : 'Semua'}</span>
        </div>
        <div className="p-3 sm:p-4 rounded-2xl border border-bento-border bg-bento-surface">
          <span className="text-[10px] font-bold text-bento-text-secondary uppercase tracking-wider">{lang === 'id' ? 'Provider Online' : 'Providers Online'}</span>
          <div className="mt-1 text-lg sm:text-2xl font-extrabold text-bento-text-primary">
            {connections.filter(c => c.connected).length}/{connections.length}
          </div>
          <span className="text-[10px] text-bento-text-secondary">{providerKeyStats ? `${providerKeyStats.active}/${providerKeyStats.total} key aktif` : '—'}</span>
        </div>
      </div>

      {/* Mid Section: Ranking | Network Graph | Activity Feed.
          Mobile: stacked, graph first (hero). Tablet (md): graph full-width on top,
          ranking + feed side by side below. Desktop (lg): 3-across 3/6/3 split. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 md:gap-5 lg:gap-6" id="mid-section">
        <div className="order-2 md:order-2 lg:order-1 md:col-span-1 lg:col-span-3">
          <RankingCard
            usageRows={usageRankRows}
            activeModelRows={liveModelGraphData.activeModelRows}
            highlightedProvider={highlightedId}
            onSelectProvider={selectHighlight}
            lang={lang}
          />
        </div>

        <div
          className="order-1 md:order-1 lg:order-2 md:col-span-2 lg:col-span-6 p-4 sm:p-6 rounded-2xl border border-bento-border bg-bento-surface flex flex-col"
          id="network-graph-card"
        >
          <div className="flex items-center justify-between mb-3 gap-3">
            <div>
              <h4 className="font-bold text-sm sm:text-base tracking-tight mb-0.5 text-bento-text-primary">{t.networkGraphTitle}</h4>
              <p className="text-[10px] text-bento-text-secondary">{t.networkGraphSubtitle}</p>
              <p className="text-[9px] text-bento-text-secondary/70 italic mt-0.5">
                {lang === 'id' ? 'Klik node untuk menyorot koneksinya' : 'Click a node to highlight its connections'}
              </p>
            </div>
            <button
              type="button"
              onClick={toggleTour}
              className="flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-1.5 rounded-xl border border-bento-border bg-bento-surface-lighter text-bento-text-secondary hover:text-bento-text-primary transition-all shrink-0"
            >
              {tour.isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              {tour.isPaused ? t.autoTourPaused : t.autoTourLabel}
            </button>
          </div>
          <NetworkGraph
            appNodes={appGraphNodes}
            providerNodes={providerGraphNodes}
            modelNodes={liveModelGraphData.modelNodes}
            appProviderEdges={appProviderEdges}
            providerModelEdges={liveModelGraphData.providerModelEdges}
            highlightedId={highlightedId}
            onNodeClick={(id) => selectHighlight(id)}
            emptyAppsLabel={lang === 'id' ? 'Belum ada aplikasi' : 'No apps yet'}
            emptyProvidersLabel={lang === 'id' ? 'Belum ada provider' : 'No providers yet'}
            emptyModelsLabel={lang === 'id' ? 'Memuat...' : 'Loading...'}
            theme={theme}
          />
        </div>

        <div className="order-3 md:order-3 lg:order-3 md:col-span-1 lg:col-span-3">
          <ActivityFeed initialLogs={logs} connections={connections} lang={lang} />
        </div>
      </div>

      {/* Detail Cards */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6" id="bento-grid-container">

        {/* Usage chart */}
        <div className="col-span-1 md:col-span-12 lg:col-span-8 p-4 sm:p-6 rounded-2xl border border-bento-border bg-bento-surface flex flex-col justify-between" id="usage-chart-container">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h4 className="font-bold text-base tracking-tight mb-1 text-bento-text-primary" id="chart-title">{t.chartTitle}</h4>
                <p className="text-xs text-bento-text-secondary">{t.chartSubtitle}</p>
              </div>
              <div className="flex items-center gap-4 text-[11px] font-medium text-bento-text-secondary bg-bento-surface-lighter px-3 py-1.5 rounded-xl border border-bento-border">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#E879F9]" />
                  <span>Claude</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-bento-success" />
                  <span>GPT</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-bento-accent" />
                  <span>Gemini</span>
                </div>
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorClaude" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E879F9" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#E879F9" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorGpt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--success)" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="var(--success)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorGemini" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 9, fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--text-secondary)', fontSize: 9, fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    borderRadius: '12px',
                    color: 'var(--text-primary)',
                    fontSize: '11px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                />
                <Area type="monotone" dataKey="claude" stroke="#E879F9" strokeWidth={2.5} fillOpacity={1} fill="url(#colorClaude)" name="Claude API Calls" />
                <Area type="monotone" dataKey="gpt" stroke="var(--success)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorGpt)" name="GPT API Calls" />
                <Area type="monotone" dataKey="gemini" stroke="var(--accent)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorGemini)" name="Gemini API Calls" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Total API Calls detail */}
        <div className="col-span-1 md:col-span-6 lg:col-span-4 p-4 sm:p-6 rounded-2xl border border-bento-border bg-bento-surface flex flex-col justify-between transition-all duration-300">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-bento-text-secondary uppercase tracking-wider">{t.cardTotalCalls}</span>
              <div className="p-2 rounded-xl bg-bento-accent-muted text-bento-accent">
                <Cpu className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-extrabold tracking-tight text-bento-text-primary" id="stat-total-calls">{totalCallsThisMonth}</span>
              <div className="text-[11px] font-semibold mt-1 flex flex-wrap items-center gap-1.5">
                {trendStats.hasComparison ? (
                  <span className={trendStats.isIncrease ? 'text-bento-success' : 'text-red-400'}>
                    {trendStats.isIncrease ? '↑' : '↓'} {trendStats.percent}% {lang === 'id' ? 'dari bulan lalu' : 'from last month'}
                  </span>
                ) : (
                  <span className="text-bento-text-secondary">{lang === 'id' ? 'Belum ada pembanding' : 'No comparison data'}</span>
                )}
                <span className="text-gray-500/50">•</span>
                <div className="flex items-center gap-1 text-bento-success">
                  <span className="w-1.5 h-1.5 rounded-full bg-bento-success animate-ping" />
                  <span>realtime stream</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 border-t border-bento-border/50 pt-3 space-y-2">
            <span className="text-[10px] font-bold text-bento-text-secondary uppercase tracking-wider">Breakdown Provider</span>
            <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
              {providerBreakdown.list.length === 0 ? (
                <p className="text-[10px] text-bento-text-secondary italic">Belum ada data panggilan.</p>
              ) : (
                providerBreakdown.list.map(item => (
                  <div key={item.provider} className="space-y-0.5">
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="text-bento-text-primary">{item.displayName}</span>
                      <span className="text-bento-text-secondary">{item.count}x ({item.percent}%)</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-bento-surface-lighter overflow-hidden border border-bento-border/30">
                      <div className="h-full" style={{ width: `${item.percent}%`, backgroundColor: getProviderColor(item.provider) }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Total Aplikasi detail */}
        <div className="col-span-1 md:col-span-6 lg:col-span-4 p-4 sm:p-6 rounded-2xl border border-bento-border bg-bento-surface flex flex-col justify-between transition-all duration-300">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-bento-text-secondary uppercase tracking-wider">{t.cardTotalApps}</span>
              <div className="p-2 rounded-xl bg-[#E879F9]/10 text-[#E879F9]">
                <AppWindow className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-extrabold tracking-tight text-bento-text-primary" id="stat-total-apps">
                {apps.length}
              </span>
              <span className="text-sm font-normal text-bento-text-secondary ml-2">aplikasi terdaftar</span>
              <div className="mt-2 space-y-1.5">
                <p className="text-[11px] text-bento-text-secondary font-medium">
                  {appActivityStats.activeCount} aktif dalam 7 hari terakhir
                </p>
                <p className="text-[11px] text-bento-text-secondary font-medium">
                  {activeKeys} / {apiKeys.length} client API key aktif
                </p>
                {providerKeyStats && (
                  <p className="text-[11px] text-bento-text-secondary font-medium">
                    {providerKeyStats.active} / {providerKeyStats.total} provider key aktif
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 border-t border-bento-border/50 pt-3">
            <button
              type="button"
              onClick={() => setAppsListExpanded(!appsListExpanded)}
              className="text-[10px] font-bold text-bento-accent hover:underline flex items-center justify-between w-full focus:outline-none mb-2"
            >
              <span>{appsListExpanded ? "Sembunyikan Daftar" : "Lihat Semua Aplikasi"}</span>
              <span className="text-xs">{appsListExpanded ? "▲" : "▼"}</span>
            </button>
            <div className={`space-y-1.5 overflow-y-auto pr-1 transition-all duration-300 ${appsListExpanded ? 'max-h-[200px]' : 'max-h-[80px] overflow-hidden'}`}>
              {appActivityStats.list.length === 0 ? (
                <div className="text-center py-4 text-[11px] text-bento-text-secondary italic opacity-60">
                  Belum ada aplikasi terdaftar.
                </div>
              ) : (
                appActivityStats.list.map(app => (
                  <div key={app.id} className="flex items-center justify-between text-[11px] py-1 px-2 rounded-lg bg-bento-surface-lighter border border-bento-border/50">
                    <div className="flex items-center gap-2">
                      <AppWindow className="h-3 w-3 text-bento-text-secondary shrink-0" />
                      <span className="font-semibold text-bento-text-primary truncate max-w-[140px]">{app.name}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                      app.isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                        : 'bg-gray-500/10 text-gray-400 border border-gray-500/15'
                    }`}>
                      {app.isActive ? "AKTIF" : "IDLE"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Estimasi Biaya detail */}
        <div className="col-span-1 md:col-span-6 lg:col-span-4 p-4 sm:p-6 rounded-2xl border border-bento-border bg-bento-surface flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-bento-text-secondary uppercase tracking-wider">{t.cardEstCost}</span>
            <div className="p-2 rounded-xl bg-bento-success/10 text-bento-success">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>

          <div className="flex gap-1 bg-bento-surface-lighter border border-bento-border p-0.5 rounded-xl w-fit">
            {([['today','Harian'], ['30d','1 Bulan'], ['all','Semua']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setCostQuickTab(val)}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  costQuickTab === val
                    ? 'bg-bento-success text-white shadow-sm'
                    : 'text-bento-text-secondary hover:text-bento-text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div>
            <span className="text-3xl font-extrabold tracking-tight text-bento-text-primary" id="stat-est-cost">${estimatedCost.mainValue}</span>
            <div className="mt-0.5 space-y-0.5">
              <p className="text-[11px] text-bento-text-secondary font-medium">
                USD • {estimatedCost.mainCount} panggilan
              </p>
              {parseFloat(estimatedCost.sandboxValue) > 0 && (
                <p className="text-[10px] text-amber-500 font-semibold">
                  Sandbox/Testing: ${estimatedCost.sandboxValue} ({estimatedCost.sandboxCount} calls)
                </p>
              )}
            </div>
          </div>

          {providerBreakdown.list.length > 0 && (
            <div className="border-t border-bento-border/50 pt-2 space-y-1.5">
              <span className="text-[9px] font-bold text-bento-text-secondary uppercase tracking-wider">Rincian Biaya Per Provider ({costQuickTab === 'today' ? 'Harian' : costQuickTab === '30d' ? '30 Hari' : 'Semua'})</span>
              {providerBreakdown.list.map(item => (
                <div key={item.provider} className="space-y-0.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-bento-text-primary">{item.displayName}</span>
                    <span className="text-bento-text-secondary font-mono font-semibold">{item.count}x · ${item.costUsd}</span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-bento-surface-lighter overflow-hidden border border-bento-border/30">
                    <div className="h-full" style={{ width: `${item.percent}%`, backgroundColor: getProviderColor(item.provider) }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Realtime API Status */}
        <div className="col-span-1 md:col-span-12 lg:col-span-4 p-4 sm:p-6 rounded-2xl border border-bento-border bg-bento-surface flex flex-col" id="realtime-connections-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-bold text-base tracking-tight mb-0.5 text-bento-text-primary">Realtime API Status</h4>
                <p className="text-[10px] text-bento-text-secondary">Status koneksi aktif ekosistem AI</p>
              </div>
              <button
                type="button"
                onClick={fetchConnectionStatuses}
                disabled={loadingConn}
                className="p-2 rounded-xl bg-bento-surface-lighter hover:bg-bento-surface border border-bento-border text-bento-text-secondary hover:text-bento-text-primary transition-all disabled:opacity-50 flex items-center gap-1.5 text-[10px] font-extrabold"
              >
                <RefreshCw className={`h-3 w-3 ${loadingConn ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
              {loadingConn && connections.length === 0 ? (
                <div className="text-center py-8 text-xs text-bento-text-secondary italic">
                  Memeriksa konektivitas API...
                </div>
              ) : connections.length === 0 ? (
                <div className="text-center py-8 text-xs text-bento-text-secondary italic opacity-60">
                  Tidak ada API key aktif yang terpasang.
                </div>
              ) : (
                connections.map(conn => (
                  <div key={conn.id} className="flex items-center justify-between p-2.5 rounded-xl bg-bento-surface-lighter border border-bento-border hover:scale-[1.01] transition-transform">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2 h-2 rounded-full ${
                        conn.connected
                          ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse'
                          : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                      }`} />
                      <div>
                        <span className="text-xs font-extrabold text-bento-text-primary block leading-none">
                          {conn.displayName}
                        </span>
                        <span className="text-[9px] text-bento-text-secondary font-medium mt-1 block leading-none">
                          {conn.label || conn.provider.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <span className={`text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                      conn.connected
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}>
                      {conn.connected ? "Connected" : conn.details}
                    </span>
                  </div>
                ))
              )}
            </div>
        </div>

        {/* Application Network Health */}
        <div className="col-span-1 md:col-span-12 p-4 sm:p-6 rounded-2xl border border-bento-border bg-bento-surface flex flex-col" id="app-health-container">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h4 className="font-bold text-base tracking-tight mb-1 text-bento-text-primary">Application Network Health</h4>
              <p className="text-xs text-bento-text-secondary">Status koneksi real-time berdasarkan API key aktif</p>
            </div>
            <span className="text-[9px] font-bold text-bento-success bg-bento-success/10 border border-bento-success/20 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-bento-success animate-ping" />
              Live
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {apps.length === 0 ? (
              <div className="col-span-full text-center py-6 text-xs text-bento-text-secondary opacity-60">
                Belum ada aplikasi. Tambah di tab Apps.
              </div>
            ) : (
              apps.map(app => {
                const appKeys = apiKeys.filter(k => k.client_app_id === app.id && k.status === 'active');
                const isConnected = appKeys.length > 0;
                const keyCount = appKeys.length;
                return (
                  <div key={app.id} className="flex items-center justify-between p-3.5 rounded-xl bg-bento-surface-lighter border border-bento-border hover:scale-[1.01] transition-transform">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${isConnected ? 'bg-bento-accent-muted text-bento-accent' : 'bg-gray-500/10 text-gray-500'}`}>
                        <AppWindow className="h-4 w-4" />
                      </div>
                      <div>
                        <h5 className="font-bold text-xs text-bento-text-primary">{app.name}</h5>
                        <p className="text-[10px] text-bento-text-secondary font-medium uppercase tracking-wider mt-0.5">
                          {app.tier || 'Standard'} Tier • {keyCount} key{keyCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    {isConnected ? (
                      <div className="flex items-center gap-2 bg-bento-success/5 border border-bento-success/10 px-2.5 py-1 rounded-lg">
                        <span className="w-1.5 h-1.5 rounded-full bg-bento-success animate-pulse" />
                        <span className="text-[10px] text-bento-success font-bold uppercase tracking-wider">Active</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 bg-gray-500/5 border border-gray-500/10 px-2.5 py-1 rounded-lg">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">No Key</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
