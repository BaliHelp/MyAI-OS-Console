'use client';

import { useState, useMemo, FormEvent, useRef } from "react";
import { 
  Database, 
  Plus, 
  Edit3, 
  Trash2, 
  Save, 
  Sparkles, 
  Activity, 
  FileText, 
  Globe, 
  X,
  Check,
  Upload,
  Link,
  FileJson,
  FileSpreadsheet,
  BookOpen,
  ExternalLink,
  Download,
  RefreshCw
} from "lucide-react";
import { ClientApp, BusinessProfile, KnowledgeDocument, Language } from "@/lib/types";
import { translations } from "@/lib/i18n";

interface KnowledgeTabProps {
  apps: ClientApp[];
  profile: BusinessProfile;
  documents: KnowledgeDocument[];
  lang: Language;
  theme: 'dark' | 'light';
  onSaveProfile: (content: string) => Promise<void>;
  onAddDocument: (title: string, content: string, clientAppId: string | null) => Promise<void>;
  onEditDocument: (id: string, title: string, content: string, clientAppId: string | null) => Promise<void>;
  onDeleteDocument: (id: string) => Promise<void>;
}

export default function KnowledgeTab({
  apps,
  profile,
  documents,
  lang,
  theme,
  onSaveProfile,
  onAddDocument,
  onEditDocument,
  onDeleteDocument
}: KnowledgeTabProps) {
  const t = translations[lang];

  // Business Profile states
  const [profileContent, setProfileContent] = useState(profile.content);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Document filters
  const [docFilterAppId, setDocFilterAppId] = useState<string>("all");

  // Create/Edit Document Modal
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<KnowledgeDocument | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [docAppId, setDocAppId] = useState<string>("global");

  // AI Helper (Gemini) states
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSavedToKnowledge, setAiSavedToKnowledge] = useState(false);

  // File Import states
  const [importMode, setImportMode] = useState<'none' | 'file' | 'url'>('none');
  const [importUrl, setImportUrl] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importAppId, setImportAppId] = useState("global");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Refresh trigger for re-fetch after import
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileSuccess(false);
    try {
      await onSaveProfile(profileContent);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      alert("Failed to save business profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleOpenCreateDoc = () => {
    setEditingDoc(null);
    setDocTitle("");
    setDocContent("");
    setDocAppId("global");
    setIsDocModalOpen(true);
  };

  const handleOpenEditDoc = (doc: KnowledgeDocument) => {
    setEditingDoc(doc);
    setDocTitle(doc.title);
    setDocContent(doc.content);
    setDocAppId(doc.client_app_id || "global");
    setIsDocModalOpen(true);
  };

  const handleDocSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!docTitle || !docContent) return;
    const appId = docAppId === "global" ? null : docAppId;
    try {
      if (editingDoc) {
        await onEditDocument(editingDoc.id, docTitle, docContent, appId);
      } else {
        await onAddDocument(docTitle, docContent, appId);
      }
      setIsDocModalOpen(false);
    } catch (err) {
      alert("Failed to save knowledge document");
    }
  };

  // === File Import ===
  const handleFileImport = async (file: File) => {
    setImportLoading(true);
    setImportSuccess(null);
    setImportError(null);
    try {
      const content = await file.text();
      const res = await fetch("/api/knowledge/import-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          fileName: file.name,
          mimeType: file.type || "text/plain",
          clientAppId: importAppId === "global" ? null : importAppId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengimpor file");
      setImportSuccess(`✅ File "${file.name}" berhasil diimpor sebagai "${data.document?.title}"`);
      // Re-trigger parent refresh
      window.location.reload();
    } catch (err: any) {
      setImportError(err.message);
    } finally {
      setImportLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileImport(file);
  };

  // === URL Import ===
  const handleUrlImport = async () => {
    if (!importUrl.trim()) return;
    setImportLoading(true);
    setImportSuccess(null);
    setImportError(null);
    try {
      const res = await fetch("/api/knowledge/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: importUrl.trim(),
          clientAppId: importAppId === "global" ? null : importAppId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengimpor URL");
      setImportSuccess(`✅ URL "${importUrl}" berhasil dibaca dan disimpan sebagai "${data.document?.title}"`);
      setImportUrl("");
      window.location.reload();
    } catch (err: any) {
      setImportError(err.message);
    } finally {
      setImportLoading(false);
    }
  };

  // === AI Helper ===
  const handleAskGemini = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiResponse("");
    setAiSavedToKnowledge(false);

    // Detect URL in prompt
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urlsInPrompt = aiPrompt.match(urlRegex);

    try {
      if (urlsInPrompt && urlsInPrompt.length > 0) {
        // Auto-import URL and then answer
        const url = urlsInPrompt[0];
        setAiResponse(`🔍 Saya mendeteksi URL: ${url}\n\nSedang membaca halaman tersebut...`);
        
        try {
          const importRes = await fetch("/api/knowledge/import-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
          });
          const importData = await importRes.json();
          if (importRes.ok) {
            setAiSavedToKnowledge(true);
            setAiResponse(
              `✅ URL berhasil dibaca dan disimpan ke Knowledge Base!\n\nJudul: "${importData.document?.title}"\n\nKonten yang diekstrak:\n${(importData.document?.content || '').substring(0, 800)}...`
            );
          } else {
            throw new Error(importData.error);
          }
        } catch (urlErr: any) {
          setAiResponse(`⚠️ Gagal membaca URL: ${urlErr.message}`);
        }
      } else {
        // Regular Gemini knowledge query
        const response = await fetch("/api/gemini/query-knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: aiPrompt })
        });
        const data = await response.json();
        if (data.error) {
          setAiResponse(`Error: ${data.error}`);
        } else {
          setAiResponse(data.text || "Tidak ada jawaban.");
        }
      }
    } catch (err) {
      setAiResponse("Terjadi kesalahan saat menghubungi asisten AI.");
    } finally {
      setAiLoading(false);
    }
  };

  // Save AI response as knowledge document
  const handleSaveAiResponseAsDoc = async () => {
    if (!aiResponse) return;
    await onAddDocument(
      `[AI] ${aiPrompt.substring(0, 60)}${aiPrompt.length > 60 ? '...' : ''}`,
      aiResponse,
      null
    );
    setAiSavedToKnowledge(true);
    alert("✅ Jawaban AI berhasil disimpan ke Knowledge Base!");
  };

  // Filtered Documents
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      if (docFilterAppId === "all") return true;
      if (docFilterAppId === "global") return doc.client_app_id === null;
      return doc.client_app_id === docFilterAppId;
    });
  }, [documents, docFilterAppId]);

  return (
    <div className="space-y-8 animate-fade-in" id="knowledge-tab">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold tracking-tight mb-1" id="knowledge-tab-header">{t.knowledgeTitle}</h3>
          <p className="text-sm text-gray-500">{t.knowledgeSubtitle}</p>
        </div>
        {/* Import Panel Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setImportMode(importMode === 'file' ? 'none' : 'file')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all ${
              importMode === 'file'
                ? 'bg-bento-accent text-white border-bento-accent'
                : 'border-bento-border text-bento-text-secondary hover:text-bento-text-primary hover:bg-bento-surface-lighter'
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            Import File
          </button>
          <button
            onClick={() => setImportMode(importMode === 'url' ? 'none' : 'url')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all ${
              importMode === 'url'
                ? 'bg-sky-500 text-white border-sky-500'
                : 'border-bento-border text-bento-text-secondary hover:text-bento-text-primary hover:bg-bento-surface-lighter'
            }`}
          >
            <Link className="h-3.5 w-3.5" />
            Import URL
          </button>
        </div>
      </div>

      {/* === IMPORT PANEL === */}
      {importMode !== 'none' && (
        <div className="p-5 rounded-2xl border border-bento-border bg-bento-surface shadow-xl animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-sm text-bento-text-primary flex items-center gap-2">
              {importMode === 'file' ? (
                <><Upload className="h-4 w-4 text-bento-accent" /> Import File Pengetahuan (.txt, .csv, .json)</>
              ) : (
                <><Globe className="h-4 w-4 text-sky-400" /> Import dari URL (Baca Penuh & Simpan)</>
              )}
            </h4>
            <button onClick={() => { setImportMode('none'); setImportSuccess(null); setImportError(null); }}>
              <X className="h-4 w-4 text-bento-text-secondary hover:text-bento-text-primary" />
            </button>
          </div>

          {/* App Scope */}
          <div className="mb-3">
            <label className="text-[10px] font-bold text-bento-text-secondary uppercase tracking-wider mb-1.5 block">Lingkup Aplikasi</label>
            <select
              value={importAppId}
              onChange={e => setImportAppId(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-bento-border bg-bento-surface-lighter text-bento-text-primary focus:outline-none"
            >
              <option value="global">Global (Semua App)</option>
              {apps.map(app => <option key={app.id} value={app.id}>{app.name}</option>)}
            </select>
          </div>

          {importMode === 'file' ? (
            <div>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-bento-border hover:border-bento-accent rounded-xl p-8 text-center cursor-pointer transition-all group"
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-bento-text-secondary group-hover:text-bento-accent transition-colors" />
                <p className="text-sm font-semibold text-bento-text-primary">Klik untuk pilih file</p>
                <p className="text-xs text-bento-text-secondary mt-1">Mendukung: .txt, .csv, .json</p>
                <div className="flex justify-center gap-3 mt-3">
                  <span className="flex items-center gap-1 text-[10px] font-bold text-bento-text-secondary bg-bento-surface-lighter px-2 py-0.5 rounded border border-bento-border">
                    <FileText className="h-3 w-3" /> .txt
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-bento-text-secondary bg-bento-surface-lighter px-2 py-0.5 rounded border border-bento-border">
                    <FileSpreadsheet className="h-3 w-3" /> .csv
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-bento-text-secondary bg-bento-surface-lighter px-2 py-0.5 rounded border border-bento-border">
                    <FileJson className="h-3 w-3" /> .json
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.csv,.json,text/plain,text/csv,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="url"
                value={importUrl}
                onChange={e => setImportUrl(e.target.value)}
                placeholder="https://indonesianvisas.com/about atau URL apapun..."
                className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-bento-border bg-bento-surface-lighter text-bento-text-primary focus:outline-none focus:border-bento-accent"
                onKeyDown={e => e.key === 'Enter' && handleUrlImport()}
              />
              <button
                onClick={handleUrlImport}
                disabled={importLoading || !importUrl.trim()}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-sky-500 hover:bg-sky-600 text-white disabled:opacity-50 transition-all"
              >
                {importLoading ? <Activity className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                {importLoading ? 'Membaca...' : 'Baca & Simpan'}
              </button>
            </div>
          )}

          {importLoading && (
            <div className="mt-3 p-3 rounded-xl bg-bento-accent/5 border border-bento-accent/20 text-xs text-bento-accent font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 animate-spin shrink-0" />
              {importMode === 'file' ? 'Parsing file...' : 'Mengakses URL dan mengekstrak konten dengan AI...'}
            </div>
          )}
          {importSuccess && (
            <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-semibold">
              {importSuccess}
            </div>
          )}
          {importError && (
            <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-semibold">
              ❌ {importError}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Business Profile + AI Helper */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-6 rounded-2xl border border-bento-border bg-bento-surface flex flex-col justify-between" id="business-profile-card">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <Database className="h-5 w-5 text-bento-accent" />
                <h4 className="font-bold text-base tracking-tight text-bento-text-primary">{t.profileSection}</h4>
              </div>
              <p className="text-xs text-bento-text-secondary mb-4">{t.profileHelp}</p>
              
              <textarea
                value={profileContent}
                onChange={(e) => setProfileContent(e.target.value)}
                rows={12}
                id="profile-content-textarea"
                className="w-full p-4 text-xs font-medium rounded-xl border border-bento-border bg-bento-surface-lighter text-bento-text-primary focus:outline-none focus:border-bento-accent leading-relaxed"
                placeholder="Tulis ringkasan profil bisnis di sini..."
              />
            </div>

            <div className="flex items-center justify-between gap-4 mt-4 pt-4 border-t border-bento-border">
              <span className="text-[10px] text-bento-text-secondary font-mono">
                Terakhir diubah: {new Date(profile.updated_at).toLocaleDateString()}
              </span>
              <button
                onClick={handleSaveProfile}
                disabled={profileSaving}
                id="save-profile-btn"
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl text-white transition-all duration-150 ${
                  profileSuccess 
                    ? 'bg-bento-success' 
                    : 'bg-bento-accent hover:bg-bento-accent/90 shadow-xs'
                }`}
              >
                {profileSuccess ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>{t.saved}</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>{profileSaving ? t.loading : t.save}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* AI Helper Panel (Gemini) — with URL detection & save to knowledge */}
          <div className="p-6 rounded-2xl border border-bento-border bg-bento-surface" id="ai-helper-card">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-5 w-5 text-amber-400 animate-pulse" />
              <h4 className="font-bold text-base tracking-tight text-bento-text-primary">{t.aiHelperTitle}</h4>
            </div>
            <p className="text-[10px] text-bento-text-secondary mb-3">
              Kirim pertanyaan atau paste URL — AI akan membaca, menganalisis, dan bisa menyimpan ke Knowledge.
            </p>

            <div className="space-y-3">
              <div className="relative">
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Tanya tentang bisnis, atau paste URL untuk dibaca penuh..."
                  rows={3}
                  id="ai-helper-prompt"
                  className="w-full pl-4 pr-10 py-3 text-xs rounded-xl border border-bento-border bg-bento-surface-lighter text-bento-text-primary focus:outline-none focus:border-bento-accent"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAskGemini();
                    }
                  }}
                />
                <button
                  onClick={handleAskGemini}
                  disabled={aiLoading || !aiPrompt.trim()}
                  id="ask-gemini-btn"
                  className="absolute right-2.5 bottom-3 p-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-40 transition-all duration-150"
                  title="Ask AI"
                >
                  <Sparkles className="h-4 w-4" />
                </button>
              </div>

              {aiLoading && (
                <div className="p-4 rounded-xl bg-amber-500/5 border border-dashed border-amber-500/25 text-xs text-amber-400 font-bold flex items-center justify-center gap-2">
                  <Activity className="h-4 w-4 animate-spin" />
                  <span>Menganalisis...</span>
                </div>
              )}

              {aiResponse && !aiLoading && (
                <div className="p-4 rounded-xl border border-bento-border bg-bento-surface-lighter max-h-64 overflow-y-auto text-xs leading-relaxed space-y-2 text-bento-text-primary">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-amber-400 text-[10px] uppercase tracking-wider">{t.aiHelperResults}</p>
                    {!aiSavedToKnowledge && (
                      <button
                        onClick={handleSaveAiResponseAsDoc}
                        className="flex items-center gap-1 text-[9px] font-bold text-bento-accent hover:text-white hover:bg-bento-accent px-2 py-0.5 rounded border border-bento-accent/30 transition-all"
                      >
                        <BookOpen className="h-3 w-3" />
                        Simpan ke Knowledge
                      </button>
                    )}
                    {aiSavedToKnowledge && (
                      <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1">
                        <Check className="h-3 w-3" /> Tersimpan
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-line">{aiResponse}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Documents List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-2xl border border-bento-border bg-bento-surface" id="documents-wiki-card">
            {/* Filter and Add button row */}
            <div className="flex flex-col gap-3 mb-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-bento-text-secondary font-semibold">Filter:</span>
                <div className="flex flex-wrap items-center gap-1 p-0.5 rounded-lg border border-bento-border bg-bento-surface-lighter text-xs">
                  <button
                    onClick={() => setDocFilterAppId("all")}
                    id="doc-filter-btn-all"
                    className={`px-3 py-1 rounded-md font-medium transition-all duration-150 ${
                      docFilterAppId === "all"
                        ? 'bg-bento-accent text-white shadow-xs'
                        : 'text-bento-text-secondary hover:text-bento-text-primary hover:bg-bento-surface'
                    }`}
                  >
                    {t.all}
                  </button>
                  <button
                    onClick={() => setDocFilterAppId("global")}
                    id="doc-filter-btn-global"
                    className={`px-3 py-1 rounded-md font-medium transition-all duration-150 ${
                      docFilterAppId === "global"
                        ? 'bg-bento-accent text-white shadow-xs'
                        : 'text-bento-text-secondary hover:text-bento-text-primary hover:bg-bento-surface'
                    }`}
                  >
                    {t.global}
                  </button>
                  {apps.map(app => (
                    <button
                      key={app.id}
                      onClick={() => setDocFilterAppId(app.id)}
                      id={`doc-filter-btn-${app.slug}`}
                      className={`px-3 py-1 rounded-md font-medium transition-all duration-150 truncate max-w-[120px] ${
                        docFilterAppId === app.id
                          ? 'bg-bento-accent text-white shadow-xs'
                          : 'text-bento-text-secondary hover:text-bento-text-primary hover:bg-bento-surface'
                      }`}
                      title={app.name}
                    >
                      {app.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-bento-text-secondary">{filteredDocuments.length} dokumen</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setImportMode(importMode === 'url' ? 'none' : 'url')}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-xl border border-bento-border hover:bg-bento-surface-lighter text-bento-text-secondary hover:text-bento-text-primary shrink-0 transition-all"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    URL
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-xl border border-bento-border hover:bg-bento-surface-lighter text-bento-text-secondary hover:text-bento-text-primary shrink-0 transition-all"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    File
                  </button>
                  <button
                    onClick={handleOpenCreateDoc}
                    id="add-doc-btn"
                    className="flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-xl bg-bento-accent hover:bg-bento-accent/90 text-white shrink-0 shadow-xs transition-all duration-150"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{t.btnNewDoc}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* List of Wiki Articles */}
            {filteredDocuments.length === 0 ? (
              <div className="text-center py-16 opacity-60">
                <FileText className="h-12 w-12 mx-auto mb-3 text-gray-400 stroke-1" />
                <p className="text-sm font-semibold">Tidak ada dokumen.</p>
                <p className="text-xs text-gray-500 mt-1">Gunakan tombol di atas atau import file/URL.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredDocuments.map((doc) => {
                  const matchedApp = apps.find(a => a.id === doc.client_app_id);
                  const isUrlDoc = doc.title.startsWith('[URL]');
                  const isImportDoc = doc.title.startsWith('[Import]');
                  const isAiDoc = doc.title.startsWith('[AI]');
                  return (
                    <div 
                      key={doc.id}
                      className="p-5 rounded-xl border border-bento-border bg-bento-surface-lighter hover:border-bento-accent hover:scale-[1.01] transition-all duration-200"
                    >
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2">
                          {isUrlDoc ? <Globe className="h-4 w-4 text-sky-400 shrink-0" /> :
                           isImportDoc ? <Upload className="h-4 w-4 text-purple-400 shrink-0" /> :
                           isAiDoc ? <Sparkles className="h-4 w-4 text-amber-400 shrink-0" /> :
                           <FileText className="h-4 w-4 text-bento-accent shrink-0" />}
                          <h5 className="font-bold text-sm tracking-tight text-bento-text-primary">{doc.title}</h5>
                        </div>

                        <span className={`px-2.5 py-0.5 text-[9px] font-extrabold rounded-full uppercase tracking-wide shrink-0 ${
                          doc.client_app_id === null
                            ? 'bg-bento-text-secondary/10 text-bento-text-secondary border border-bento-border'
                            : 'bg-bento-accent/10 text-bento-accent border border-bento-accent/15'
                        }`}>
                          {matchedApp ? matchedApp.name : "Global Base"}
                        </span>
                      </div>

                      <p className="text-xs leading-relaxed text-bento-text-secondary opacity-95 mb-4 whitespace-pre-line line-clamp-3">
                        {doc.content}
                      </p>

                      <div className="pt-3 border-t border-bento-border flex items-center justify-between text-[10px] text-bento-text-secondary/80">
                        <span>Ditambahkan: {new Date(doc.created_at).toLocaleDateString()}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenEditDoc(doc)}
                            id={`edit-doc-${doc.id}`}
                            className="p-1 hover:text-[#5B8DEF] transition-colors"
                            title="Edit Document"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("Hapus dokumen pengetahuan ini?")) {
                                onDeleteDocument(doc.id);
                              }
                            }}
                            id={`delete-doc-${doc.id}`}
                            className="p-1 hover:text-red-400 transition-colors"
                            title="Delete Document"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: ADD/EDIT DOCUMENT */}
      {isDocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in" id="doc-modal">
          <div className="w-full max-w-lg p-6 rounded-2xl border border-bento-border bg-bento-surface text-bento-text-primary shadow-2xl">
            <h4 className="font-bold text-lg mb-4">{editingDoc ? "Edit Dokumen Pengetahuan" : t.btnNewDoc}</h4>
            <form onSubmit={handleDocSubmit} className="space-y-4">
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-bento-text-secondary">Judul Dokumen</label>
                <input
                  type="text"
                  required
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder={t.docTitlePlaceholder}
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-bento-border bg-bento-surface-lighter text-bento-text-primary focus:outline-none focus:border-bento-accent"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-bento-text-secondary">Lingkup Aplikasi (Scope)</label>
                <select
                  value={docAppId}
                  onChange={(e) => setDocAppId(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-bento-border bg-bento-surface-lighter text-bento-text-primary focus:outline-none"
                >
                  <option value="global" className="bg-bento-surface">{t.filterAllApps}</option>
                  {apps.map(app => (
                    <option key={app.id} value={app.id} className="bg-bento-surface">{app.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-bento-text-secondary">Isi Dokumen</label>
                <textarea
                  required
                  rows={8}
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  placeholder={t.docContentPlaceholder}
                  className="w-full p-4 text-xs font-medium rounded-xl border border-bento-border bg-bento-surface-lighter text-bento-text-primary focus:outline-none focus:border-bento-accent leading-relaxed"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsDocModalOpen(false)}
                  className="flex-1 px-4 py-2.5 text-xs font-bold rounded-xl border border-bento-border text-bento-text-secondary hover:text-bento-text-primary hover:bg-bento-surface-lighter transition-all duration-150"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 text-xs font-bold rounded-xl bg-bento-accent hover:bg-bento-accent/90 text-white shadow-xs transition-all duration-150"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
