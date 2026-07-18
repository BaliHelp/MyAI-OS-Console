'use client';

import { useState, useEffect, useMemo } from "react";
import {
  Database, Filter, Search, ShieldAlert, FileText, Upload, Plus, ExternalLink,
  Calendar, FileCheck, CheckCircle, X, Download, ChevronDown, ChevronRight, Eye,
  ScanLine, Camera, Loader2
} from "lucide-react";
import { ClientApp, Language } from "@/lib/types";

interface DataCenterRecord {
  id: string;
  client_app_id: string | null;
  app_name: string;
  field_key: string | null;
  source_type: string;
  source_url: string | null;
  document_type: string | null;
  extracted_data: any;
  raw_text: string | null;
  language: string | null;
  tags: string[] | null;
  file_url: string | null;
  manual_review_required: boolean;
  confidence_score: number | null;
  created_at: string;
}

interface GroupKey {
  app_id: string | null;
  app_name: string;
  field_key: string | null;
}

interface DataCenterTabProps {
  lang: Language;
  theme: 'dark' | 'light';
}

const SOURCE_COLORS: Record<string, string> = {
  ocr_upload:          'text-bento-accent bg-bento-accent/10 border-bento-accent/20',
  manual_document:     'text-amber-400 bg-amber-500/10 border-amber-500/20',
  url_scrape:          'text-sky-400 bg-sky-500/10 border-sky-500/20',
  chat_memory_fact:    'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  chatbot_interaction: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  content_generation:  'text-pink-400 bg-pink-500/10 border-pink-500/20',
};
const SOURCE_DEFAULT = 'text-gray-400 bg-gray-500/10 border-gray-500/20';

function formatDate(iso: string, lang: Language) {
  return new Date(iso).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

function formatDateTime(iso: string, lang: Language) {
  return new Date(iso).toLocaleString(lang === 'id' ? 'id-ID' : 'en-US', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function groupRecords(records: DataCenterRecord[]) {
  const map = new Map<string, { key: GroupKey; records: DataCenterRecord[] }>();
  records.forEach(r => {
    const k = `${r.client_app_id ?? '__global__'}::${r.field_key ?? '__none__'}`;
    if (!map.has(k)) {
      map.set(k, { key: { app_id: r.client_app_id, app_name: r.app_name, field_key: r.field_key }, records: [] });
    }
    map.get(k)!.records.push(r);
  });
  return Array.from(map.values()).sort((a, b) => {
    const aLast = a.records[0].created_at;
    const bLast = b.records[0].created_at;
    return bLast.localeCompare(aLast);
  });
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function DataCenterTab({ lang, theme }: DataCenterTabProps) {
  const [records, setRecords] = useState<DataCenterRecord[]>([]);
  const [apps, setApps] = useState<ClientApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // UI State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSourceType, setFilterSourceType] = useState("all");
  const [filterAppId, setFilterAppId] = useState("all");
  const [showAddForm, setShowAddForm] = useState(false);

  // Popup state
  const [selectedGroup, setSelectedGroup] = useState<{ key: GroupKey; records: DataCenterRecord[] } | null>(null);

  // Form state
  const [formText, setFormText] = useState("");
  const [formDocType, setFormDocType] = useState("manual_document");
  const [formLang, setFormLang] = useState("id");
  const [formTags, setFormTags] = useState("");
  const [formFile, setFormFile] = useState<string | null>(null);
  const [formFileMime, setFormFileMime] = useState<string | null>(null);
  const [formFileName, setFormFileName] = useState("");

  // OCR Scan state
  const [showOcrScan, setShowOcrScan] = useState(false);
  const [ocrFile, setOcrFile] = useState<string | null>(null);
  const [ocrFileMime, setOcrFileMime] = useState<string | null>(null);
  const [ocrFileName, setOcrFileName] = useState("");
  const [ocrDocType, setOcrDocType] = useState("passport");
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resRecords, resApps] = await Promise.all([
        fetch("/api/data-center"),
        fetch("/api/apps")
      ]);
      const dataRecords = await resRecords.json();
      const dataApps = await resApps.json();
      if (Array.isArray(dataRecords)) setRecords(dataRecords);
      if (Array.isArray(dataApps)) setApps(dataApps);
    } catch (err) {
      console.error("Failed to load Data Center records:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormFileName(file.name);
    setFormFileMime(file.type);
    const reader = new FileReader();
    reader.onload = () => setFormFile(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const parsedTags = formTags.split(",").map(t => t.trim()).filter(t => t.length > 0);
      const res = await fetch("/api/data-center", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_text: formText || null, file: formFile || null, fileMimeType: formFileMime || null, tags: parsedTags, language: formLang, document_type: formDocType })
      });
      if (res.ok) {
        setFormText(""); setFormDocType("manual_document"); setFormLang("id"); setFormTags("");
        setFormFile(null); setFormFileMime(null); setFormFileName(""); setShowAddForm(false);
        loadData();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error || "Failed to save"}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // OCR Scan handler
  const handleOcrFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrFileName(file.name);
    setOcrFileMime(file.type);
    setOcrResult(null);
    setOcrError(null);
    const reader = new FileReader();
    reader.onload = () => setOcrFile(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleOcrScan = async () => {
    if (!ocrFile) return;
    setOcrScanning(true);
    setOcrResult(null);
    setOcrError(null);
    try {
      const res = await fetch("/api/data-center/ocr-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file: ocrFile,
          fileMimeType: ocrFileMime,
          documentType: ocrDocType,
          tags: [ocrDocType, "ocr_scan"],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "OCR gagal");
      setOcrResult(data.ocr_result);
      // Refresh data
      loadData();
    } catch (err: any) {
      setOcrError(err.message);
    } finally {
      setOcrScanning(false);
    }
  };

  const handleViewFile = async (filePath: string) => {
    try {
      const res = await fetch("/api/data-center/signed-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath })
      });
      const data = await res.json();
      if (data.signedUrl) window.open(data.signedUrl, "_blank");
      else alert("Gagal memuat file.");
    } catch { alert("Terjadi kesalahan."); }
  };

  // Download helpers
  const handleDownload = (records: DataCenterRecord[], format: 'json' | 'csv' | 'txt') => {
    const appName = records[0]?.app_name || 'data';
    const fieldKey = records[0]?.field_key || 'records';
    const filename = `datacenter_${appName}_${fieldKey}_${Date.now()}`;

    if (format === 'json') {
      downloadBlob(JSON.stringify(records, null, 2), `${filename}.json`, 'application/json');
    } else if (format === 'csv') {
      const headers = ['id','app_name','field_key','source_type','document_type','raw_text','created_at'];
      const rows = records.map(r => headers.map(h => JSON.stringify((r as any)[h] ?? '')).join(','));
      downloadBlob([headers.join(','), ...rows].join('\n'), `${filename}.csv`, 'text/csv');
    } else {
      const lines = records.map(r =>
        `--- Record ${r.id} ---\nApp: ${r.app_name}\nField: ${r.field_key || '-'}\nSource: ${r.source_type}\nDate: ${r.created_at}\nText: ${r.raw_text || '-'}\nExtracted: ${JSON.stringify(r.extracted_data)}\n`
      );
      downloadBlob(lines.join('\n'), `${filename}.txt`, 'text/plain');
    }
  };

  // Filtered & Grouped
  const filteredRecords = useMemo(() => records.filter(r => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || (r.document_type || '').toLowerCase().includes(q) ||
      (r.raw_text || '').toLowerCase().includes(q) ||
      (r.tags || []).some(t => t.toLowerCase().includes(q)) ||
      (r.app_name || '').toLowerCase().includes(q) ||
      (r.field_key || '').toLowerCase().includes(q);
    const matchSource = filterSourceType === 'all' || r.source_type === filterSourceType;
    const matchApp = filterAppId === 'all' || r.client_app_id === filterAppId || (filterAppId === 'internal' && r.client_app_id === null);
    return matchSearch && matchSource && matchApp;
  }), [records, searchQuery, filterSourceType, filterAppId]);

  const groups = useMemo(() => groupRecords(filteredRecords), [filteredRecords]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-bento-text-primary flex items-center gap-2.5">
            <Database className="h-6 w-6 text-bento-accent" />
            Data Center
          </h2>
          <p className="text-xs text-bento-text-secondary mt-1">
            Repositori data persisten — {records.length} record dari {groups.length} grup klien/field
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowOcrScan(!showOcrScan); setShowAddForm(false); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-white font-semibold text-sm hover:bg-emerald-600 transition-colors shadow-sm self-start"
          >
            <ScanLine className="h-4 w-4" />
            OCR Scan
          </button>
          <button
            onClick={() => { setShowAddForm(!showAddForm); setShowOcrScan(false); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-bento-accent text-white font-semibold text-sm hover:bg-bento-accent/90 transition-colors shadow-sm self-start"
          >
            <Plus className="h-4 w-4" />
            {lang === 'id' ? 'Tambah Dokumen Manual' : 'Add Manual Document'}
          </button>
        </div>
      </div>

      {/* OCR Scan Panel */}
      {showOcrScan && (
        <div className="p-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 shadow-xl">
          <h3 className="text-base font-bold text-bento-text-primary mb-4 flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-emerald-400" />
            OCR Scan Dokumen
            <span className="text-[10px] font-normal text-bento-text-secondary ml-2">Powered by Gemini Vision + Training Data</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-bento-text-secondary uppercase tracking-wider mb-2">Tipe Dokumen</label>
              <select
                value={ocrDocType}
                onChange={e => setOcrDocType(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-bento-border bg-bento-surface-lighter text-sm text-bento-text-primary focus:border-emerald-500 outline-none"
              >
                <option value="passport">Passport</option>
                <option value="visa">Visa</option>
                <option value="bank_statement">Bank Statement</option>
                <option value="flight_ticket">Flight Ticket</option>
                <option value="cv">Curriculum Vitae / CV</option>
                <option value="itinerary">Itinerary</option>
                <option value="contract">Letter of Contract</option>
                <option value="accommodation">Proof of Accommodation</option>
                <option value="photo">Recent Photo</option>
                <option value="stay_permit">Stay Permit (KITAS/KITAP)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-bento-text-secondary uppercase tracking-wider mb-2">Upload File</label>
              <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-emerald-500/40 hover:bg-bento-surface-lighter transition-colors cursor-pointer text-sm font-semibold text-bento-text-primary">
                <Camera className="h-4 w-4 text-emerald-400" />
                <span>{ocrFileName || 'Pilih gambar/PDF...'}</span>
                <input type="file" onChange={handleOcrFileChange} className="hidden" accept="image/*,application/pdf" />
              </label>
            </div>
          </div>

          {ocrFile && (
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleOcrScan}
                disabled={ocrScanning}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                {ocrScanning ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Scanning...</>
                ) : (
                  <><ScanLine className="h-4 w-4" /> Mulai Scan OCR</>
                )}
              </button>
              {ocrScanning && (
                <span className="text-xs text-emerald-400 font-semibold animate-pulse">Gemini Vision menganalisis dokumen...</span>
              )}
            </div>
          )}

          {ocrError && (
            <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-semibold">
              ❌ {ocrError}
            </div>
          )}

          {ocrResult && (
            <div className="mt-4 p-4 rounded-xl bg-bento-surface border border-emerald-500/20">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4" /> Scan Berhasil! Tersimpan ke Data Center
                </span>
                <span className="text-[10px] text-bento-text-secondary">
                  Confidence: {((ocrResult.confidence_score || 0) * 100).toFixed(0)}%
                </span>
              </div>
              {ocrResult.extracted_data?.extracted_fields && (
                <pre className="text-[10px] font-mono bg-bento-surface-lighter rounded-xl p-3 overflow-x-auto text-bento-text-primary max-h-48">
                  {JSON.stringify(ocrResult.extracted_data.extracted_fields, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="p-6 rounded-2xl border border-bento-border bg-bento-surface shadow-xl">
          <h3 className="text-base font-bold text-bento-text-primary mb-4 flex items-center gap-2">
            <Upload className="h-5 w-5 text-bento-accent" />
            Unggah Dokumen Manual
          </h3>
          <form onSubmit={handleAddDocument} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-bento-text-secondary uppercase tracking-wider mb-2">Document Type</label>
                <input type="text" required value={formDocType} onChange={e => setFormDocType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-bento-border bg-bento-surface-lighter text-sm text-bento-text-primary focus:border-bento-accent outline-none"
                  placeholder="e.g. passport, ktp, manual_document" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-bento-text-secondary uppercase tracking-wider mb-2">Language</label>
                <input type="text" required value={formLang} onChange={e => setFormLang(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-bento-border bg-bento-surface-lighter text-sm text-bento-text-primary focus:border-bento-accent outline-none"
                  placeholder="id, en" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-bento-text-secondary uppercase tracking-wider mb-2">Tags (pisah koma)</label>
                <input type="text" value={formTags} onChange={e => setFormTags(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-bento-border bg-bento-surface-lighter text-sm text-bento-text-primary focus:border-bento-accent outline-none"
                  placeholder="immigration, sponsor" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-bento-text-secondary uppercase tracking-wider mb-2">Konten Teks</label>
              <textarea value={formText} onChange={e => setFormText(e.target.value)} rows={4}
                className="w-full px-3 py-2.5 rounded-xl border border-bento-border bg-bento-surface-lighter text-sm text-bento-text-primary focus:border-bento-accent outline-none font-mono resize-y"
                placeholder="Paste raw text content here..." />
            </div>
            <div>
              <label className="block text-xs font-semibold text-bento-text-secondary uppercase tracking-wider mb-2">File Attachment (Image/PDF)</label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-bento-border hover:bg-bento-surface-lighter transition-colors cursor-pointer text-sm font-semibold text-bento-text-primary">
                  <Upload className="h-4 w-4 text-bento-accent" />
                  <span>Pilih File...</span>
                  <input type="file" onChange={handleFileChange} className="hidden" accept="image/*,application/pdf" />
                </label>
                {formFileName && (
                  <span className="text-xs text-bento-accent font-semibold flex items-center gap-1.5 bg-bento-accent/10 px-2.5 py-1 rounded-lg">
                    <FileText className="h-3.5 w-3.5" />{formFileName}
                  </span>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowAddForm(false)}
                className="px-4 py-2.5 rounded-xl border border-bento-border text-sm font-semibold text-bento-text-primary hover:bg-bento-surface-lighter transition-colors">
                Batal
              </button>
              <button type="submit" disabled={submitting}
                className="px-4 py-2.5 rounded-xl bg-bento-accent text-white font-semibold text-sm hover:bg-bento-accent/90 transition-colors disabled:opacity-50">
                {submitting ? "Menyimpan..." : "Simpan Dokumen"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-bento-text-secondary opacity-60" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-bento-border bg-bento-surface text-sm text-bento-text-primary focus:border-bento-accent outline-none"
            placeholder="Cari app, field, teks, tag..." />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-bento-text-secondary opacity-60 shrink-0" />
          <select value={filterSourceType} onChange={e => setFilterSourceType(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-bento-border bg-bento-surface text-sm text-bento-text-primary focus:border-bento-accent outline-none">
            <option value="all">Semua Source</option>
            <option value="ocr_upload">OCR Upload</option>
            <option value="url_scrape">URL Scrape</option>
            <option value="manual_document">Manual Document</option>
            <option value="chat_memory_fact">Chat Memory</option>
            <option value="chatbot_interaction">Chatbot Interaction</option>
            <option value="content_generation">Content Generation</option>
          </select>
          <select value={filterAppId} onChange={e => setFilterAppId(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-bento-border bg-bento-surface text-sm text-bento-text-primary focus:border-bento-accent outline-none">
            <option value="all">Semua App</option>
            <option value="internal">Internal / Global</option>
            {apps.map(app => <option key={app.id} value={app.id}>{app.name}</option>)}
          </select>
        </div>
      </div>

      {/* Card Grid */}
      {loading ? (
        <div className="py-20 text-center text-bento-text-secondary opacity-60">
          <Database className="h-10 w-10 mx-auto mb-3 animate-spin text-bento-accent" />
          <span className="text-sm">Memuat Data Center...</span>
        </div>
      ) : groups.length === 0 ? (
        <div className="py-20 text-center opacity-50">
          <Database className="h-12 w-12 mx-auto mb-3 stroke-1" />
          <p className="font-semibold text-base mb-1">Data Center Kosong</p>
          <p className="text-xs">Belum ada record atau tidak cocok dengan filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map(group => {
            const latest = group.records[0];
            const sourceCounts: Record<string, number> = {};
            group.records.forEach(r => { sourceCounts[r.source_type] = (sourceCounts[r.source_type] || 0) + 1; });
            const reviewCount = group.records.filter(r => r.manual_review_required).length;

            return (
              <div
                key={`${group.key.app_id}::${group.key.field_key}`}
                onClick={() => setSelectedGroup(group)}
                className="p-5 rounded-2xl border border-bento-border bg-bento-surface hover:border-bento-accent/40 hover:bg-bento-surface-lighter cursor-pointer transition-all duration-200 group"
              >
                {/* App Badge + Field */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs font-bold text-bento-accent truncate">{group.key.app_name}</p>
                    {group.key.field_key && (
                      <span className="text-[10px] font-mono text-bento-text-secondary bg-bento-surface-lighter px-1.5 py-0.5 rounded border border-bento-border mt-0.5 inline-block">
                        {group.key.field_key}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-extrabold text-bento-text-primary">{group.records.length}</span>
                    <p className="text-[9px] text-bento-text-secondary">record</p>
                  </div>
                </div>

                {/* Source type pills */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {Object.entries(sourceCounts).map(([src, count]) => (
                    <span key={src} className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${SOURCE_COLORS[src] || SOURCE_DEFAULT}`}>
                      {src.replace('_', ' ')} ×{count}
                    </span>
                  ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-[10px] text-bento-text-secondary">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(latest.created_at, lang)}
                  </span>
                  <div className="flex items-center gap-2">
                    {reviewCount > 0 && (
                      <span className="text-red-400 flex items-center gap-0.5">
                        <ShieldAlert className="h-3 w-3" />{reviewCount}
                      </span>
                    )}
                    <Eye className="h-3.5 w-3.5 text-bento-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Popup Modal */}
      {selectedGroup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setSelectedGroup(null); }}
        >
          <div className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-3xl border border-bento-border bg-[#0F1012] shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between p-6 border-b border-bento-border">
              <div>
                <h3 className="text-lg font-bold text-bento-text-primary">{selectedGroup.key.app_name}</h3>
                {selectedGroup.key.field_key && (
                  <span className="text-xs font-mono text-bento-text-secondary">{selectedGroup.key.field_key}</span>
                )}
                <p className="text-xs text-bento-text-secondary mt-1">{selectedGroup.records.length} record total</p>
              </div>
              <div className="flex items-center gap-2">
                {/* Download buttons */}
                {(['json', 'csv', 'txt'] as const).map(fmt => (
                  <button
                    key={fmt}
                    onClick={() => handleDownload(selectedGroup.records, fmt)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-bento-border bg-bento-surface hover:bg-bento-surface-lighter text-xs font-bold text-bento-text-secondary hover:text-bento-text-primary transition-all"
                  >
                    <Download className="h-3 w-3" />
                    {fmt.toUpperCase()}
                  </button>
                ))}
                <button
                  onClick={() => setSelectedGroup(null)}
                  className="p-2 rounded-xl hover:bg-bento-surface-lighter text-bento-text-secondary hover:text-bento-text-primary transition-all ml-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Records List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {selectedGroup.records.map((rec, idx) => (
                <div key={rec.id} className="rounded-2xl border border-bento-border bg-bento-surface p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${SOURCE_COLORS[rec.source_type] || SOURCE_DEFAULT}`}>
                        {rec.source_type.replace(/_/g, ' ')}
                      </span>
                      {rec.document_type && (
                        <span className="text-[9px] bg-bento-surface-lighter border border-bento-border px-2 py-0.5 rounded font-mono text-bento-text-secondary">
                          {rec.document_type}
                        </span>
                      )}
                      {rec.manual_review_required && (
                        <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                          <ShieldAlert className="h-3 w-3" />Review Required
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {rec.file_url && (
                        <button
                          onClick={() => handleViewFile(rec.file_url!)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg border border-bento-border hover:bg-bento-surface-lighter text-[10px] font-bold text-bento-text-secondary hover:text-bento-text-primary transition-all"
                        >
                          <ExternalLink className="h-3 w-3" />File
                        </button>
                      )}
                      <span className="text-[10px] text-bento-text-secondary">{formatDateTime(rec.created_at, lang)}</span>
                    </div>
                  </div>

                  {/* Raw text */}
                  {rec.raw_text && (
                    <div className="mb-3">
                      <p className="text-[10px] font-bold text-bento-text-secondary uppercase tracking-wider mb-1">Teks</p>
                      <p className="text-xs text-bento-text-primary font-mono bg-bento-surface-lighter rounded-xl p-3 max-h-32 overflow-y-auto">
                        {rec.raw_text}
                      </p>
                    </div>
                  )}

                  {/* Extracted data */}
                  {rec.extracted_data && Object.keys(rec.extracted_data).length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-bento-text-secondary uppercase tracking-wider mb-1">Data Terstruktur</p>
                      <pre className="text-[10px] font-mono bg-bento-surface-lighter rounded-xl p-3 overflow-x-auto text-bento-text-primary max-h-40">
                        {JSON.stringify(rec.extracted_data, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Tags */}
                  {(rec.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {rec.tags!.map((tag, i) => (
                        <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-bento-accent/5 border border-bento-accent/10 text-bento-accent font-bold">#{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
