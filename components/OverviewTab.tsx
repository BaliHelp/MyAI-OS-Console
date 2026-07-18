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
  Key, 
  DollarSign, 
  Sparkles, 
  AlertCircle,
  FileText,
  Image,
  Volume2,
  Binary,
  RefreshCw
} from "lucide-react";
import { ClientApp, ApiKey, UsageLog, Language } from "@/lib/types";
import { translations } from "@/lib/i18n";

interface OverviewTabProps {
  apps: ClientApp[];
  apiKeys: ApiKey[];
  logs: UsageLog[];
  lang: Language;
  theme: 'dark' | 'light';
}

export default function OverviewTab({ apps, apiKeys, logs, lang, theme }: OverviewTabProps) {
  const t = translations[lang];

  // Connection Status Check States
  interface ApiConnection {
    id: string;
    provider: string;
    label: string | null;
    connected: boolean;
    details: string;
    displayName: string;
  }
  
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
        
        // Group and number them (e.g. OPENAI 1, OPENAI 2, GEMINI 1, etc.)
        const counts: Record<string, number> = {};
        const getProviderDisplayName = (p: string) => {
          if (p === 'gpt') return 'OPENAI';
          return p.toUpperCase();
        };

        const mapped: ApiConnection[] = (data || []).map((item: any) => {
          counts[item.provider] = (counts[item.provider] || 0) + 1;
          const displayName = `${getProviderDisplayName(item.provider)} ${counts[item.provider]}`;
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

  useEffect(() => {
    fetchConnectionStatuses();
  }, []);

  // Calculations for stats
  const totalApps = apps.length;
  const activeKeys = apiKeys.filter(k => k.status === 'active').length;
  
  const [appsListExpanded, setAppsListExpanded] = useState(false);

  const appActivityStats = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // Temukan aplikasi yang memiliki log dalam 7 hari terakhir (case-insensitive matching)
    const activeAppNames = new Set<string>();
    logs.forEach(log => {
      if (new Date(log.created_at) >= sevenDaysAgo && log.app_name) {
        activeAppNames.add(log.app_name.trim().toLowerCase());
      }
    });

    const list = apps.map(app => {
      const isActive = activeAppNames.has(app.name.trim().toLowerCase()) || 
                       activeAppNames.has(app.slug.trim().toLowerCase());
      return {
        id: app.id,
        name: app.name,
        isActive
      };
    });

    const activeCount = list.filter(item => item.isActive).length;

    return {
      list,
      activeCount,
      totalCount: apps.length
    };
  }, [apps, logs]);

  const providerBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;
    logs.forEach(log => {
      const p = (log.provider || "others").toLowerCase();
      counts[p] = (counts[p] || 0) + 1;
      total++;
    });

    const list = Object.entries(counts).map(([provider, count]) => {
      const percent = total > 0 ? Math.round((count / total) * 100) : 0;
      let displayName = provider.toUpperCase();
      if (provider === 'gpt') displayName = 'GPT';
      if (provider === 'gemini') displayName = 'Gemini';
      if (provider === 'claude') displayName = 'Claude';
      if (provider === 'grok') displayName = 'Grok';
      if (provider === 'deepseek') displayName = 'Deepseek';
      return {
        provider,
        displayName,
        count,
        percent
      };
    });

    // Urutkan berdasarkan frekuensi panggilan terbanyak
    list.sort((a, b) => b.count - a.count);
    return { list, total };
  }, [logs]);

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

  // Cost quick-tab state for Overview card
  const [costQuickTab, setCostQuickTab] = useState<'today' | '30d' | 'all'>('30d');

  const estimatedCost = useMemo(() => {
    const COSTS: Record<string, number> = { gemini: 0.075, gpt: 0.15, claude: 3.00, grok: 2.0, deepseek: 0.14 };
    const now = new Date();
    let filtered = logs;
    if (costQuickTab === 'today') {
      const start = new Date(now); start.setHours(0,0,0,0);
      filtered = logs.filter(l => new Date(l.created_at) >= start);
    } else if (costQuickTab === '30d') {
      const start = new Date(now.getTime() - 30 * 86400000);
      filtered = logs.filter(l => new Date(l.created_at) >= start);
    }

    const mainLogs = filtered.filter(l => l.app_name !== "Internal Sandbox");
    const sandboxLogs = filtered.filter(l => l.app_name === "Internal Sandbox");

    const mainCost = mainLogs.reduce((sum, log) => {
      const costPer1M = COSTS[log.provider] ?? 1.0;
      return sum + (log.tokens_used / 1_000_000) * costPer1M;
    }, 0);

    const sandboxCost = sandboxLogs.reduce((sum, log) => {
      const costPer1M = COSTS[log.provider] ?? 1.0;
      return sum + (log.tokens_used / 1_000_000) * costPer1M;
    }, 0);

    return {
      mainValue: mainCost.toFixed(4),
      mainCount: mainLogs.length,
      sandboxValue: sandboxCost.toFixed(4),
      sandboxCount: sandboxLogs.length
    };
  }, [logs, costQuickTab]);

  // Aggregate 14-day logs by provider for the chart
  const chartData = useMemo(() => {
    const days: { [key: string]: { dateStr: string; label: string; claude: number; gpt: number; gemini: number } } = {};
    
    // Initialize last 14 days
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      // Simple date label like "Jul 10" or "10 Jul"
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

    // Populate with data
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

  // Task type icon mapper
  const getTaskIcon = (type: string) => {
    switch (type) {
      case "text": return <FileText className="h-3.5 w-3.5 text-blue-400" />;
      case "image": return <Image className="h-3.5 w-3.5 text-pink-400" />;
      case "audio": return <Volume2 className="h-3.5 w-3.5 text-amber-400" />;
      default: return <Binary className="h-3.5 w-3.5 text-teal-400" />;
    }
  };

  const getProviderColor = (p: string) => {
    switch (p) {
      case "claude": return "orange";
      case "gpt": return "green";
      case "gemini": return "blue";
      default: return "slate";
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" id="overview-tab">
      {/* Tab Header */}
      <div>
        <h3 className="text-xl font-bold tracking-tight mb-1 text-bento-text-primary" id="ov-tab-header">{t.ovTitle}</h3>
        <p className="text-xs text-bento-text-secondary">{t.ovSubtitle}</p>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6" id="bento-grid-container">
        
        {/* Card 1: Main Graph (Recharts Area Chart) - Span 8, Height matches stacked stats */}
        <div className="col-span-1 md:col-span-12 lg:col-span-8 p-6 rounded-2xl border border-bento-border bg-bento-surface flex flex-col justify-between" id="usage-chart-container">
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

        {/* Card 2: Total API Calls (Stat 1) - Span 4 */}
        <div className="col-span-1 md:col-span-6 lg:col-span-4 p-6 rounded-2xl border border-bento-border bg-bento-surface flex flex-col justify-between transition-all duration-300">
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

          {/* Breakdown mini per provider */}
          <div className="mt-4 border-t border-bento-border/50 pt-3 space-y-2">
            <span className="text-[10px] font-bold text-bento-text-secondary uppercase tracking-wider">Breakdown Provider</span>
            <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
              {providerBreakdown.list.length === 0 ? (
                <p className="text-[10px] text-bento-text-secondary italic">Belum ada data panggilan.</p>
              ) : (
                providerBreakdown.list.map(item => {
                  const barColor = item.provider === 'claude' 
                    ? 'bg-[#E879F9]' 
                    : item.provider === 'gpt' 
                      ? 'bg-bento-success' 
                      : item.provider === 'gemini' 
                        ? 'bg-bento-accent' 
                        : item.provider === 'grok'
                          ? 'bg-amber-400'
                          : item.provider === 'deepseek'
                            ? 'bg-sky-400'
                            : 'bg-indigo-400';
                  return (
                    <div key={item.provider} className="space-y-0.5">
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-bento-text-primary">{item.displayName}</span>
                        <span className="text-bento-text-secondary">{item.count}x ({item.percent}%)</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-bento-surface-lighter overflow-hidden border border-bento-border/30">
                        <div className={`h-full ${barColor}`} style={{ width: `${item.percent}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Active Applications & Keys (Stat 2) - Span 4 */}
        <div className="col-span-1 md:col-span-6 lg:col-span-4 p-6 rounded-2xl border border-bento-border bg-bento-surface flex flex-col justify-between transition-all duration-300">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-bento-text-secondary uppercase tracking-wider">{t.cardTotalApps}</span>
              <div className="p-2 rounded-xl bg-[#E879F9]/10 text-[#E879F9]">
                <AppWindow className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-extrabold tracking-tight text-bento-text-primary" id="stat-total-apps">
                {appActivityStats.activeCount} <span className="text-sm font-normal text-bento-text-secondary">aktif dari {appActivityStats.totalCount}</span>
              </span>
              <div className="mt-2 space-y-1.5">
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
              className="text-[10px] font-bold text-bento-accent hover:underline flex items-center justify-between w-full focus:outline-none"
            >
              <span>{appsListExpanded ? "Sembunyikan Status" : "Lihat Status Aplikasi"}</span>
              <span className="text-xs">{appsListExpanded ? "▲" : "▼"}</span>
            </button>
            {appsListExpanded && (
              <div className="mt-2.5 max-h-[120px] overflow-y-auto pr-1 space-y-2 animate-fade-in">
                {appActivityStats.list.length === 0 ? (
                  <p className="text-[10px] text-bento-text-secondary italic">Belum ada aplikasi terdaftar.</p>
                ) : (
                  appActivityStats.list.map(app => (
                    <div key={app.id} className="flex items-center justify-between text-[11px] py-0.5">
                      <span className="font-semibold text-bento-text-primary truncate max-w-[150px]">{app.name}</span>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                        app.isActive 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' 
                          : 'bg-gray-500/10 text-gray-400 border border-gray-500/15'
                      }`}>
                        {app.isActive ? "Aktif" : "Belum Ada Aktivitas"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Card 4: Est Cost (Stat 3) - Span 4 with quick tabs */}
        <div className="col-span-1 md:col-span-6 lg:col-span-4 p-6 rounded-2xl border border-bento-border bg-bento-surface flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-bento-text-secondary uppercase tracking-wider">{t.cardEstCost}</span>
            <div className="p-2 rounded-xl bg-bento-success/10 text-bento-success">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          {/* Quick tabs */}
          <div className="flex gap-1 mt-3">
            {([['today','Harian'], ['30d','1 Bulan'], ['all','Semua']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setCostQuickTab(val)}
                className={`px-2 py-0.5 rounded-lg text-[9px] font-bold transition-all ${
                  costQuickTab === val ? 'bg-bento-success text-white' : 'text-bento-text-secondary hover:text-bento-text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-2">
            <span className="text-3xl font-extrabold tracking-tight text-bento-text-primary" id="stat-est-cost">${estimatedCost.mainValue}</span>
            <div className="mt-1 space-y-0.5">
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
        </div>

        {/* Real Time API Connection Card - Span 4 */}
        <div className="col-span-1 md:col-span-12 lg:col-span-4 p-6 rounded-2xl border border-bento-border bg-bento-surface flex flex-col justify-between" id="realtime-connections-card">
          <div>
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

            <div className="space-y-2.5 max-h-[195px] overflow-y-auto pr-1">
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
        </div>

        {/* Card 5: Recent Activity Logs - Span 6 */}
        <div className="col-span-1 md:col-span-12 lg:col-span-6 p-6 rounded-2xl border border-bento-border bg-bento-surface flex flex-col justify-between" id="recent-activity-container">
          <div>
            <div className="mb-4">
              <h4 className="font-bold text-base tracking-tight mb-1 text-bento-text-primary" id="recent-activity-title">{t.recentActivity}</h4>
              <p className="text-xs text-bento-text-secondary">{t.recentActivitySub}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-bento-border text-bento-text-secondary font-bold uppercase tracking-wider text-[10px]">
                    <th className="pb-3">{t.colApp}</th>
                    <th className="pb-3">{t.colProvider}</th>
                    <th className="pb-3">{t.colType}</th>
                    <th className="pb-3 text-right">{t.colTokens}</th>
                    <th className="pb-3 text-right">{t.colTime}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bento-border/50">
                  {logs.slice(0, 5).map((log, index) => (
                    <tr 
                      key={log.id || index}
                      className="hover:bg-bento-surface-lighter transition-colors"
                    >
                      <td className="py-3 font-semibold text-bento-text-primary">
                        {log.app_name || "Unknown App"}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wide ${
                            log.provider === 'gemini'
                              ? 'bg-bento-accent/10 text-bento-accent border border-bento-accent/15'
                              : log.provider === 'claude'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/15'
                                : 'bg-bento-success/10 text-bento-success border border-bento-success/15'
                          }`}>
                            {log.provider}
                          </span>
                          {log.ocr_fallback_to_gpt && (
                            <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 text-[8px] font-extrabold uppercase border border-red-500/20 animate-pulse">
                              Fallback to GPT
                            </span>
                          )}
                          {log.ocr_fallback_to_claude && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[8px] font-extrabold uppercase border border-amber-500/20 animate-pulse">
                              Fallback to Claude
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1 font-medium text-bento-text-secondary">
                          {getTaskIcon(log.task_type)}
                          <span className="capitalize">{log.task_type}</span>
                        </div>
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-bento-text-primary">
                        {log.tokens_used.toLocaleString()}
                      </td>
                      <td className="py-3 text-right text-bento-text-secondary">
                        {new Date(log.created_at).toLocaleTimeString(lang === 'id' ? 'id-ID' : 'en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Card 6: Application Health - Span 6 */}
        <div className="col-span-1 md:col-span-12 lg:col-span-6 p-6 rounded-2xl border border-bento-border bg-bento-surface flex flex-col justify-between" id="app-health-container">
          <div>
            <div className="mb-4">
              <h4 className="font-bold text-base tracking-tight mb-1 text-bento-text-primary">Application Network Health</h4>
              <p className="text-xs text-bento-text-secondary">Interactive monitoring of apps and their Gateway endpoints</p>
            </div>

            <div className="space-y-3">
              {apps.length === 0 ? (
                <div className="text-center py-6 text-xs text-bento-text-secondary">
                  No applications added yet. Go to Apps tab to register.
                </div>
              ) : (
                apps.map(app => (
                  <div key={app.id} className="flex items-center justify-between p-3.5 rounded-xl bg-bento-surface-lighter border border-bento-border hover:scale-[1.01] transition-transform">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-bento-accent-muted text-bento-accent">
                        <AppWindow className="h-4 w-4" />
                      </div>
                      <div>
                        <h5 className="font-bold text-xs text-bento-text-primary">{app.name}</h5>
                        <p className="text-[10px] text-bento-text-secondary font-medium uppercase tracking-wider mt-0.5">{app.tier || 'Standard'} Tier</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-bento-success/5 border border-bento-success/10 px-2.5 py-1 rounded-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-bento-success animate-pulse" />
                      <span className="text-[10px] text-bento-success font-bold uppercase tracking-wider">Active</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
