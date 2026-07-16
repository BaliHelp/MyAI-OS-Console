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
  
  const totalCallsThisMonth = useMemo(() => {
    return logs.length;
  }, [logs]);

  const estimatedCost = useMemo(() => {
    // Arbitrary realistic calculation ($1.50 per 1M tokens average)
    const totalTokens = logs.reduce((sum, log) => sum + log.tokens_used, 0);
    return ((totalTokens / 1000000) * 1.5).toFixed(2);
  }, [logs]);

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
        <div className="col-span-1 md:col-span-6 lg:col-span-4 p-6 rounded-2xl border border-bento-border bg-bento-surface flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-bento-text-secondary uppercase tracking-wider">{t.cardTotalCalls}</span>
            <div className="p-2 rounded-xl bg-bento-accent-muted text-bento-accent">
              <Cpu className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold tracking-tight text-bento-text-primary" id="stat-total-calls">{totalCallsThisMonth}</span>
            <div className="text-[11px] text-bento-success font-semibold mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-bento-success animate-ping" />
              <span>realtime stream</span>
            </div>
          </div>
        </div>

        {/* Card 3: Active Applications & Keys (Stat 2) - Span 4 */}
        <div className="col-span-1 md:col-span-6 lg:col-span-4 p-6 rounded-2xl border border-bento-border bg-bento-surface flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-bento-text-secondary uppercase tracking-wider">{t.cardTotalApps}</span>
            <div className="p-2 rounded-xl bg-[#E879F9]/10 text-[#E879F9]">
              <AppWindow className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold tracking-tight text-bento-text-primary" id="stat-total-apps">{totalApps}</span>
            <p className="text-[11px] text-bento-text-secondary mt-1 font-medium">
              {activeKeys} of {apiKeys.length} active keys
            </p>
          </div>
        </div>

        {/* Card 4: Est Cost (Stat 3) - Span 4 */}
        <div className="col-span-1 md:col-span-6 lg:col-span-4 p-6 rounded-2xl border border-bento-border bg-bento-surface flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-bento-text-secondary uppercase tracking-wider">{t.cardEstCost}</span>
            <div className="p-2 rounded-xl bg-bento-success/10 text-bento-success">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold tracking-tight text-bento-text-primary" id="stat-est-cost">${estimatedCost}</span>
            <p className="text-[11px] text-bento-text-secondary mt-1 font-medium">
              USD • Within budget
            </p>
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
