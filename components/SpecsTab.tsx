'use client';

import { useState, useEffect } from "react";
import { Sparkles, PlayCircle, Code, Edit3, HelpCircle, UploadCloud, RefreshCw, CheckCircle, AlertTriangle, Layers, Save, X } from "lucide-react";
import { Language } from "@/lib/types";

interface FieldSpec {
  field_key: string;
  display_name: string;
  system_prompt: string;
  output_schema: any;
  example_input_description: string | null;
  example_output: any;
  updated_at?: string;
}

interface SpecsTabProps {
  lang: Language;
  theme: 'dark' | 'light';
}

export default function SpecsTab({ lang, theme }: SpecsTabProps) {
  const [specs, setSpecs] = useState<FieldSpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Editor States
  const [activeSpec, setActiveSpec] = useState<FieldSpec | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [tempPrompt, setTempPrompt] = useState("");
  const [tempSchema, setTempSchema] = useState("");
  const [tempExampleInput, setTempExampleInput] = useState("");
  const [tempExampleOutput, setTempExampleOutput] = useState("");
  const [saving, setSaving] = useState(false);

  // Sandbox Test States
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [sandboxSpec, setSandboxSpec] = useState<FieldSpec | null>(null);
  const [sandboxPrompt, setSandboxPrompt] = useState("");
  const [sandboxFileBase64, setSandboxFileBase64] = useState<string | null>(null);
  const [sandboxFileName, setSandboxFileName] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [sandboxResult, setSandboxResult] = useState<any | null>(null);

  const fetchSpecs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/routing/specs");
      if (!res.ok) throw new Error("Failed to load specifications data");
      const data = await res.json();
      setSpecs(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpecs();
  }, []);

  const openEditor = (spec: FieldSpec) => {
    setActiveSpec(spec);
    setTempPrompt(spec.system_prompt || "");
    setTempSchema(spec.output_schema ? JSON.stringify(spec.output_schema, null, 2) : "");
    setTempExampleInput(spec.example_input_description || "");
    setTempExampleOutput(spec.example_output ? JSON.stringify(spec.example_output, null, 2) : "");
    setEditorOpen(true);
  };

  const handleSaveSpec = async () => {
    if (!activeSpec) return;
    setSaving(true);
    try {
      // Validate JSON fields if present
      let parsedSchema = null;
      if (tempSchema.trim() !== "") {
        try {
          parsedSchema = JSON.parse(tempSchema);
        } catch (e: any) {
          throw new Error(`Output Schema is not valid JSON: ${e.message}`);
        }
      }

      let parsedExampleOutput = null;
      if (tempExampleOutput.trim() !== "") {
        try {
          parsedExampleOutput = JSON.parse(tempExampleOutput);
        } catch (e: any) {
          throw new Error(`Example Output is not valid JSON: ${e.message}`);
        }
      }

      const res = await fetch("/api/routing/specs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_spec",
          field_key: activeSpec.field_key,
          system_prompt: tempPrompt,
          output_schema: parsedSchema,
          example_input_description: tempExampleInput || null,
          example_output: parsedExampleOutput
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to update specification");
      }

      setEditorOpen(false);
      await fetchSpecs();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openSandbox = (spec: FieldSpec) => {
    setSandboxSpec(spec);
    setSandboxPrompt(spec.example_input_description || "Jalankan instruksi ini...");
    setSandboxFileBase64(null);
    setSandboxFileName(null);
    setSandboxResult(null);
    setSandboxOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSandboxFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setSandboxFileBase64(reader.result as string);
    };
    reader.onerror = () => {
      alert("Gagal membaca file");
    };
    reader.readAsDataURL(file);
  };

  const runSandboxTest = async () => {
    if (!sandboxSpec) return;
    setTesting(true);
    setSandboxResult(null);

    try {
      const res = await fetch("/api/internal/sandbox-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          field: sandboxSpec.field_key,
          prompt: sandboxPrompt,
          file: sandboxFileBase64 || undefined
        })
      });

      const resData = await res.json();
      setSandboxResult(resData);
    } catch (err: any) {
      setSandboxResult({ error: err.message || "Request failed" });
    } finally {
      setTesting(false);
    }
  };

  if (loading && specs.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <span className="text-xs opacity-60 animate-pulse">Loading specifications module...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn" id="specs-tab-root">
      
      {/* Header Banner */}
      <div className="p-6 rounded-2xl border border-bento-border bg-bento-surface relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-bento-accent/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold flex items-center gap-2 text-bento-text-primary">
              <Sparkles className="h-5 w-5 text-bento-accent" />
              {lang === "id" ? "Spesifikasi Pekerjaan (Job Specs)" : "Job Specifications (Specs)"}
            </h2>
            <p className="text-xs text-bento-text-secondary">
              {lang === "id"
                ? "Atur instruksi dasar (system prompts) dan skema output JSON untuk setiap field secara mandiri."
                : "Manage base instructions (system prompts) and output JSON schemas for each AI field independently."}
            </p>
          </div>
        </div>
      </div>

      {/* Main List */}
      <div className="grid grid-cols-1 gap-4">
        {specs.map((s) => {
          const isOcr = s.output_schema !== null;
          return (
            <div 
              key={s.field_key}
              className="p-5 rounded-2xl border border-bento-border bg-bento-surface hover:border-bento-accent/30 hover:shadow-md transition-all duration-200"
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="space-y-3 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-bento-text-primary truncate">{s.display_name}</span>
                    <code className="px-1.5 py-0.5 rounded text-[10px] bg-bento-surface-lighter font-mono text-bento-text-secondary border border-bento-border">
                      {s.field_key}
                    </code>
                    {isOcr ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-bento-accent-muted text-bento-accent border border-bento-accent/10">
                        {lang === "id" ? "Terstruktur (JSON)" : "Structured (JSON)"}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-bento-success-muted text-bento-success border border-bento-success/10">
                        {lang === "id" ? "Bebas (Teks/Chat)" : "Free-form (Chat)"}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-bento-text-secondary">System Instruction</span>
                    <p className="text-xs text-bento-text-primary line-clamp-3 bg-bento-surface-lighter p-3 rounded-lg border border-bento-border/50 italic leading-relaxed">
                      {s.system_prompt || "— Belum ada instruksi dasar —"}
                    </p>
                  </div>

                  {isOcr && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-bento-text-secondary">Output Schema Keys</span>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.keys(s.output_schema || {}).map((k) => (
                          <span key={k} className="px-1.5 py-0.5 rounded bg-bento-surface-lighter text-[10px] font-mono text-bento-text-secondary border border-bento-border/40">
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex lg:flex-col gap-2 shrink-0 justify-end pt-2 lg:pt-0">
                  <button
                    onClick={() => openEditor(s)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-bento-surface-lighter hover:bg-bento-border/30 border border-bento-border text-bento-text-primary transition-all shadow-sm"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    {lang === "id" ? "Edit Spec" : "Edit Spec"}
                  </button>
                  <button
                    onClick={() => openSandbox(s)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-bento-accent-muted hover:bg-bento-accent text-bento-accent hover:text-white transition-all shadow-sm"
                  >
                    <PlayCircle className="h-3.5 w-3.5" />
                    {lang === "id" ? "Sandbox Test" : "Sandbox Test"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: SPEC EDITOR */}
      {editorOpen && activeSpec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-3xl rounded-2xl border border-bento-border bg-bento-surface shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-bento-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-bento-text-primary">
                  Edit Specification: {activeSpec.display_name}
                </h3>
                <code className="text-[10px] text-bento-text-secondary font-mono">{activeSpec.field_key}</code>
              </div>
              <button 
                onClick={() => setEditorOpen(false)}
                className="p-1.5 rounded-lg hover:bg-bento-surface-lighter text-bento-text-secondary transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Form */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              
              {/* System Prompt TextArea */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-bento-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                  System Instruction / Prompt
                  <HelpCircle className="h-3 w-3 text-bento-text-secondary/60" />
                </label>
                <textarea
                  value={tempPrompt}
                  onChange={(e) => setTempPrompt(e.target.value)}
                  rows={6}
                  className="w-full text-xs p-3 rounded-lg border border-bento-border bg-bento-surface-lighter focus:ring-1 focus:ring-bento-accent/50 focus:border-bento-accent/50 text-bento-text-primary leading-relaxed font-sans"
                  placeholder="Contoh: Kamu adalah validator dokumen..."
                />
                <p className="text-[10px] text-bento-text-secondary">
                  Gunakan variabel <code className="bg-bento-surface-lighter px-1 py-0.5 rounded font-mono text-[9px]">[nama aplikasi pemanggil]</code> untuk mengganti nama aplikasi klien secara dinamis di runtime.
                </p>
              </div>

              {/* Output Schema Editor (JSON) */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-bento-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                  Output Schema (JSON format)
                  <HelpCircle className="h-3 w-3 text-bento-text-secondary/60" />
                </label>
                <textarea
                  value={tempSchema}
                  onChange={(e) => setTempSchema(e.target.value)}
                  rows={8}
                  className="w-full text-xs font-mono p-3 rounded-lg border border-bento-border bg-bento-surface-lighter focus:ring-1 focus:ring-bento-accent/50 focus:border-bento-accent/50 text-bento-text-primary"
                  placeholder='{\n  "is_valid": "boolean",\n  "warnings": "string[]"\n}'
                />
              </div>

              {/* Example Input Description */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-bento-text-secondary uppercase tracking-wider">
                  Example Input / Prompt Description (for sandbox default)
                </label>
                <input
                  type="text"
                  value={tempExampleInput}
                  onChange={(e) => setTempExampleInput(e.target.value)}
                  className="w-full text-xs p-3 rounded-lg border border-bento-border bg-bento-surface-lighter focus:ring-1 focus:ring-bento-accent/50 focus:border-bento-accent/50 text-bento-text-primary"
                  placeholder="Ekstrak paspor Indonesia ini"
                />
              </div>

              {/* Example Output JSON */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-bento-text-secondary uppercase tracking-wider">
                  Example Output (JSON)
                </label>
                <textarea
                  value={tempExampleOutput}
                  onChange={(e) => setTempExampleOutput(e.target.value)}
                  rows={4}
                  className="w-full text-xs font-mono p-3 rounded-lg border border-bento-border bg-bento-surface-lighter focus:ring-1 focus:ring-bento-accent/50 focus:border-bento-accent/50 text-bento-text-primary"
                  placeholder='{\n  "document_type": "passport"\n}'
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 border-t border-bento-border bg-bento-surface-lighter flex justify-end gap-3">
              <button
                onClick={() => setEditorOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-bento-surface hover:bg-bento-border/30 border border-bento-border text-bento-text-primary transition-all shadow-sm"
              >
                {lang === "id" ? "Batal" : "Cancel"}
              </button>
              <button
                onClick={handleSaveSpec}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-bento-accent text-white hover:bg-bento-accent/90 transition-all disabled:opacity-50 shadow-sm"
              >
                {saving ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {lang === "id" ? "Simpan Perubahan" : "Save Changes"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: SANDBOX TEST */}
      {sandboxOpen && sandboxSpec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-4xl rounded-2xl border border-bento-border bg-bento-surface shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-bento-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-bento-text-primary flex items-center gap-1.5">
                  <PlayCircle className="h-4 w-4 text-bento-accent" />
                  Sandbox Test Console: {sandboxSpec.display_name}
                </h3>
                <code className="text-[10px] text-bento-text-secondary font-mono">{sandboxSpec.field_key}</code>
              </div>
              <button 
                onClick={() => setSandboxOpen(false)}
                className="p-1.5 rounded-lg hover:bg-bento-surface-lighter text-bento-text-secondary transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Split Screen Layout */}
            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2">
              
              {/* Left Column: Sandbox Config */}
              <div className="p-6 overflow-y-auto space-y-4 border-b lg:border-b-0 lg:border-r border-bento-border">
                <h4 className="text-xs font-bold text-bento-text-primary uppercase tracking-wider">Test Configuration</h4>

                {/* Prompt Input */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-bento-text-secondary uppercase">User Prompt Input</label>
                  <textarea
                    value={sandboxPrompt}
                    onChange={(e) => setSandboxPrompt(e.target.value)}
                    rows={3}
                    className="w-full text-xs p-3 rounded-lg border border-bento-border bg-bento-surface-lighter focus:ring-1 focus:ring-bento-accent/50 focus:border-bento-accent/50 text-bento-text-primary"
                    placeholder="Instruksi pengujian..."
                  />
                </div>

                {/* File Upload Dropzone */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-bento-text-secondary uppercase">Attachment / Document File</label>
                  <div className="relative border-2 border-dashed border-bento-border rounded-xl p-6 bg-bento-surface-lighter flex flex-col items-center justify-center hover:border-bento-accent/50 hover:bg-bento-surface-lighter/50 transition-all group">
                    <input
                      type="file"
                      accept="image/*,application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/csv,.csv,text/plain,.txt"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <UploadCloud className="h-8 w-8 text-bento-text-secondary/60 group-hover:text-bento-accent transition-colors mb-2" />
                    <span className="text-xs font-semibold text-bento-text-primary">
                      {sandboxFileName ? sandboxFileName : "Upload file / scan dokumen"}
                    </span>
                    <span className="text-[10px] text-bento-text-secondary mt-1">
                      Mendukung: JPG, PNG, HEIC, PDF, DOCX, CSV, TXT — maks 2MB.
                    </span>
                  </div>
                  {sandboxFileBase64 && (
                    <div className="p-3 rounded-lg bg-bento-success-muted/10 border border-bento-success/20 flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-bento-success flex items-center gap-1">
                        <CheckCircle className="h-3.5 w-3.5" />
                        File terlampir (Base64 ready)
                      </span>
                      <button 
                        onClick={() => { setSandboxFileBase64(null); setSandboxFileName(null); }}
                        className="text-[10px] text-bento-text-secondary hover:text-bento-error underline"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                {/* Run Button */}
                <button
                  onClick={runSandboxTest}
                  disabled={testing || !sandboxPrompt}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-bento-accent text-white font-semibold hover:bg-bento-accent/90 disabled:opacity-50 transition-all shadow-md text-xs"
                >
                  {testing ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      {lang === "id" ? "Mengeksekusi..." : "Executing..."}
                    </>
                  ) : (
                    <>
                      <PlayCircle className="h-4 w-4" />
                      {lang === "id" ? "Jalankan Tes Real-time" : "Run Live Sandbox Test"}
                    </>
                  )}
                </button>
              </div>

              {/* Right Column: API Response output */}
              <div className="p-6 overflow-y-auto bg-black/[0.03] dark:bg-black/[0.2] flex flex-col h-full min-h-[300px]">
                <h4 className="text-xs font-bold text-bento-text-primary uppercase tracking-wider mb-2">Gateway Envelope Response</h4>
                
                <div className="flex-1 rounded-xl border border-bento-border bg-[#0B0D0F] p-4 font-mono text-[11px] text-green-400 overflow-auto max-h-[450px]">
                  {testing ? (
                    <span className="text-bento-text-secondary italic animate-pulse">Menghubungi AI Gateway dan menunggu respon...</span>
                  ) : sandboxResult ? (
                    <pre className="whitespace-pre">{JSON.stringify(sandboxResult, null, 2)}</pre>
                  ) : (
                    <span className="text-bento-text-secondary/50 italic">Hasil uji coba API akan muncul di sini secara real-time.</span>
                  )}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-bento-border bg-bento-surface-lighter flex justify-end">
              <button
                onClick={() => setSandboxOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-bento-surface border border-bento-border text-bento-text-primary hover:bg-bento-border/30 transition-all shadow-sm"
              >
                {lang === "id" ? "Tutup Sandbox" : "Close Sandbox"}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
