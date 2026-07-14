import { useState, useMemo, FormEvent } from "react";
import { 
  AppWindow, 
  Plus, 
  Key, 
  Check, 
  Copy, 
  Trash2, 
  ArrowLeft, 
  ShieldAlert, 
  ShieldCheck, 
  Settings, 
  Globe, 
  Lock,
  Clock,
  Eye,
  Activity
} from "lucide-react";
import { ClientApp, ApiKey, Language } from "../types";
import { translations } from "../i18n";

interface AppsTabProps {
  apps: ClientApp[];
  apiKeys: ApiKey[];
  lang: Language;
  theme: 'dark' | 'light';
  onCreateApp: (name: string, slug: string, tier: 'internal' | 'community') => Promise<void>;
  onGenerateKey: (clientAppId: string, scope: string[], rateLimit: number | null) => Promise<{ full_key: string } & ApiKey>;
  onRevokeKey: (keyId: string) => Promise<void>;
}

export default function AppsTab({ apps, apiKeys, lang, theme, onCreateApp, onGenerateKey, onRevokeKey }: AppsTabProps) {
  const t = translations[lang];

  // Tab State
  const [selectedApp, setSelectedApp] = useState<ClientApp | null>(null);
  
  // Create App Modal
  const [isAppModalOpen, setIsAppModalOpen] = useState(false);
  const [newAppName, setNewAppName] = useState("");
  const [newAppSlug, setNewAppSlug] = useState("");
  const [newAppTier, setNewAppTier] = useState<'internal' | 'community'>('internal');
  const [appError, setAppError] = useState("");

  // Create Key Modal & Display Key
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [keyScope, setKeyScope] = useState<string[]>(["claude", "gpt", "gemini"]);
  const [keyRateLimit, setKeyRateLimit] = useState<string>("");
  const [generatedKeyResult, setGeneratedKeyResult] = useState<{ full_key: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Revoke confirmation state
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);

  // Auto generate slug from name
  const handleAppNameChange = (val: string) => {
    setNewAppName(val);
    const slug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
    setNewAppSlug(slug);
  };

  const handleCreateAppSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAppError("");
    if (!newAppName || !newAppSlug) {
      setAppError("All fields are required");
      return;
    }
    // Check slug uniqueness
    if (apps.some(a => a.slug === newAppSlug)) {
      setAppError("Slug must be unique");
      return;
    }

    try {
      await onCreateApp(newAppName, newAppSlug, newAppTier);
      setIsAppModalOpen(false);
      setNewAppName("");
      setNewAppSlug("");
      setNewAppTier("internal");
    } catch (err: any) {
      setAppError(err.message || "Failed to create application");
    }
  };

  const handleGenerateKeySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;

    try {
      const limit = selectedApp.tier === 'community' && keyRateLimit ? parseInt(keyRateLimit) : null;
      const res = await onGenerateKey(selectedApp.id, keyScope, limit);
      setGeneratedKeyResult({ full_key: res.full_key });
      // Reset values
      setKeyScope(["claude", "gpt", "gemini"]);
      setKeyRateLimit("");
    } catch (err: any) {
      alert("Failed to generate API Key");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter keys belonging to current selected app
  const currentAppKeys = useMemo(() => {
    if (!selectedApp) return [];
    return apiKeys.filter(k => k.client_app_id === selectedApp.id);
  }, [apiKeys, selectedApp]);

  return (
    <div className="space-y-8 animate-fade-in" id="apps-tab">
      {/* Detail Page / Back Button */}
      {selectedApp ? (
        <div className="space-y-6">
          <button
            onClick={() => { setSelectedApp(null); setGeneratedKeyResult(null); }}
            id="back-to-apps-btn"
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border border-bento-border bg-bento-surface text-bento-text-secondary hover:text-bento-text-primary transition-all duration-150"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t.backToApps}</span>
          </button>

          {/* App Header Detail */}
          <div className="p-6 rounded-2xl border border-bento-border bg-bento-surface flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-bento-accent-muted text-bento-accent">
                <AppWindow className="h-8 w-8" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xl font-bold tracking-tight text-bento-text-primary" id="app-detail-name">{selectedApp.name}</h3>
                  <span className={`px-2.5 py-0.5 text-[9px] font-extrabold rounded-full uppercase tracking-wide ${
                    selectedApp.tier === 'internal'
                      ? 'bg-bento-success/10 text-bento-success border border-bento-success/15'
                      : 'bg-bento-accent/10 text-bento-accent border border-bento-accent/15'
                  }`}>
                    {selectedApp.tier === 'internal' ? t.tierInternal : t.tierCommunity}
                  </span>
                </div>
                <p className="text-xs text-bento-text-secondary font-mono opacity-80">Slug: {selectedApp.slug} | ID: {selectedApp.id}</p>
              </div>
            </div>

            <button
              onClick={() => { setIsKeyModalOpen(true); setGeneratedKeyResult(null); }}
              id="generate-key-btn"
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-bento-accent hover:bg-bento-accent/90 text-white shadow-xs transition-all duration-150"
            >
              <Plus className="h-4 w-4" />
              <span>{t.generateKey}</span>
            </button>
          </div>

          {/* Key list */}
          <div className="p-6 rounded-2xl border border-bento-border bg-bento-surface">
            <h4 className="font-bold text-base mb-6" id="keys-list-title">{t.keysList}</h4>

            {currentAppKeys.length === 0 ? (
              <div className="text-center py-10 opacity-60">
                <Key className="h-10 w-10 mx-auto mb-3 text-gray-400 stroke-1" />
                <p className="text-sm font-medium">Belum ada API Key untuk aplikasi ini.</p>
                <p className="text-xs text-gray-500 mt-1">Gunakan tombol di atas untuk membuat kunci akses Gateway pertama.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {currentAppKeys.map((key) => {
                  const isRevoked = key.status === 'revoked';
                  return (
                    <div 
                      key={key.id}
                      className={`p-5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-150 ${
                        isRevoked 
                          ? 'opacity-40 border-dashed bg-black/5 border-bento-border' 
                          : 'bg-bento-surface-lighter border-bento-border'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <code className="px-2.5 py-1 rounded bg-black/20 font-mono text-xs font-semibold text-[#5B8DEF]">
                            {key.key_prefix}••••••••••••••••
                          </code>
                          <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${
                            isRevoked
                              ? 'bg-red-500/10 text-red-400'
                              : 'bg-emerald-500/10 text-emerald-400'
                          }`}>
                            {isRevoked ? t.revoked : t.active}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-400">
                          {/* Scope badges */}
                          <div className="flex items-center gap-1">
                            <span className="font-semibold">Scopes:</span>
                            {key.provider_scope.map(sc => (
                              <span key={sc} className="px-1.5 py-0.5 rounded bg-black/10 text-[9px] uppercase font-bold text-gray-300">
                                {sc}
                              </span>
                            ))}
                          </div>

                          {/* Rate limits */}
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 opacity-60" />
                            <span>Limit: {key.rate_limit_per_day ? `${key.rate_limit_per_day} rpd` : t.unlimited}</span>
                          </div>

                          {/* Created at */}
                          <div>
                            <span>Dibuat: {new Date(key.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Revoke Controls */}
                      {!isRevoked && (
                        <div>
                          {revokeConfirmId === key.id ? (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-red-400 font-semibold max-w-[200px] text-right">{t.keyRevokeConfirm}</span>
                              <button
                                onClick={async () => {
                                  await onRevokeKey(key.id);
                                  setRevokeConfirmId(null);
                                }}
                                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg"
                              >
                                {t.confirm}
                              </button>
                              <button
                                onClick={() => setRevokeConfirmId(null)}
                                className="px-3 py-1.5 bg-gray-500 text-white font-bold text-xs rounded-lg"
                              >
                                {t.cancel}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setRevokeConfirmId(key.id)}
                              className={`p-2 rounded-xl hover:bg-red-500/15 text-red-400 transition-colors border border-transparent hover:border-red-500/20`}
                              title="Revoke API Key"
                            >
                              <Trash2 className="h-4.5 w-4.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Main List Apps Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold tracking-tight mb-1" id="apps-tab-header">{t.appsTitle}</h3>
              <p className="text-sm text-gray-500">{t.appsSubtitle}</p>
            </div>
            <button
              onClick={() => setIsAppModalOpen(true)}
              id="new-app-btn"
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-bento-accent hover:bg-bento-accent/90 text-white shadow-xs transition-all duration-150"
            >
              <Plus className="h-4 w-4" />
              <span>{t.btnNewApp}</span>
            </button>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="apps-grid">
            {apps.map((app) => (
              <div
                key={app.id}
                onClick={() => setSelectedApp(app)}
                className="p-6 rounded-2xl border border-bento-border bg-bento-surface hover:border-bento-accent hover:scale-[1.02] cursor-pointer group flex flex-col justify-between h-48 transition-all duration-300"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="p-2.5 rounded-xl transition-colors bg-bento-surface-lighter group-hover:bg-bento-accent-muted text-bento-text-secondary group-hover:text-bento-accent">
                      <AppWindow className="h-5 w-5" />
                    </div>
                    <span className={`px-2.5 py-0.5 text-[9px] font-extrabold rounded-full uppercase tracking-wide ${
                      app.tier === 'internal'
                        ? 'bg-bento-success/10 text-bento-success border border-bento-success/15'
                        : 'bg-bento-accent/10 text-bento-accent border border-bento-accent/15'
                    }`}>
                      {app.tier === 'internal' ? 'internal' : 'community'}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-base tracking-tight mb-1 group-hover:text-bento-accent text-bento-text-primary transition-colors">{app.name}</h4>
                    <p className="text-xs text-gray-500 font-mono">slug: {app.slug}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-bento-border flex items-center justify-between text-xs text-bento-text-secondary">
                  <span className="flex items-center gap-1">
                    <Key className="h-3.5 w-3.5 opacity-60" />
                    <strong>{app.key_count || 0}</strong> Keys
                  </span>
                  <span className={`h-1.5 w-1.5 rounded-full ${app.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE APP */}
      {isAppModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in" id="create-app-modal">
          <div className={`w-full max-w-md p-6 rounded-2xl border ${
            theme === 'dark' ? 'bg-[#121316] border-[#1D1E22] text-white' : 'bg-white border-[#E5E7EB] text-black shadow-xl'
          }`}>
            <h4 className="font-bold text-lg mb-4">{t.btnNewApp}</h4>
            <form onSubmit={handleCreateAppSubmit} className="space-y-4">
              {appError && (
                <div className="p-3 bg-red-500/10 text-red-400 text-xs font-semibold rounded-xl flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>{appError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-bento-text-secondary">Nama Aplikasi</label>
                <input
                  type="text"
                  required
                  value={newAppName}
                  onChange={(e) => handleAppNameChange(e.target.value)}
                  placeholder="Contoh: Indonesian Visas"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-bento-border bg-bento-surface-lighter text-bento-text-primary focus:outline-none focus:border-bento-accent"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-bento-text-secondary">Unique Slug</label>
                <input
                  type="text"
                  required
                  value={newAppSlug}
                  onChange={(e) => setNewAppSlug(e.target.value)}
                  placeholder="e.g. indonesian-visas"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-bento-border bg-bento-surface-lighter text-bento-text-primary focus:outline-none focus:border-bento-accent font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-bento-text-secondary">{t.labelTier}</label>
                <select
                  value={newAppTier}
                  onChange={(e) => setNewAppTier(e.target.value as any)}
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-bento-border bg-bento-surface-lighter text-bento-text-primary focus:outline-none"
                >
                  <option value="internal" className="bg-bento-surface">{t.tierInternal}</option>
                  <option value="community" className="bg-bento-surface">{t.tierCommunity}</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAppModalOpen(false)}
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

      {/* MODAL 2: GENERATE KEY & VIEW KEY */}
      {isKeyModalOpen && selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in" id="generate-key-modal">
          <div className="w-full max-w-lg p-6 rounded-2xl border border-bento-border bg-bento-surface text-bento-text-primary shadow-2xl">
            <h4 className="font-bold text-lg mb-4">{t.generateKey}</h4>

            {generatedKeyResult ? (
              // Display Key Exactly Once view
              <div className="space-y-5">
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex gap-3">
                  <ShieldAlert className="h-5 w-5 shrink-0" />
                  <div>
                    <h5 className="font-bold mb-1">{t.keyCreatedWarning}</h5>
                    <p>Setelah Anda menutup modal ini, Anda hanya dapat melihat prefix kunci ini untuk alasan keamanan.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-bento-text-secondary font-semibold">Your API Key:</label>
                  <div className="p-4 rounded-xl font-mono text-xs flex items-center justify-between border border-bento-border bg-bento-surface-lighter">
                    <span className="text-bento-accent font-bold select-all break-all">{generatedKeyResult.full_key}</span>
                    <button
                      onClick={() => copyToClipboard(generatedKeyResult.full_key)}
                      className="p-2 hover:bg-bento-surface/25 rounded-lg transition-colors shrink-0 ml-2"
                      title="Copy Key"
                    >
                      {copied ? <Check className="h-4 w-4 text-bento-success" /> : <Copy className="h-4 w-4 text-bento-text-secondary" />}
                    </button>
                  </div>
                </div>

                {copied && (
                  <div className="text-center text-xs text-emerald-400 font-bold animate-pulse">
                    {t.keyCopySuccess}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => { setIsKeyModalOpen(false); setGeneratedKeyResult(null); }}
                  className="w-full py-2.5 text-xs font-bold rounded-xl bg-bento-accent text-white shadow-xs hover:bg-bento-accent/90 transition-all duration-150"
                >
                  Selesai / Close
                </button>
              </div>
            ) : (
              // Configuration View
              <form onSubmit={handleGenerateKeySubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-bento-text-secondary">{t.keyScope}</label>
                  <div className="grid grid-cols-3 gap-3">
                    {["claude", "gpt", "gemini"].map(prov => {
                      const isChecked = keyScope.includes(prov);
                      return (
                        <button
                          key={prov}
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              setKeyScope(keyScope.filter(s => s !== prov));
                            } else {
                              setKeyScope([...keyScope, prov]);
                            }
                          }}
                          className={`p-3 rounded-xl border text-xs font-bold capitalize flex items-center justify-center gap-2 transition-all duration-150 ${
                            isChecked
                              ? 'bg-bento-accent-muted border-bento-accent text-bento-accent shadow-xs'
                              : 'bg-bento-surface border-bento-border text-bento-text-secondary hover:text-bento-text-primary'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isChecked ? 'bg-bento-accent animate-pulse' : 'bg-bento-text-secondary/50'}`} />
                          {prov}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedApp.tier === 'community' ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-bento-text-secondary">{t.rateLimitLabel}</label>
                    <input
                      type="number"
                      value={keyRateLimit}
                      onChange={(e) => setKeyRateLimit(e.target.value)}
                      placeholder="Contoh: 1000"
                      className="w-full px-4 py-2.5 text-sm rounded-xl border border-bento-border bg-bento-surface-lighter text-bento-text-primary focus:outline-none focus:border-bento-accent"
                    />
                    <span className="text-[10px] text-bento-text-secondary">{t.rateLimitHelp}</span>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-bento-success/5 border border-bento-success/15 flex items-center gap-2.5 text-bento-success text-xs font-medium">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Aplikasi tier internal memiliki akses tanpa batas (unlimited rate limits).</span>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsKeyModalOpen(false)}
                    className="flex-1 px-4 py-2.5 text-xs font-bold rounded-xl border border-bento-border text-bento-text-secondary hover:text-bento-text-primary hover:bg-bento-surface-lighter transition-all duration-150"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={keyScope.length === 0}
                    className="flex-1 px-4 py-2.5 text-xs font-bold rounded-xl bg-bento-accent hover:bg-bento-accent/90 text-white shadow-xs disabled:opacity-50 transition-all duration-150"
                  >
                    {t.generateKey}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
