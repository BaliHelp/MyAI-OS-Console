'use client';

import { useState, useEffect } from "react";
import { Bot, Plus, Save, Trash2, ChevronDown, ChevronUp, X, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
import { Language, ChatPersona, ClientApp } from "@/lib/types";

interface PersonasTabProps {
  lang: Language;
  theme: 'dark' | 'light';
  apps: ClientApp[];
}

const LANGUAGE_OPTIONS = [
  { value: "id", label: "Bahasa Indonesia" },
  { value: "en", label: "English" },
];

export default function PersonasTab({ lang, theme, apps }: PersonasTabProps) {
  const [personas, setPersonas] = useState<ChatPersona[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State edit per persona (keyed by persona id)
  const [editMap, setEditMap] = useState<Record<string, {
    persona_name: string;
    tone_description: string;
    language_default: string;
    must_never_say: string[];
    newRule: string;
    saving: boolean;
    dirty: boolean;
    expanded: boolean;
  }>>({});

  // State buat persona baru
  const [showCreate, setShowCreate] = useState(false);
  const [newClientAppId, setNewClientAppId] = useState("");
  const [newPersonaName, setNewPersonaName] = useState("");
  const [newTone, setNewTone] = useState("");
  const [newLang, setNewLang] = useState("id");
  const [newRules, setNewRules] = useState<string[]>([]);
  const [newRuleInput, setNewRuleInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const fetchPersonas = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/personas");
      if (!res.ok) throw new Error("Gagal memuat data personas");
      const data: ChatPersona[] = await res.json();
      setPersonas(data);

      // Init edit map
      const map: typeof editMap = {};
      data.forEach((p) => {
        map[p.id] = {
          persona_name: p.persona_name,
          tone_description: p.tone_description,
          language_default: p.language_default,
          must_never_say: [...p.must_never_say],
          newRule: "",
          saving: false,
          dirty: false,
          expanded: true,
        };
      });
      setEditMap(map);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPersonas(); }, []);

  const updateEditField = (id: string, field: string, value: any) => {
    setEditMap((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value, dirty: true },
    }));
  };

  const addRule = (id: string) => {
    const rule = editMap[id]?.newRule?.trim();
    if (!rule) return;
    setEditMap((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        must_never_say: [...prev[id].must_never_say, rule],
        newRule: "",
        dirty: true,
      },
    }));
  };

  const removeRule = (id: string, idx: number) => {
    setEditMap((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        must_never_say: prev[id].must_never_say.filter((_, i) => i !== idx),
        dirty: true,
      },
    }));
  };

  const savePersona = async (id: string) => {
    const edit = editMap[id];
    if (!edit) return;
    setEditMap((prev) => ({ ...prev, [id]: { ...prev[id], saving: true } }));
    try {
      const res = await fetch(`/api/personas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona_name: edit.persona_name,
          tone_description: edit.tone_description,
          language_default: edit.language_default,
          must_never_say: edit.must_never_say,
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Gagal menyimpan");
      }
      setEditMap((prev) => ({ ...prev, [id]: { ...prev[id], saving: false, dirty: false } }));
      setSaveSuccess(id);
      setTimeout(() => setSaveSuccess(null), 2500);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
      setEditMap((prev) => ({ ...prev, [id]: { ...prev[id], saving: false } }));
    }
  };

  const deletePersona = async (id: string, name: string) => {
    if (!confirm(`Hapus persona "${name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    const res = await fetch(`/api/personas/${id}`, { method: "DELETE" });
    if (!res.ok) { alert("Gagal menghapus persona"); return; }
    await fetchPersonas();
  };

  const createPersona = async () => {
    if (!newClientAppId || !newPersonaName.trim()) {
      setCreateError("Client app dan nama persona wajib diisi");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_app_id: newClientAppId,
          persona_name: newPersonaName.trim(),
          tone_description: newTone.trim(),
          language_default: newLang,
          must_never_say: newRules,
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error);
      }
      setShowCreate(false);
      setNewClientAppId(""); setNewPersonaName(""); setNewTone(""); setNewRules([]); setNewRuleInput("");
      await fetchPersonas();
    } catch (e: any) {
      setCreateError(e.message);
    } finally {
      setCreating(false);
    }
  };

  // Client apps yang belum punya persona
  const appsWithoutPersona = apps.filter(
    (a) => !personas.find((p) => p.client_app_id === a.id)
  );

  const getAppName = (id: string) => apps.find((a) => a.id === id)?.name || id;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="h-6 w-6 animate-spin text-bento-accent opacity-60" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-bento-text-primary flex items-center gap-2">
            <Bot className="h-5 w-5 text-bento-accent" />
            Chat Personas
          </h2>
          <p className="text-xs text-bento-text-secondary mt-1">
            Persona per client app — otomatis di-inject ke system prompt untuk field <code className="text-bento-accent bg-bento-accent/10 px-1 rounded">chatbot_general</code> dan <code className="text-bento-accent bg-bento-accent/10 px-1 rounded">chatbot_checkout</code>.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          id="btn-add-persona"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bento-accent text-white text-xs font-bold hover:bg-bento-accent/90 transition-all"
        >
          <Plus className="h-4 w-4" />
          Tambah Persona
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="rounded-2xl border border-bento-accent/30 bg-bento-surface p-5 space-y-4">
          <h3 className="text-sm font-bold text-bento-text-primary flex items-center gap-2">
            <Plus className="h-4 w-4 text-bento-accent" />
            Persona Baru
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-bento-text-secondary uppercase">Client App *</label>
              <select
                value={newClientAppId}
                onChange={(e) => setNewClientAppId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-bento-surface-lighter border border-bento-border text-sm text-bento-text-primary focus:outline-none focus:border-bento-accent"
              >
                <option value="">-- Pilih App --</option>
                {appsWithoutPersona.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
                {appsWithoutPersona.length === 0 && (
                  <option disabled>Semua app sudah punya persona</option>
                )}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-bento-text-secondary uppercase">Nama Persona *</label>
              <input
                type="text"
                value={newPersonaName}
                onChange={(e) => setNewPersonaName(e.target.value)}
                placeholder="Contoh: MyVISA AI"
                className="w-full px-3 py-2 rounded-xl bg-bento-surface-lighter border border-bento-border text-sm text-bento-text-primary focus:outline-none focus:border-bento-accent"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-bento-text-secondary uppercase">Tone & Gaya</label>
            <textarea
              rows={2}
              value={newTone}
              onChange={(e) => setNewTone(e.target.value)}
              placeholder="Contoh: Senior Sales Consultant. Ringkas, profesional, regulation-first."
              className="w-full px-3 py-2 rounded-xl bg-bento-surface-lighter border border-bento-border text-sm text-bento-text-primary focus:outline-none focus:border-bento-accent resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-bento-text-secondary uppercase">Bahasa Default</label>
            <select
              value={newLang}
              onChange={(e) => setNewLang(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-bento-surface-lighter border border-bento-border text-sm text-bento-text-primary focus:outline-none focus:border-bento-accent"
            >
              {LANGUAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-bento-text-secondary uppercase">Aturan Wajib (Must Never Say)</label>
            <div className="space-y-1.5">
              {newRules.map((rule, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="flex-1 text-xs text-bento-text-primary bg-bento-surface-lighter px-3 py-1.5 rounded-lg border border-bento-border">{rule}</span>
                  <button onClick={() => setNewRules((r) => r.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300 transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newRuleInput}
                  onChange={(e) => setNewRuleInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (newRuleInput.trim()) { setNewRules((r) => [...r, newRuleInput.trim()]); setNewRuleInput(""); } } }}
                  placeholder="Tambah aturan dan tekan Enter..."
                  className="flex-1 px-3 py-1.5 rounded-xl bg-bento-surface-lighter border border-bento-border text-xs text-bento-text-primary focus:outline-none focus:border-bento-accent"
                />
                <button
                  onClick={() => { if (newRuleInput.trim()) { setNewRules((r) => [...r, newRuleInput.trim()]); setNewRuleInput(""); } }}
                  className="px-3 py-1.5 rounded-xl bg-bento-surface-lighter border border-bento-border text-xs text-bento-text-secondary hover:text-bento-text-primary transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {createError && (
            <p className="text-xs text-red-400 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> {createError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => { setShowCreate(false); setCreateError(null); }} className="px-4 py-2 rounded-xl text-xs font-medium text-bento-text-secondary hover:bg-bento-surface-lighter transition-colors">
              Batal
            </button>
            <button
              onClick={createPersona}
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bento-accent text-white text-xs font-bold hover:bg-bento-accent/90 transition-all disabled:opacity-50"
            >
              {creating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Simpan Persona
            </button>
          </div>
        </div>
      )}

      {/* Daftar Personas */}
      {personas.length === 0 && !showCreate && (
        <div className="py-16 text-center space-y-3">
          <Bot className="h-10 w-10 text-bento-text-secondary/30 mx-auto" />
          <p className="text-sm text-bento-text-secondary">Belum ada persona yang dikonfigurasi.</p>
          <p className="text-xs text-bento-text-secondary opacity-60">Klik "Tambah Persona" untuk membuat persona pertama.</p>
        </div>
      )}

      <div className="space-y-4">
        {personas.map((persona) => {
          const edit = editMap[persona.id];
          if (!edit) return null;
          const appName = getAppName(persona.client_app_id);

          return (
            <div
              key={persona.id}
              className="rounded-2xl border border-bento-border bg-bento-surface overflow-hidden"
              id={`persona-card-${persona.id}`}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-bento-accent/20 to-purple-500/20 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-bento-accent" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-bento-text-primary">{edit.persona_name}</span>
                      {edit.dirty && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[9px] font-bold uppercase border border-amber-500/20">
                          Belum Disimpan
                        </span>
                      )}
                      {saveSuccess === persona.id && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 text-[9px] font-bold uppercase border border-green-500/20">
                          <CheckCircle className="h-2.5 w-2.5" /> Tersimpan
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-bento-text-secondary">{appName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => deletePersona(persona.id, persona.persona_name)}
                    id={`btn-delete-persona-${persona.id}`}
                    className="p-1.5 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => updateEditField(persona.id, "expanded", !edit.expanded)}
                    className="p-1.5 rounded-lg text-bento-text-secondary hover:text-bento-text-primary hover:bg-bento-surface-lighter transition-all"
                  >
                    {edit.expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Card Body — Expandable */}
              {edit.expanded && (
                <div className="px-5 pb-5 space-y-4 border-t border-bento-border">
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    {/* Nama Persona */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-bento-text-secondary uppercase">Nama Persona</label>
                      <input
                        type="text"
                        value={edit.persona_name}
                        onChange={(e) => updateEditField(persona.id, "persona_name", e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-bento-surface-lighter border border-bento-border text-sm text-bento-text-primary focus:outline-none focus:border-bento-accent"
                      />
                    </div>

                    {/* Bahasa Default */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-bento-text-secondary uppercase">Bahasa Default</label>
                      <select
                        value={edit.language_default}
                        onChange={(e) => updateEditField(persona.id, "language_default", e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-bento-surface-lighter border border-bento-border text-sm text-bento-text-primary focus:outline-none focus:border-bento-accent"
                      >
                        {LANGUAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Tone */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-bento-text-secondary uppercase">Tone & Gaya</label>
                    <textarea
                      rows={2}
                      value={edit.tone_description}
                      onChange={(e) => updateEditField(persona.id, "tone_description", e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-bento-surface-lighter border border-bento-border text-sm text-bento-text-primary focus:outline-none focus:border-bento-accent resize-none"
                    />
                  </div>

                  {/* Must Never Say */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-bento-text-secondary uppercase">
                      Aturan Wajib — Must Never Say
                    </label>
                    <div className="space-y-1.5">
                      {edit.must_never_say.map((rule, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="flex-1 flex items-center gap-2 bg-red-500/5 border border-red-500/15 rounded-xl px-3 py-2">
                            <span className="text-red-400/60 text-xs font-bold">✕</span>
                            <span className="text-xs text-bento-text-primary flex-1">{rule}</span>
                          </div>
                          <button
                            onClick={() => removeRule(persona.id, i)}
                            className="p-1 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}

                      {/* Add new rule */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={edit.newRule}
                          onChange={(e) => updateEditField(persona.id, "newRule", e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRule(persona.id); } }}
                          placeholder="Tambah aturan baru... (Enter untuk tambah)"
                          className="flex-1 px-3 py-1.5 rounded-xl bg-bento-surface-lighter border border-bento-border text-xs text-bento-text-primary focus:outline-none focus:border-bento-accent"
                        />
                        <button
                          onClick={() => addRule(persona.id)}
                          className="px-3 py-1.5 rounded-xl bg-bento-surface-lighter border border-bento-border text-xs text-bento-text-secondary hover:text-bento-text-primary hover:border-bento-accent transition-all"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Preview system prompt block */}
                  <details className="group">
                    <summary className="cursor-pointer text-[10px] font-bold text-bento-text-secondary uppercase hover:text-bento-text-primary transition-colors select-none">
                      Preview Persona Block (yang akan di-inject ke system prompt)
                    </summary>
                    <pre className="mt-2 p-3 rounded-xl bg-bento-surface-lighter border border-bento-border text-[10px] text-bento-text-secondary font-mono whitespace-pre-wrap overflow-x-auto">
{`--- PERSONA ---
Nama: ${edit.persona_name}
Tone & Gaya: ${edit.tone_description}
Bahasa Default: ${edit.language_default === "id" ? "Bahasa Indonesia" : "English"}
Aturan Wajib (JANGAN PERNAH dilanggar):
${edit.must_never_say.map((r) => `- ${r}`).join("\n") || "- (tidak ada)"}
--- INSTRUKSI TUGAS ---
[system_prompt field chatbot_general/chatbot_checkout]`}
                    </pre>
                  </details>

                  {/* Save button */}
                  <div className="flex justify-between items-center pt-1">
                    <p className="text-[10px] text-bento-text-secondary opacity-60">
                      Diperbarui: {new Date(persona.updated_at).toLocaleString("id-ID")}
                    </p>
                    <button
                      onClick={() => savePersona(persona.id)}
                      disabled={edit.saving || !edit.dirty}
                      id={`btn-save-persona-${persona.id}`}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bento-accent text-white text-xs font-bold hover:bg-bento-accent/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {edit.saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      {edit.saving ? "Menyimpan..." : "Simpan Perubahan"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
