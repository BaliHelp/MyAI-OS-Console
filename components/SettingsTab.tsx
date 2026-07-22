'use client';

import { useState, useEffect, FormEvent } from "react";
import { User, Sun, Moon, Sliders, ExternalLink, Code, KeyRound, Trash2, ToggleLeft, ToggleRight, Sparkles, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { Language } from "@/lib/types";
import { translations } from "@/lib/i18n";

interface SettingsTabProps {
  lang: Language;
  setLang: (lang: Language) => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  adminEmail: string;
}

interface ProviderKey {
  id: string;
  provider: string;
  label: string | null;
  status: string;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  key_masked: string;
  key_plain?: string;
  base_url?: string | null;
  model_name?: string | null;
}

export default function SettingsTab({ lang, setLang, theme, setTheme, adminEmail }: SettingsTabProps) {
  const t = translations[lang];

  // Owner profile simple fields
  const [ownerName, setOwnerName] = useState("Boss Bayu");
  const [profileSaved, setProfileSaved] = useState(false);

  // Provider Keys management
  const [providerKeys, setProviderKeys] = useState<ProviderKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});

  const toggleRevealKey = (id: string) => {
    setRevealedKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Delete confirmation state (inline 2-step, no browser confirm() popup)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Test Connection States & Helper
  const [testingKeys, setTestingKeys] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, { connected: boolean; details: string }>>({});

  const handleTestConnection = async (id: string) => {
    setTestingKeys(prev => ({ ...prev, [id]: true }));
    setTestResults(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });

    try {
      const res = await fetch("/api/provider-keys/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestResults(prev => ({
          ...prev,
          [id]: { connected: data.connected, details: data.details || "Selesai" }
        }));
      } else {
        setTestResults(prev => ({
          ...prev,
          [id]: { connected: false, details: data.error || "Gagal menguji koneksi" }
        }));
      }
    } catch {
      setTestResults(prev => ({
        ...prev,
        [id]: { connected: false, details: "Gagal menghubungi server" }
      }));
    } finally {
      setTestingKeys(prev => ({ ...prev, [id]: false }));
    }
  };
  const [testingAll, setTestingAll] = useState(false);

  const handleTestAllConnections = async () => {
    setTestingAll(true);
    setTestResults({});
    
    try {
      const res = await fetch("/api/provider-keys/test-all");
      if (res.ok) {
        const data = await res.json();
        const newResults: Record<string, { connected: boolean; details: string }> = {};
        data.forEach((item: any) => {
          newResults[item.id] = { connected: item.connected, details: item.details || "" };
        });
        setTestResults(newResults);
      } else {
        alert(lang === 'id' ? "Gagal menguji semua koneksi." : "Failed to test all connections.");
      }
    } catch {
      alert(lang === 'id' ? "Gagal menghubungi server." : "Failed to connect to server.");
    } finally {
      setTestingAll(false);
    }
  };
  
  // New key form
  const [provider, setProvider] = useState("gemini");
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [modelName, setModelName] = useState("");
  const [addingKey, setAddingKey] = useState(false);
  const [error, setError] = useState("");

  // Change Password State & Visibility toggles
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  const handleChangePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");

    if (newPassword !== confirmPassword) {
      setPwError("Konfirmasi password baru tidak cocok.");
      return;
    }

    if (newPassword.length < 8) {
      setPwError("Password baru harus minimal 8 karakter.");
      return;
    }

    setChangingPw(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPwSuccess("Password administrator berhasil diperbarui!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPwError(data.error || "Gagal memperbarui password.");
      }
    } catch {
      setPwError("Gagal terhubung ke server.");
    } finally {
      setChangingPw(false);
    }
  };

  const fetchProviderKeys = async () => {
    setKeysLoading(true);
    try {
      const res = await fetch("/api/provider-keys");
      if (res.ok) {
        const data = await res.json();
        setProviderKeys(data);
      }
    } catch (err) {
      console.error("Error fetching provider keys:", err);
    } finally {
      setKeysLoading(false);
    }
  };

  useEffect(() => {
    fetchProviderKeys();
  }, []);

  const handleSaveProfile = (e: FormEvent) => {
    e.preventDefault();
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  };

  const handleAddProviderKey = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!apiKey) return;
    setAddingKey(true);

    try {
      const res = await fetch("/api/provider-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          provider, 
          label, 
          api_key: apiKey,
          base_url: provider === "others" ? baseUrl : null,
          model_name: provider === "others" ? modelName : null
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add key");
      }

      setLabel("");
      setApiKey("");
      setBaseUrl("");
      setModelName("");
      await fetchProviderKeys();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menambahkan API key.");
    } finally {
      setAddingKey(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    // Confirmation is handled inline in UI — this is only called after user confirms
    try {
      const res = await fetch("/api/provider-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setDeleteConfirmId(null);
        await fetchProviderKeys();
      }
    } catch (err) {
      console.error("Error deleting provider key:", err);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "active" ? "disabled" : "active";
    try {
      const res = await fetch("/api/provider-keys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus }),
      });
      if (res.ok) {
        await fetchProviderKeys();
      }
    } catch (err) {
      console.error("Error updating key status:", err);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in" id="settings-tab">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold tracking-tight mb-1" id="settings-tab-header">{t.settingsTitle}</h3>
        <p className="text-sm text-gray-500">{t.settingsSubtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Settings Panel */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Owner Profile Card */}
          <div className="p-6 rounded-2xl border border-bento-border bg-bento-surface" id="owner-profile-card">
            <div className="flex items-center gap-2.5 mb-6">
              <User className="h-5 w-5 text-bento-accent" />
              <h4 className="font-bold text-base tracking-tight text-bento-text-primary">{t.profileTitle}</h4>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-bento-text-secondary">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    id="profile-name-input"
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-bento-border bg-bento-surface-lighter text-bento-text-primary focus:outline-none focus:border-bento-accent"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-bento-text-secondary">Email Administrator</label>
                  <input
                    type="email"
                    disabled
                    value={adminEmail}
                    id="profile-email-input"
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-bento-border bg-bento-surface-lighter text-bento-text-secondary/60 cursor-not-allowed focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-bento-border">
                <span className="text-[10px] text-bento-text-secondary font-mono">Role: Primary Ecosystem Owner</span>
                <button
                  type="submit"
                  id="save-profile-settings-btn"
                  className={`px-5 py-2.5 text-xs font-bold rounded-xl text-white transition-all duration-150 ${
                    profileSaved 
                      ? 'bg-bento-success' 
                      : 'bg-bento-accent hover:bg-bento-accent/90 shadow-xs'
                  }`}
                >
                  {profileSaved ? "Tersimpan!" : t.save}
                </button>
              </div>
            </form>
          </div>

          {/* Change Password Card */}
          <div className="p-6 rounded-2xl border border-bento-border bg-bento-surface" id="change-password-card">
            <div className="flex items-center gap-2.5 mb-6">
              <ShieldCheck className="h-5 w-5 text-bento-accent" />
              <h4 className="font-bold text-base tracking-tight text-bento-text-primary">Ganti Password Administrator</h4>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              {pwError && (
                <div className="p-2.5 bg-red-500/10 text-red-400 text-xs font-semibold rounded-xl">
                  ⚠️ {pwError}
                </div>
              )}

              {pwSuccess && (
                <div className="p-2.5 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-xl">
                  ✅ {pwSuccess}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-bento-text-secondary">Password Saat Ini</label>
                  <div className="relative">
                    <input
                      type={showCurrentPw ? "text" : "password"}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Sandi lama Anda"
                      className="w-full pl-4 pr-10 py-2.5 text-xs rounded-xl border border-bento-border bg-bento-surface-lighter text-bento-text-primary focus:outline-none focus:border-bento-accent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPw(!showCurrentPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-bento-text-secondary hover:text-bento-text-primary focus:outline-none"
                    >
                      {showCurrentPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-bento-text-secondary">Password Baru</label>
                  <div className="relative">
                    <input
                      type={showNewPw ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimal 8 karakter"
                      className="w-full pl-4 pr-10 py-2.5 text-xs rounded-xl border border-bento-border bg-bento-surface-lighter text-bento-text-primary focus:outline-none focus:border-bento-accent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw(!showNewPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-bento-text-secondary hover:text-bento-text-primary focus:outline-none"
                    >
                      {showNewPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-bento-text-secondary">Konfirmasi Password Baru</label>
                  <div className="relative">
                    <input
                      type={showConfirmPw ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi password baru"
                      className="w-full pl-4 pr-10 py-2.5 text-xs rounded-xl border border-bento-border bg-bento-surface-lighter text-bento-text-primary focus:outline-none focus:border-bento-accent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPw(!showConfirmPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-bento-text-secondary hover:text-bento-text-primary focus:outline-none"
                    >
                      {showConfirmPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={changingPw}
                  className="px-5 py-2.5 text-xs font-bold rounded-xl bg-bento-accent hover:bg-bento-accent/90 text-white disabled:opacity-50"
                >
                  {changingPw ? "Mengubah..." : "Perbarui Password"}
                </button>
              </div>
            </form>
          </div>

          {/* Upstream Provider Keys (Enkripsi & Rotasi) */}
          <div className="p-6 rounded-2xl border border-bento-border bg-bento-surface" id="provider-keys-card">
            <div className="flex items-center gap-2.5 mb-2">
              <KeyRound className="h-5 w-5 text-bento-accent" />
              <h4 className="font-bold text-base tracking-tight text-bento-text-primary">Upstream Provider Keys</h4>
            </div>
            <p className="text-xs text-bento-text-secondary mb-6 leading-relaxed">
              Hubungkan API key real untuk Gemini, Claude, GPT, atau Grok. Kunci akan **dienkripsi AES-256** dan disimpan aman di Supabase. 
              Gateway otomatis merotasi kunci aktif untuk menghindari limit kuota. Semua penyedia AI terhubung secara realtime untuk melayani permintaan ekosistem Anda.
            </p>

            {/* Form Add New Key */}
            <form onSubmit={handleAddProviderKey} className="p-4 rounded-xl bg-bento-surface-lighter border border-bento-border space-y-4 mb-6">
              <h5 className="text-xs font-bold tracking-wider uppercase opacity-85 flex items-center gap-1.5 text-bento-text-primary">
                <Sparkles className="h-3.5 w-3.5 text-bento-accent" /> Tambah API Key Provider
              </h5>
              
              {error && (
                <div className="p-2.5 bg-red-500/10 text-red-400 text-xs font-semibold rounded-lg">
                  ⚠️ {error}
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-bento-text-secondary">Provider AI</label>
                    <select
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-bento-border bg-bento-surface text-bento-text-primary focus:outline-none"
                    >
                      <option value="gemini">Google Gemini (Free Tier: OCR, Scan Wajah, DLL)</option>
                      <option value="claude">Anthropic Claude (Reasoning & Chat Widget - Cadangan)</option>
                      <option value="gpt">OpenAI GPT (Reasoning & Chat Widget)</option>
                      <option value="grok">x.ai Grok (Technical Team: Grok-4.5 & Imagine)</option>
                      <option value="deepseek">Deepseek AI (Reasoning & Chat)</option>
                      <option value="others">Others (GLM, Llama, DLL - Tier 2)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-bento-text-secondary">Label Identitas (Opsional)</label>
                    <input
                      type="text"
                      placeholder="Contoh: Key Utama Produksi"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-bento-border bg-bento-surface text-bento-text-primary focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-bento-text-secondary">Kunci API (API Key)</label>
                    <input
                      type="password"
                      placeholder="AIzaSy... / sk-..."
                      required
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-bento-border bg-bento-surface text-bento-text-primary focus:outline-none"
                    />
                  </div>
                </div>

                {provider === "others" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 rounded-xl bg-bento-surface border border-bento-border animate-fade-in">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-bento-text-secondary">Base URL API Gateway</label>
                      <input
                        type="url"
                        placeholder="https://openrouter.ai/api/v1"
                        required
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-bento-border bg-bento-surface-lighter text-bento-text-primary focus:outline-none focus:border-bento-accent"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-bento-text-secondary">Model Name (Target Pool)</label>
                      <input
                        type="text"
                        placeholder="google/gemini-2.5-flash / glm-4 / dll"
                        required
                        value={modelName}
                        onChange={(e) => setModelName(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-bento-border bg-bento-surface-lighter text-bento-text-primary focus:outline-none focus:border-bento-accent"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={addingKey}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-bento-accent hover:bg-bento-accent/90 text-white transition-all disabled:opacity-50"
                >
                  {addingKey ? "Menyimpan..." : "Simpan Encrypted Key"}
                </button>
              </div>
            </form>

            {/* Keys list */}
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <h5 className="text-xs font-bold tracking-wider uppercase opacity-85 text-bento-text-primary">
                  Daftar Kunci Aktif ({providerKeys.length})
                </h5>
                {providerKeys.length > 0 && (
                  <button
                    type="button"
                    onClick={handleTestAllConnections}
                    disabled={testingAll || keysLoading}
                    className="px-3 py-1.5 text-[10px] font-extrabold rounded-lg bg-bento-accent/15 border border-bento-accent/20 text-bento-accent hover:bg-bento-accent hover:text-white transition-all disabled:opacity-50 flex items-center gap-1"
                  >
                    {testingAll ? "Menguji Semua..." : "Uji Semua Koneksi"}
                  </button>
                )}
              </div>

              {keysLoading ? (
                <p className="text-xs text-bento-text-secondary italic">Memuat kunci...</p>
              ) : providerKeys.length === 0 ? (
                <p className="text-xs text-bento-text-secondary opacity-70 italic p-4 text-center border border-dashed border-bento-border rounded-xl">
                  Belum ada API key provider yang terdaftar. Gateway akan menggunakan fallback .env key default.
                </p>
              ) : (
                <div className="border border-bento-border rounded-xl divide-y divide-bento-border overflow-hidden">
                  {providerKeys.map((k) => (
                    <div key={k.id} className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-bento-surface-lighter hover:bg-bento-surface transition-all">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                            k.provider === 'gemini' 
                              ? 'bg-bento-accent/10 text-bento-accent' 
                              : k.provider === 'claude'
                                ? 'bg-amber-500/10 text-amber-400'
                                : k.provider === 'gpt'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : k.provider === 'deepseek'
                                    ? 'bg-sky-500/10 text-sky-400'
                                    : 'bg-indigo-500/10 text-indigo-400'
                          }`}>
                            {k.provider}
                          </span>
                          <span className="text-xs font-bold text-bento-text-primary">{k.label || "(Tanpa Label)"}</span>
                          {k.status === 'active' ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-bento-text-secondary">
                          <span className="flex items-center gap-1">
                            Key:{" "}
                            <code className="font-mono text-bento-text-primary bg-bento-surface px-1.5 py-0.5 rounded flex items-center gap-1">
                              {revealedKeys[k.id] ? k.key_plain : k.key_masked}
                              <button
                                type="button"
                                onClick={() => toggleRevealKey(k.id)}
                                className="ml-1 text-bento-text-secondary hover:text-bento-text-primary focus:outline-none"
                              >
                                {revealedKeys[k.id] ? (
                                  <EyeOff className="h-3 w-3" />
                                ) : (
                                  <Eye className="h-3 w-3" />
                                )}
                              </button>
                            </code>
                          </span>
                          <span>Penggunaan: <strong className="text-bento-text-primary">{k.usage_count}x</strong></span>
                          {k.last_used_at && (
                            <span>Terakhir: <strong className="text-bento-text-primary">{new Date(k.last_used_at).toLocaleString("id-ID")}</strong></span>
                          )}
                          {testResults[k.id] && (
                            <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold flex items-center gap-0.5 ${
                              testResults[k.id].connected 
                                ? 'bg-emerald-500/10 text-emerald-400' 
                                : 'bg-red-500/10 text-red-400'
                            }`} title={testResults[k.id].details}>
                              {testResults[k.id].connected ? "✓ Terkoneksi" : `✗ ${testResults[k.id].details}`}
                            </span>
                          )}
                        </div>
                        
                        {k.provider === 'others' && (
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-bento-text-secondary mt-1 bg-bento-surface px-2.5 py-1 rounded-lg border border-bento-border/50 w-fit">
                            <span>Base URL: <strong className="text-bento-text-primary font-mono select-all">{k.base_url || "-"}</strong></span>
                            <span>Model: <strong className="text-bento-text-primary font-mono select-all">{k.model_name || "-"}</strong></span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 self-end md:self-auto">
                        <button
                          type="button"
                          onClick={() => handleTestConnection(k.id)}
                          disabled={testingKeys[k.id]}
                          className="px-2 py-1 text-[10px] font-extrabold rounded-lg bg-bento-surface border border-bento-border text-bento-text-secondary hover:text-bento-text-primary transition-all disabled:opacity-50"
                        >
                          {testingKeys[k.id] ? "Menguji..." : "Uji Koneksi"}
                        </button>
                        <button
                          onClick={() => handleToggleStatus(k.id, k.status)}
                          title={k.status === 'active' ? 'Nonaktifkan Key' : 'Aktifkan Key'}
                          className="p-1.5 rounded-lg hover:bg-bento-surface-lighter text-bento-text-secondary hover:text-bento-text-primary transition-all"
                        >
                          {k.status === 'active' ? (
                            <ToggleRight className="h-5 w-5 text-emerald-400" />
                          ) : (
                            <ToggleLeft className="h-5 w-5 text-bento-text-secondary/50" />
                          )}
                        </button>
                        {/* Delete Key — inline 2-step confirmation */}
                        {deleteConfirmId === k.id ? (
                          <div className="flex items-center gap-1.5 animate-fade-in">
                            <span className="text-[11px] text-red-400 font-semibold whitespace-nowrap">Hapus key ini?</span>
                            <button
                              onClick={() => handleDeleteKey(k.id)}
                              className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-red-500 text-white hover:bg-red-600 transition-all"
                            >
                              Ya, Hapus
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2 py-0.5 text-[11px] font-bold rounded-md border border-bento-border text-bento-text-secondary hover:text-bento-text-primary transition-all"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(k.id)}
                            title="Hapus Key"
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Core Preferences Card (Theme & Lang) */}
          <div className="p-6 rounded-2xl border border-bento-border bg-bento-surface" id="core-preferences-card">
            <div className="flex items-center gap-2.5 mb-6">
              <Sliders className="h-5 w-5 text-bento-accent" />
              <h4 className="font-bold text-base tracking-tight text-bento-text-primary">{t.appearanceTitle}</h4>
            </div>

            <div className="space-y-6">
              {/* Theme Settings row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3 border-b border-bento-border">
                <div>
                  <h5 className="font-semibold text-sm mb-1 text-bento-text-primary">{t.themeLabel}</h5>
                  <p className="text-xs text-bento-text-secondary">Sesuaikan pencahayaan panel konsol untuk kenyamanan mata.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTheme('dark')}
                    id="theme-select-dark"
                    className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border transition-all duration-150 ${
                      theme === 'dark'
                        ? 'bg-bento-accent/15 border-bento-accent text-bento-accent font-bold'
                        : 'bg-bento-surface-lighter border-bento-border text-bento-text-secondary hover:text-bento-text-primary'
                    }`}
                  >
                    <Moon className="h-4 w-4" />
                    <span>Dark</span>
                  </button>
                  <button
                    onClick={() => setTheme('light')}
                    id="theme-select-light"
                    className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border transition-all duration-150 ${
                      theme === 'light'
                        ? 'bg-bento-accent/15 border-bento-accent text-bento-accent font-bold'
                        : 'bg-bento-surface-lighter border-bento-border text-bento-text-secondary hover:text-bento-text-primary'
                    }`}
                  >
                    <Sun className="h-4 w-4" />
                    <span>Light</span>
                  </button>
                </div>
              </div>

              {/* Language Settings row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3">
                <div>
                  <h5 className="font-semibold text-sm mb-1 text-bento-text-primary">{t.langLabel}</h5>
                  <p className="text-xs text-bento-text-secondary">Ubah bahasa default yang ditampilkan pada semua label konsol.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLang('id')}
                    id="lang-select-id"
                    className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all duration-150 ${
                      lang === 'id'
                        ? 'bg-bento-accent/15 border-bento-accent text-bento-accent font-bold'
                        : 'bg-bento-surface-lighter border-bento-border text-bento-text-secondary hover:text-bento-text-primary'
                    }`}
                  >
                    Bahasa Indonesia
                  </button>
                  <button
                    onClick={() => setLang('en')}
                    id="lang-select-en"
                    className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all duration-150 ${
                      lang === 'en'
                        ? 'bg-bento-accent/15 border-bento-accent text-bento-accent font-bold'
                        : 'bg-bento-surface-lighter border-bento-border text-bento-text-secondary hover:text-bento-text-primary'
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Coming Soon / Future public devs */}
        <div className="lg:col-span-1">
          <div className="p-6 rounded-2xl border border-bento-border bg-bento-surface relative overflow-hidden h-full flex flex-col justify-between" id="community-settings-card">
            
            {/* Watermark Pattern */}
            <div className="absolute right-[-20px] top-[-20px] opacity-5 rotate-12 pointer-events-none">
              <Code className="h-40 w-40 text-bento-text-secondary" />
            </div>

            <div className="relative space-y-4">
              <span className="px-2.5 py-0.5 text-[9px] font-extrabold rounded-full bg-bento-accent/15 text-bento-accent uppercase tracking-wider border border-bento-accent/10">
                Coming Soon
              </span>

              <div>
                <h4 className="font-bold text-base mb-1 text-bento-text-primary" id="community-settings-title">{t.placeholderSettingsTitle}</h4>
                <p className="text-xs text-bento-text-secondary leading-relaxed">{t.placeholderSettingsDesc}</p>
              </div>

              <div className="pt-4 border-t border-bento-border space-y-3 text-xs text-bento-text-secondary">
                <div className="flex items-center justify-between hover:text-bento-text-primary transition-colors duration-150 cursor-pointer">
                  <span>Public Registration URL</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </div>
                <div className="flex items-center justify-between">
                  <span>Developer Sign-up Moderation</span>
                  <span className="font-mono text-[11px] bg-bento-surface-lighter px-2 py-0.5 rounded border border-bento-border">Disabled</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Client-key Sandbox Mode</span>
                  <span className="font-mono text-[11px] bg-bento-surface-lighter px-2 py-0.5 rounded border border-bento-border">Inactive</span>
                </div>
              </div>
            </div>

            <div className="pt-6 relative">
              <button
                disabled
                className="w-full py-2.5 text-xs font-bold rounded-xl border border-dashed border-bento-border text-bento-text-secondary/50 bg-bento-surface-lighter cursor-not-allowed"
              >
                Configure Community Tier
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
