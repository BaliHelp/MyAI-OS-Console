'use client';

import { useState, useEffect } from "react";
import { Plus, Shuffle, ToggleLeft, ToggleRight, Save, Layers, PlayCircle, Info } from "lucide-react";
import { Language } from "@/lib/types";

interface FieldRouting {
  field_key: string;
  display_name: string;
  description: string;
  auto_mode: boolean;
  last_tier_used: number | null;
  assignments: {
    id?: string;
    field_key: string;
    provider: string;
    pool_tier: number;
  }[];
}

interface RoutingTabProps {
  lang: Language;
  theme: 'dark' | 'light';
}

export default function RoutingTab({ lang, theme }: RoutingTabProps) {
  const [fields, setFields] = useState<FieldRouting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states for creating a new custom field
  const [newKey, setNewKey] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newAuto, setNewAuto] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  // Store temporary assignment configurations before saving
  // Format: { [field_key]: { [tier_number]: provider_value } }
  const [tempAssignments, setTempAssignments] = useState<Record<string, Record<number, string>>>({});

  const fetchRoutingData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/routing");
      if (!res.ok) throw new Error("Failed to load routing data");
      const data = await res.json();
      setFields(data);

      // Initialize temp assignments state
      const initialTemps: Record<string, Record<number, string>> = {};
      data.forEach((f: FieldRouting) => {
        initialTemps[f.field_key] = { 1: "", 2: "", 3: "" };
        f.assignments.forEach((a) => {
          initialTemps[f.field_key][a.pool_tier] = a.provider;
        });
      });
      setTempAssignments(initialTemps);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutingData();
  }, []);

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey || !newName) return;
    try {
      const res = await fetch("/api/routing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_field",
          field_key: newKey.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
          display_name: newName,
          description: newDesc,
          auto_mode: newAuto
        })
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to add field");
      }
      setNewKey("");
      setNewName("");
      setNewDesc("");
      setFormOpen(false);
      await fetchRoutingData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleAutoMode = async (fieldKey: string, currentAuto: boolean) => {
    try {
      const res = await fetch("/api/routing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_auto_mode",
          field_key: fieldKey,
          auto_mode: !currentAuto
        })
      });
      if (!res.ok) throw new Error("Failed to toggle mode");
      await fetchRoutingData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSelectProvider = (fieldKey: string, tier: number, provider: string) => {
    setTempAssignments(prev => ({
      ...prev,
      [fieldKey]: {
        ...prev[fieldKey],
        [tier]: provider
      }
    }));
  };

  const handleSaveAssignments = async (fieldKey: string) => {
    const fieldTemps = tempAssignments[fieldKey] || {};
    const assignmentsList = Object.entries(fieldTemps)
      .filter(([_, provider]) => provider !== "")
      .map(([tierStr, provider]) => ({
        provider,
        pool_tier: parseInt(tierStr)
      }));

    try {
      const res = await fetch("/api/routing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_assignments",
          field_key: fieldKey,
          assignments: assignmentsList
        })
      });
      if (!res.ok) throw new Error("Failed to update assignments");
      alert(lang === "id" ? "Routing berhasil disimpan!" : "Routing saved successfully!");
      await fetchRoutingData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading && fields.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <span className="text-xs opacity-60 animate-pulse">Loading routing system...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="routing-tab-root">
      
      {/* Header Card */}
      <div className="p-6 rounded-2xl border border-bento-border bg-bento-surface relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-bento-accent/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold flex items-center gap-2 text-bento-text-primary">
              <Shuffle className="h-5 w-5 text-bento-accent" />
              {lang === "id" ? "Routing Tugas AI (Field Routing)" : "AI Job Routing (Field Routing)"}
            </h2>
            <p className="text-xs text-bento-text-secondary">
              {lang === "id" 
                ? "Atur urutan pool provider (Tier 1 → 2 → 3) secara modular berdasarkan jenis tugas." 
                : "Manage modular provider pool routing orders (Tier 1 → 2 → 3) based on task types."}
            </p>
          </div>
          <button
            onClick={() => setFormOpen(!formOpen)}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-bento-accent text-white hover:bg-bento-accent/90 transition-all shadow-sm"
          >
            <Plus className="h-4 w-4" />
            {lang === "id" ? "Tambah Field Kustom" : "Add Custom Field"}
          </button>
        </div>
      </div>

      {/* Add Custom Field Form */}
      {formOpen && (
        <form onSubmit={handleAddField} className="p-5 rounded-2xl border border-bento-border bg-bento-surface-lighter space-y-4 animate-fadeIn">
          <h3 className="text-xs font-bold uppercase tracking-wider text-bento-text-primary">
            {lang === "id" ? "Buat Field Routing Baru" : "Create New Routing Field"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-bento-text-secondary uppercase">Field Key (Unique, lowercase, no spaces)</label>
              <input
                type="text"
                placeholder="e.g. ocr_invoice_scan"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-bento-border bg-bento-surface text-bento-text-primary focus:outline-none"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-bento-text-secondary uppercase">Display Name</label>
              <input
                type="text"
                placeholder="e.g. Invoice OCR Scanner"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-bento-border bg-bento-surface text-bento-text-primary focus:outline-none"
                required
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-bento-text-secondary uppercase">Description</label>
            <input
              type="text"
              placeholder="Description of the routing task context..."
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-bento-border bg-bento-surface text-bento-text-primary focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-4 justify-between pt-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto_mode_check"
                checked={newAuto}
                onChange={(e) => setNewAuto(e.target.checked)}
                className="rounded border-bento-border text-bento-accent bg-bento-surface focus:ring-0"
              />
              <label htmlFor="auto_mode_check" className="text-xs text-bento-text-secondary">
                {lang === "id" ? "Aktifkan Auto Mode (Auto Failover)" : "Enable Auto Mode (Auto Failover)"}
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="px-3 py-2 text-xs font-semibold rounded-lg bg-bento-surface border border-bento-border text-bento-text-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-2 text-xs font-semibold rounded-lg bg-bento-accent text-white hover:bg-bento-accent/90"
              >
                Create Field
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Grid of Routing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="routing-grid">
        {fields.map((f) => {
          const fieldTemps = tempAssignments[f.field_key] || { 1: "", 2: "", 3: "" };
          return (
            <div key={f.field_key} className="p-5 rounded-2xl border border-bento-border bg-bento-surface hover:border-bento-border-hover transition-all flex flex-col justify-between">
              
              {/* Card Title Block */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-xs text-bento-accent uppercase tracking-wider font-mono bg-bento-accent/10 px-2 py-0.5 rounded">
                      {f.field_key}
                    </span>
                    {f.last_tier_used && (
                      <span className="flex items-center gap-1 text-[9px] font-bold text-bento-success bg-bento-success/10 px-1.5 py-0.5 rounded animate-pulse">
                        <PlayCircle className="w-2.5 h-2.5" />
                        Tier {f.last_tier_used} Last Used
                      </span>
                    )}
                  </div>
                  
                  {/* Auto/Manual Toggle */}
                  <button
                    onClick={() => handleToggleAutoMode(f.field_key, f.auto_mode)}
                    className="flex items-center gap-1.5 text-xs text-bento-text-secondary hover:text-bento-text-primary transition-all"
                    title={lang === "id" ? "Toggle Auto/Manual routing" : "Toggle Auto/Manual routing"}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wider">
                      {f.auto_mode ? "Auto Mode" : "Manual"}
                    </span>
                    {f.auto_mode ? (
                      <ToggleRight className="h-5 w-5 text-bento-accent" />
                    ) : (
                      <ToggleLeft className="h-5 w-5 opacity-60" />
                    )}
                  </button>
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-bento-text-primary">{f.display_name}</h4>
                  <p className="text-xs text-bento-text-secondary leading-relaxed">{f.description || "(No description)"}</p>
                </div>
              </div>

              {/* Tiers Custom Selection Panel */}
              <div className="mt-5 space-y-3 pt-4 border-t border-bento-border/50">
                <h5 className="text-[10px] font-extrabold uppercase tracking-wider text-bento-text-secondary flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  {lang === "id" ? "Tingkatan Pool (Tiers)" : "Pool Assignment Order (Tiers)"}
                </h5>

                {/* Tier Rows */}
                {[1, 2, 3].map((tier) => (
                  <div key={tier} className="flex items-center justify-between gap-3 text-xs bg-bento-surface-lighter p-2 rounded-xl border border-bento-border/40">
                    <span className="font-bold text-bento-text-secondary w-16">Tier {tier}</span>
                    <select
                      value={fieldTemps[tier] || ""}
                      onChange={(e) => handleSelectProvider(f.field_key, tier, e.target.value)}
                      className="text-xs bg-bento-surface text-bento-text-primary px-2 py-1 rounded-lg border border-bento-border focus:outline-none min-w-[140px]"
                    >
                      <option value="">{lang === "id" ? "(Tidak Ada)" : "(None)"}</option>
                      <option value="gemini">Google Gemini</option>
                      <option value="gpt">OpenAI GPT</option>
                      <option value="claude">Anthropic Claude</option>
                      <option value="grok">x.ai Grok</option>
                      <option value="deepseek">Deepseek AI</option>
                      <option value="others">Others (GLM, Llama, DLL)</option>
                    </select>
                  </div>
                ))}

                {/* Save Button */}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => handleSaveAssignments(f.field_key)}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-bento-accent/10 text-bento-accent hover:bg-bento-accent hover:text-white transition-all border border-bento-accent/20"
                  >
                    <Save className="h-3.5 h-3.5" />
                    {lang === "id" ? "Simpan Urutan" : "Save Pool Order"}
                  </button>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* Face Liveness Notice Banner */}
      <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-400 flex items-start gap-3">
        <Info className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h5 className="text-xs font-bold uppercase tracking-wider">Face Liveness Scan Policy Notice</h5>
          <p className="text-xs leading-relaxed opacity-90">
            Field <code>face_liveness_scan</code> is currently a reserved placeholder only (auto_mode = false) and does not have any active pool assignments. Implementing biometrics, live cameras, or face verification triggers requires a separate legal review regarding data privacy and user consent before implementation.
          </p>
        </div>
      </div>

    </div>
  );
}
