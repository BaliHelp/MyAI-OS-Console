'use client';

import { useState, useMemo } from "react";
import { Network, Search, X, User, FileText, Shield, CreditCard, MessageSquare, Layers } from "lucide-react";
import { extractGraphFromRecord, GraphNode, GraphEdge } from "@/lib/graphify-engine";

interface GraphifyViewerProps {
  records: any[];
  onClose: () => void;
}

const NODE_ICONS: Record<string, any> = {
  USER: User,
  DOCUMENT: FileText,
  PASSPORT: Shield,
  VISA: Layers,
  TRANSACTION: CreditCard,
  CHAT: MessageSquare,
  APP: Network,
};

const NODE_COLORS: Record<string, string> = {
  USER: "bg-purple-500/20 border-purple-500/50 text-purple-300",
  DOCUMENT: "bg-blue-500/20 border-blue-500/50 text-blue-300",
  PASSPORT: "bg-emerald-500/20 border-emerald-500/50 text-emerald-300",
  VISA: "bg-amber-500/20 border-amber-500/50 text-amber-300",
  TRANSACTION: "bg-pink-500/20 border-pink-500/50 text-pink-300",
  CHAT: "bg-sky-500/20 border-sky-500/50 text-sky-300",
  APP: "bg-bento-accent/20 border-bento-accent/50 text-bento-accent",
};

export default function GraphifyViewer({ records, onClose }: GraphifyViewerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Extract combined graph from all records
  const graph = useMemo(() => {
    const nodeMap = new Map<string, GraphNode>();
    const edgeMap = new Map<string, GraphEdge>();

    records.forEach(r => {
      const { nodes, edges } = extractGraphFromRecord(r);
      nodes.forEach(n => nodeMap.set(n.id, n));
      edges.forEach(e => edgeMap.set(e.id, e));
    });

    return {
      nodes: Array.from(nodeMap.values()),
      edges: Array.from(edgeMap.values()),
    };
  }, [records]);

  // Filtered nodes based on search
  const filteredNodes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return graph.nodes;
    return graph.nodes.filter(n =>
      n.label.toLowerCase().includes(q) ||
      n.type.toLowerCase().includes(q) ||
      JSON.stringify(n.properties).toLowerCase().includes(q)
    );
  }, [graph.nodes, searchQuery]);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-5xl h-[85vh] flex flex-col rounded-3xl border border-bento-border bg-[#0e0f12] shadow-2xl overflow-hidden text-white">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-bento-border flex items-center justify-between gap-4 shrink-0 bg-black/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-bento-accent/15 border border-bento-accent/30 text-bento-accent">
              <Network className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold flex items-center gap-2">
                Graphify Knowledge Engine Map
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  {graph.nodes.length} Simpul (Nodes) · {graph.edges.length} Relasi (Edges)
                </span>
              </h3>
              <p className="text-xs text-gray-400">Peta keterhubungan entitas data & dokumen terstruktur di Master Data Center</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl border border-bento-border hover:bg-bento-surface-lighter text-gray-400 hover:text-white transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-3 border-b border-bento-border bg-black/20 flex items-center gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari entitas node (contoh: paspor, nama user, visa, app)..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-bento-border bg-black/40 text-white focus:border-bento-accent outline-none"
            />
          </div>
        </div>

        {/* Graph Canvas Grid / Node Map */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Node Cards List */}
          <div className="md:col-span-2 space-y-3 overflow-y-auto max-h-[60vh] pr-2 scrollbar-thin">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Simpul Entitas Terdeteksi ({filteredNodes.length})</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredNodes.map(node => {
                const IconComponent = NODE_ICONS[node.type] || FileText;
                const isSelected = selectedNode?.id === node.id;
                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      NODE_COLORS[node.type] || "bg-gray-800/40 border-gray-700 text-gray-300"
                    } ${isSelected ? "ring-2 ring-bento-accent border-bento-accent scale-[1.02]" : "hover:scale-[1.01]"}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <IconComponent className="h-4 w-4 shrink-0" />
                        <span className="text-xs font-extrabold truncate">{node.label}</span>
                      </div>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/30 border border-white/10 uppercase">
                        {node.type}
                      </span>
                    </div>

                    {Object.keys(node.properties).length > 0 && (
                      <div className="text-[10px] font-mono space-y-0.5 opacity-80 bg-black/20 p-2 rounded-lg border border-white/5">
                        {Object.entries(node.properties).slice(0, 3).map(([k, v]) => (
                          <div key={k} className="truncate">
                            <span className="text-gray-400">{k}:</span> {String(v)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Connected Relational Details Panel */}
          <div className="border border-bento-border bg-black/40 rounded-2xl p-4 flex flex-col justify-between h-full">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Detail Relasi Node</p>
              {selectedNode ? (
                <div className="space-y-3">
                  <div className={`p-3 rounded-xl border ${NODE_COLORS[selectedNode.type]}`}>
                    <span className="text-[9px] font-mono uppercase font-bold block opacity-70">{selectedNode.type}</span>
                    <h4 className="font-extrabold text-sm mt-0.5">{selectedNode.label}</h4>
                  </div>

                  <div>
                    <p className="text-[11px] font-bold text-gray-300 mb-1.5">Koneksi Relasi Edges:</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {graph.edges
                        .filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
                        .map(edge => {
                          const otherId = edge.source === selectedNode.id ? edge.target : edge.source;
                          const otherNode = graph.nodes.find(n => n.id === otherId);
                          return (
                            <div key={edge.id} className="p-2 rounded-xl bg-bento-surface border border-bento-border text-[10px] space-y-1">
                              <span className="font-bold text-bento-accent font-mono uppercase block">{edge.relation}</span>
                              <p className="text-white font-semibold">→ {otherNode?.label || otherId}</p>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-gray-500 opacity-60">
                  <Network className="h-8 w-8 mx-auto mb-2 stroke-1" />
                  <p className="text-xs">Klik salah satu simpul entitas di sebelah kiri untuk melihat peta koneksinya.</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-bento-border text-[10px] text-gray-400 flex items-center justify-between">
              <span>Graph Engine: Active</span>
              <span className="text-emerald-400 font-bold">RAG Optimized</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
