'use client';

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Cpu, RefreshCw, AlertTriangle, Eye, Wrench } from "lucide-react";

interface ModelEntry {
  name: string;
  provider: string;
  model: string;
  description?: string;
  context_window?: string;
  pricing_per_million_tokens?: string;
  supports_vision: boolean;
  supports_tools: boolean;
  notes?: string;
  reasoning_level: "high" | "medium" | "low" | "none";
  recommended_for: string[];
  spec_label: string;
}

interface ModelsResponse {
  generated_at: string;
  models: ModelEntry[];
}

const REASONING_STYLE: Record<string, string> = {
  high: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  medium: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  low: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  none: "bg-gray-500/10 text-gray-400 border-gray-500/30",
};

const REASONING_LABEL: Record<string, string> = {
  high: "High — Reasoning",
  medium: "Medium",
  low: "Low",
  none: "None",
};

export default function ModelsPage() {
  const [data, setData] = useState<ModelsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // No synchronous setState at the top of this function — the initial mount effect below relies
  // on `loading` already starting `true`, and the refresh button sets it itself before calling
  // this (an event handler, not an effect body).
  const fetchModels = () => {
    fetch("/api/v1/models")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: ModelsResponse) => {
        setData(json);
        setError(null);
      })
      .catch((err) => setError(err.message || "Gagal memuat data"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    fetchModels();
  };

  const byProvider = useMemo(() => {
    if (!data?.models) return [];
    const groups = new Map<string, ModelEntry[]>();
    for (const m of data.models) {
      const list = groups.get(m.provider) || [];
      list.push(m);
      groups.set(m.provider, list);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

  return (
    <div className="min-h-screen bg-[#060709] text-white p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#5B8DEF]/10 text-[#5B8DEF]">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Model AI &amp; Harga</h1>
              <p className="text-xs text-gray-400">
                Daftar model AI yang live di MyAI OS Console — data real-time dari{" "}
                <code className="text-gray-300">GET /api/v1/models</code>
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#1D1E22] text-xs text-gray-300 hover:bg-white/5 disabled:opacity-50 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {data?.generated_at && (
          <p className="text-xs text-gray-500 mb-6">
            Diperbarui: {new Date(data.generated_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "medium" })}
          </p>
        )}

        {error && (
          <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/5 mb-8 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-200">Gagal memuat data model: {error}</p>
          </div>
        )}

        {loading && !data && (
          <div className="text-sm text-gray-500 py-12 text-center">Memuat data model...</div>
        )}

        <div className="space-y-10">
          {byProvider.map(([provider, models]) => (
            <section key={provider}>
              <h2 className="text-base font-bold text-white mb-3">{provider}</h2>
              <div className="overflow-x-auto rounded-2xl border border-[#1D1E22]">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="bg-white/5 text-left text-xs text-gray-400 uppercase tracking-wide">
                      <th className="px-4 py-3 font-medium">Model</th>
                      <th className="px-4 py-3 font-medium">Tag</th>
                      <th className="px-4 py-3 font-medium">Harga (per 1M token)</th>
                      <th className="px-4 py-3 font-medium">Context</th>
                      <th className="px-4 py-3 font-medium">Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {models.map((m) => (
                      <tr key={m.model} className="border-t border-[#1D1E22] align-top hover:bg-white/[0.02]">
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs text-gray-200">{m.model}</div>
                          {m.description && (
                            <div className="text-xs text-gray-500 mt-1 max-w-xs">{m.description}</div>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            {m.supports_vision && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                                <Eye className="h-3 w-3" /> vision
                              </span>
                            )}
                            {m.supports_tools && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                                <Wrench className="h-3 w-3" /> tools
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] border ${REASONING_STYLE[m.reasoning_level]}`}>
                            {REASONING_LABEL[m.reasoning_level]}
                          </span>
                          {m.recommended_for.length > 0 && (
                            <div className="text-[11px] text-gray-500 mt-1.5">{m.recommended_for.join(", ")}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs max-w-[220px]">
                          <div className="flex items-center gap-2">
                            <span className={m.recommended_for.includes("cheapest_option") ? "text-emerald-300 font-semibold" : "text-gray-300"}>
                              {m.pricing_per_million_tokens || <span className="text-gray-600">—</span>}
                            </span>
                            {m.recommended_for.includes("cheapest_option") && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                Termurah
                              </span>
                            )}
                            {m.recommended_for.includes("premium_quality") && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                Premium
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                          {m.context_window || <span className="text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">
                          {m.notes || <span className="text-gray-600">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-[#1D1E22] flex items-center gap-4 text-xs">
          <Link href="/dashboard" className="text-[#5B8DEF] hover:underline">← Kembali ke Dashboard</Link>
          <a href="/api/v1/models" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-gray-200">
            Lihat JSON mentah →
          </a>
        </div>
      </div>
    </div>
  );
}
