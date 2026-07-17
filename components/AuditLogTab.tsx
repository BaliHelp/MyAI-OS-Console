'use client';

import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, RefreshCw, Filter, Clock, User, Target, ChevronRight } from "lucide-react";
import { Language } from "@/lib/types";

interface AuditEntry {
  id: string;
  action: string;
  actor_email: string | null;
  target_type: string | null;
  target_id: string | null;
  detail: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  login_success:        { label: "Login Sukses",        color: "text-emerald-400 bg-emerald-500/10" },
  login_failed:         { label: "Login Gagal",          color: "text-red-400 bg-red-500/10" },
  change_password:      { label: "Ganti Password",       color: "text-amber-400 bg-amber-500/10" },
  add_provider_key:     { label: "Tambah Provider Key",  color: "text-blue-400 bg-blue-500/10" },
  disable_provider_key: { label: "Nonaktifkan Provider Key", color: "text-orange-400 bg-orange-500/10" },
  enable_provider_key:  { label: "Aktifkan Provider Key", color: "text-emerald-400 bg-emerald-500/10" },
  create_api_key:       { label: "Buat API Key App",     color: "text-blue-400 bg-blue-500/10" },
  revoke_api_key:       { label: "Cabut API Key App",    color: "text-red-400 bg-red-500/10" },
  edit_persona:         { label: "Edit Persona",          color: "text-purple-400 bg-purple-500/10" },
  edit_field_spec:      { label: "Edit Field Spec",       color: "text-indigo-400 bg-indigo-500/10" },
  rotate_secret:        { label: "Rotasi Secret",         color: "text-red-400 bg-red-500/10" },
};

interface AuditLogTabProps {
  lang: Language;
  theme: 'dark' | 'light';
}

export default function AuditLogTab({ lang, theme }: AuditLogTabProps) {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50", offset: "0" });
      if (filterAction) params.set("action", filterAction);
      const res = await fetch(`/api/auditlog?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs ?? []);
        setTotal(data.total ?? 0);
      }
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    } finally {
      setLoading(false);
    }
  }, [filterAction]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };

  return (
    <div className="space-y-6 animate-fade-in" id="auditlog-tab">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold tracking-tight mb-1 text-bento-text-primary">Audit Log</h3>
          <p className="text-xs text-bento-text-secondary">Riwayat semua aksi sensitif oleh administrator</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Filter className="absolute left-2.5 top-2 h-3.5 w-3.5 text-bento-text-secondary" />
            <select
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
              className="pl-7 pr-3 py-1.5 text-xs rounded-xl border border-bento-border bg-bento-surface text-bento-text-primary focus:outline-none"
            >
              <option value="">Semua Aksi</option>
              {Object.entries(ACTION_LABELS).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-2 rounded-xl border border-bento-border bg-bento-surface text-bento-text-secondary hover:text-bento-text-primary transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-xs text-bento-text-secondary">
        <ShieldCheck className="h-4 w-4 text-bento-accent" />
        <span>{total} total entri dicatat</span>
        <span className="opacity-40">•</span>
        <span>Menampilkan 50 terbaru</span>
      </div>

      {/* Log Table */}
      <div className="rounded-2xl border border-bento-border bg-bento-surface overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-bento-text-secondary">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 opacity-40" />
            Memuat audit log...
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center opacity-50">
            <ShieldCheck className="h-10 w-10 mx-auto mb-2 stroke-1" />
            <p className="text-sm font-semibold">Belum ada log</p>
            <p className="text-xs mt-1">Aksi pertama akan muncul setelah ada interaksi admin.</p>
          </div>
        ) : (
          <div className="divide-y divide-bento-border">
            {logs.map(log => {
              const badge = ACTION_LABELS[log.action] ?? { label: log.action, color: "text-gray-400 bg-gray-500/10" };
              const isExpanded = expandedId === log.id;
              const hasDetail = log.detail && Object.keys(log.detail).length > 0;
              return (
                <div key={log.id} className="hover:bg-bento-surface-lighter transition-colors">
                  <div
                    className="flex items-center gap-3 px-5 py-3 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  >
                    <div className="shrink-0">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="flex items-center gap-1 text-[11px] text-bento-text-secondary col-span-2 sm:col-span-1">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span className="truncate">{formatTime(log.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-bento-text-secondary">
                        <User className="h-3 w-3 shrink-0" />
                        <span className="truncate">{log.actor_email ?? '—'}</span>
                      </div>
                      {log.target_type && (
                        <div className="flex items-center gap-1 text-[11px] text-bento-text-secondary">
                          <Target className="h-3 w-3 shrink-0" />
                          <span className="truncate font-mono">{log.target_type}</span>
                        </div>
                      )}
                      {log.ip_address && (
                        <div className="text-[11px] text-bento-text-secondary truncate font-mono">
                          {log.ip_address}
                        </div>
                      )}
                    </div>

                    {hasDetail && (
                      <ChevronRight className={`h-4 w-4 shrink-0 text-bento-text-secondary transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`} />
                    )}
                  </div>

                  {isExpanded && hasDetail && (
                    <div className="px-5 pb-3">
                      <pre className="text-[10px] font-mono bg-bento-surface-lighter rounded-xl p-3 overflow-x-auto text-bento-text-secondary">
                        {JSON.stringify(log.detail, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
