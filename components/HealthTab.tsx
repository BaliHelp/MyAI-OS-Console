'use client';

import { useState, useEffect, useCallback } from "react";
import { Activity, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle, Zap } from "lucide-react";
import { Language } from "@/lib/types";

interface ProviderKeyStatus {
  id: string;
  provider: string;
  label: string | null;
  status: 'active' | 'cooldown' | 'disabled';
  last_used_at: string | null;
  usage_count: number;
  error_count?: number;
}

interface ConnectionResult {
  id: string;
  provider: string;
  label: string | null;
  connected: boolean;
  details: string;
  displayName: string;
}

interface HealthTabProps {
  lang: Language;
  theme: 'dark' | 'light';
}

const PROVIDER_COLORS: Record<string, string> = {
  gemini: '#5B8DEF',
  gpt: '#10B981',
  claude: '#E879F9',
  grok: '#F59E0B',
  deepseek: '#6366F1',
};

export default function HealthTab({ lang, theme }: HealthTabProps) {
  const [providerKeys, setProviderKeys] = useState<ProviderKeyStatus[]>([]);
  const [connections, setConnections] = useState<ConnectionResult[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [loadingConn, setLoadingConn] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchProviderKeys = useCallback(async () => {
    setLoadingKeys(true);
    try {
      const res = await fetch("/api/provider-keys");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setProviderKeys(data);
      }
    } catch {}
    finally { setLoadingKeys(false); }
  }, []);

  const fetchConnections = useCallback(async () => {
    setLoadingConn(true);
    try {
      const res = await fetch("/api/provider-keys/test-all");
      if (res.ok) {
        const data = await res.json();
        // Only show active keys
        const counts: Record<string, number> = {};
        const getDisplayName = (p: string) => (p === 'gpt' ? 'OPENAI' : p.toUpperCase());
        const mapped: ConnectionResult[] = (data || [])
          .filter((item: any) => {
            const pk = providerKeys.find(k => k.id === item.id);
            return !pk || pk.status === 'active';
          })
          .map((item: any) => {
            counts[item.provider] = (counts[item.provider] || 0) + 1;
            return { ...item, displayName: `${getDisplayName(item.provider)} ${counts[item.provider]}` };
          });
        setConnections(mapped);
        setLastRefresh(new Date());
      }
    } catch {}
    finally { setLoadingConn(false); }
  }, [providerKeys]);

  useEffect(() => { fetchProviderKeys(); }, [fetchProviderKeys]);
  useEffect(() => { if (providerKeys.length >= 0) fetchConnections(); }, [providerKeys.length]);

  const activeKeys   = providerKeys.filter(k => k.status === 'active');
  const cooldownKeys = providerKeys.filter(k => k.status === 'cooldown');
  const disabledKeys = providerKeys.filter(k => k.status === 'disabled');

  const connectedCount  = connections.filter(c => c.connected).length;
  const failedCount     = connections.filter(c => !c.connected).length;

  const formatTime = (iso: string) => new Date(iso).toLocaleString(lang === 'id' ? 'id-ID' : 'en-US', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="space-y-6 animate-fade-in" id="health-tab">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold tracking-tight mb-1 text-bento-text-primary">Kesehatan Sistem</h3>
          <p className="text-xs text-bento-text-secondary">Status semua provider key dan koneksi API aktif</p>
        </div>
        <button
          onClick={() => { fetchProviderKeys(); fetchConnections(); }}
          disabled={loadingKeys || loadingConn}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border border-bento-border bg-bento-surface text-bento-text-secondary hover:text-bento-text-primary transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${(loadingKeys || loadingConn) ? 'animate-spin' : ''}`} />
          Refresh Semua
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Aktif", count: activeKeys.length, icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Cooldown", count: cooldownKeys.length, icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10" },
          { label: "Disabled", count: disabledKeys.length, icon: XCircle, color: "text-red-400", bg: "bg-red-500/10" },
          { label: "Live Check OK", count: connectedCount, icon: Zap, color: "text-bento-accent", bg: "bg-bento-accent-muted" },
        ].map(item => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="p-4 rounded-2xl border border-bento-border bg-bento-surface flex items-center gap-3">
              <div className={`p-2 rounded-xl ${item.bg} ${item.color} shrink-0`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <span className="text-2xl font-extrabold text-bento-text-primary">{item.count}</span>
                <p className="text-[10px] text-bento-text-secondary font-medium">{item.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Provider Keys Grid — Active Only (detailed) */}
      <div className="p-6 rounded-2xl border border-bento-border bg-bento-surface">
        <h4 className="font-bold text-sm tracking-tight mb-4 text-bento-text-primary flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          Provider Keys Aktif ({activeKeys.length})
        </h4>
        {activeKeys.length === 0 ? (
          <div className="py-8 text-center opacity-40 text-xs">Tidak ada provider key aktif</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeKeys.map(key => {
              const conn = connections.find(c => c.id === key.id);
              const providerColor = PROVIDER_COLORS[key.provider] ?? '#9CA3AF';
              return (
                <div key={key.id} className="p-4 rounded-xl border border-bento-border bg-bento-surface-lighter">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: providerColor }} />
                      <span className="text-xs font-bold text-bento-text-primary uppercase">{key.provider}</span>
                    </div>
                    {conn !== undefined ? (
                      conn.connected
                        ? <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg">LIVE ✓</span>
                        : <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-lg">ERROR</span>
                    ) : (
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-500/10 px-2 py-0.5 rounded-lg">—</span>
                    )}
                  </div>
                  <p className="text-[11px] text-bento-text-secondary truncate mb-2">{key.label || `Key ${key.id.substring(0,8)}`}</p>
                  <div className="flex items-center justify-between text-[10px] text-bento-text-secondary">
                    <span>{key.usage_count ?? 0}× used</span>
                    <span>{key.last_used_at ? formatTime(key.last_used_at) : 'Never'}</span>
                  </div>
                  {conn && !conn.connected && (
                    <p className="text-[10px] text-red-400 mt-1.5 truncate">{conn.details}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Non-active keys summary */}
      {(cooldownKeys.length > 0 || disabledKeys.length > 0) && (
        <div className="p-6 rounded-2xl border border-bento-border bg-bento-surface">
          <h4 className="font-bold text-sm tracking-tight mb-4 text-bento-text-primary flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Key Tidak Aktif
          </h4>
          <div className="space-y-2">
            {[...cooldownKeys, ...disabledKeys].map(key => (
              <div key={key.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-bento-border bg-bento-surface-lighter">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PROVIDER_COLORS[key.provider] ?? '#9CA3AF' }} />
                  <span className="text-xs font-medium text-bento-text-primary">{key.label || key.provider}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                  key.status === 'cooldown'
                    ? 'text-amber-400 bg-amber-500/10'
                    : 'text-red-400 bg-red-500/10'
                }`}>
                  {key.status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {lastRefresh && (
        <p className="text-[10px] text-bento-text-secondary text-center">
          Terakhir diperbarui: {lastRefresh.toLocaleTimeString(lang === 'id' ? 'id-ID' : 'en-US')}
        </p>
      )}
    </div>
  );
}
