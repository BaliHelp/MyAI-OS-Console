'use client';

import { useState, useMemo } from "react";
import { Download, FileText, Search, Cpu, Database, Calendar, Binary, Image, Volume2 } from "lucide-react";
import { ClientApp, UsageLog, Language } from "@/lib/types";
import { translations } from "@/lib/i18n";

interface UsageTabProps {
  apps: ClientApp[];
  logs: UsageLog[];
  lang: Language;
  theme: 'dark' | 'light';
}

export default function UsageTab({ apps, logs, lang, theme }: UsageTabProps) {
  const t = translations[lang];

  // Filters state
  const [filterAppId, setFilterAppId] = useState<string>("all");
  const [filterProvider, setFilterProvider] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Filter logs logic
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Filter App
      if (filterAppId !== "all") {
        const matchedApp = apps.find(a => a.id === filterAppId);
        if (!matchedApp || log.app_name !== matchedApp.name) return false;
      }

      // Filter Provider
      if (filterProvider !== "all" && log.provider !== filterProvider) return false;

      // Filter Task Type
      if (filterType !== "all" && log.task_type !== filterType) return false;

      // Search Query
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const appNameMatch = log.app_name?.toLowerCase().includes(query);
        const providerMatch = log.provider?.toLowerCase().includes(query);
        const taskMatch = log.task_type?.toLowerCase().includes(query);
        if (!appNameMatch && !providerMatch && !taskMatch) return false;
      }

      return true;
    });
  }, [logs, apps, filterAppId, filterProvider, filterType, searchQuery]);

  // Export to CSV Function
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      alert("No logs to export!");
      return;
    }

    const headers = ["Log ID", "Application Name", "Provider", "Task Type", "Tokens Used", "Timestamp"];
    const rows = filteredLogs.map(log => [
      log.id,
      log.app_name || "Unknown",
      log.provider,
      log.task_type,
      log.tokens_used,
      log.created_at
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.map(val => `"${val}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `MyAI_OS_Usage_Logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Task type icon mapper
  const getTaskIcon = (type: string) => {
    switch (type) {
      case "text": return <FileText className="h-3.5 w-3.5 text-blue-400" />;
      case "image": return <Image className="h-3.5 w-3.5 text-pink-400" />;
      case "audio": return <Volume2 className="h-3.5 w-3.5 text-amber-400" />;
      default: return <Binary className="h-3.5 w-3.5 text-teal-400" />;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in" id="usage-tab">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold tracking-tight mb-1" id="usage-tab-header">{t.usageTitle}</h3>
          <p className="text-sm text-gray-500">{t.usageSubtitle}</p>
        </div>
        <button
          onClick={handleExportCSV}
          id="export-csv-btn"
          className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl border border-bento-border bg-bento-surface text-bento-text-secondary hover:text-bento-text-primary hover:bg-bento-surface-lighter shadow-xs transition-all duration-150"
        >
          <Download className="h-4 w-4" />
          <span>{t.btnExport}</span>
        </button>
      </div>

      {/* Filters Section */}
      <div className="p-5 rounded-2xl border border-bento-border bg-bento-surface grid grid-cols-1 md:grid-cols-4 gap-4" id="usage-filters-container">
        {/* Filter App */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-bento-text-secondary uppercase tracking-wider">{t.filterApp}</label>
          <select
            value={filterAppId}
            onChange={(e) => setFilterAppId(e.target.value)}
            id="filter-app-select"
            className="w-full px-3 py-2 text-xs rounded-xl border border-bento-border bg-bento-surface-lighter text-bento-text-primary focus:outline-none focus:border-bento-accent"
          >
            <option value="all" className="bg-bento-surface">{t.all} Applications</option>
            {apps.map(app => (
              <option key={app.id} value={app.id} className="bg-bento-surface">{app.name}</option>
            ))}
          </select>
        </div>

        {/* Filter Provider */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-bento-text-secondary uppercase tracking-wider">{t.filterProvider}</label>
          <select
            value={filterProvider}
            onChange={(e) => setFilterProvider(e.target.value)}
            id="filter-provider-select"
            className="w-full px-3 py-2 text-xs rounded-xl border border-bento-border bg-bento-surface-lighter text-bento-text-primary focus:outline-none focus:border-bento-accent"
          >
            <option value="all" className="bg-bento-surface">{t.all} Providers</option>
            <option value="gemini" className="bg-bento-surface">Gemini</option>
            <option value="gpt" className="bg-bento-surface">GPT</option>
            <option value="claude" className="bg-bento-surface">Claude</option>
          </select>
        </div>

        {/* Filter Task Type */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-bento-text-secondary uppercase tracking-wider">Filter Tipe Tugas</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            id="filter-type-select"
            className="w-full px-3 py-2 text-xs rounded-xl border border-bento-border bg-bento-surface-lighter text-bento-text-primary focus:outline-none focus:border-bento-accent"
          >
            <option value="all" className="bg-bento-surface">{t.all} Task Types</option>
            <option value="text" className="bg-bento-surface">Text Generation</option>
            <option value="image" className="bg-bento-surface">Image Generation</option>
            <option value="audio" className="bg-bento-surface">Audio Generation</option>
            <option value="embeddings" className="bg-bento-surface">Embeddings</option>
          </select>
        </div>

        {/* Search Input */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-bento-text-secondary uppercase tracking-wider">Cari kata kunci</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-bento-text-secondary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              id="usage-search-input"
              placeholder="Cari aplikasi atau tipe..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-bento-border bg-bento-surface-lighter text-bento-text-primary focus:outline-none focus:border-bento-accent"
            />
          </div>
        </div>
      </div>

      {/* Logs Table Card */}
      <div className="p-6 rounded-2xl border border-bento-border bg-bento-surface" id="logs-table-card">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold text-bento-text-secondary">Menampilkan {filteredLogs.length} entri logs</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-bento-border text-bento-text-secondary font-semibold">
                <th className="pb-3">Log ID</th>
                <th className="pb-3">{t.colApp}</th>
                <th className="pb-3">{t.colProvider}</th>
                <th className="pb-3">{t.colType}</th>
                <th className="pb-3 text-right">{t.colTokens}</th>
                <th className="pb-3 text-right">Timestamp (Waktu Lokal)</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400 opacity-60">
                    <Database className="h-8 w-8 mx-auto mb-2 text-gray-400 stroke-1" />
                    <span>Tidak ada log transaksi yang cocok dengan kriteria filter.</span>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr 
                    key={log.id}
                    className="border-b border-bento-border/50 hover:bg-bento-surface-lighter text-bento-text-primary transition-colors"
                  >
                    <td className="py-3 font-mono font-bold text-bento-text-secondary opacity-70">
                      {log.id}
                    </td>
                    <td className="py-3 font-semibold text-sm">
                      {log.app_name || "Unknown App"}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          log.provider === 'gemini'
                            ? 'bg-bento-accent/10 text-bento-accent border border-bento-accent/15'
                            : log.provider === 'claude'
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/15'
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
                      <div className="flex items-center gap-1.5 font-medium text-bento-text-primary opacity-90">
                        {getTaskIcon(log.task_type)}
                        <span className="capitalize">{log.task_type}</span>
                      </div>
                    </td>
                    <td className="py-3 text-right font-mono font-semibold text-bento-text-primary">
                      {log.tokens_used.toLocaleString()}
                    </td>
                    <td className="py-3 text-right text-bento-text-secondary">
                      {new Date(log.created_at).toLocaleString(lang === 'id' ? 'id-ID' : 'en-US')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
