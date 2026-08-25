'use client';

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FileText, Image as ImageIcon, Volume2, Binary } from "lucide-react";
import { ApiConnection, Language, UsageLog } from "@/lib/types";
import { translations } from "@/lib/i18n";

const POLL_INTERVAL_MS = 15000;
const MAX_VISIBLE_ITEMS = 20;

interface ActivityFeedProps {
  initialLogs: UsageLog[];
  connections: ApiConnection[];
  lang: Language;
}

function getTaskIcon(type: string) {
  switch (type) {
    case "text": return <FileText className="h-3.5 w-3.5 text-blue-400" />;
    case "image": return <ImageIcon className="h-3.5 w-3.5 text-pink-400" />;
    case "audio": return <Volume2 className="h-3.5 w-3.5 text-amber-400" />;
    default: return <Binary className="h-3.5 w-3.5 text-teal-400" />;
  }
}

function getCriticalReason(log: UsageLog, connections: ApiConnection[], unhealthyLabel: string): string | null {
  if (log.ocr_fallback_to_gpt) return "Fallback to GPT";
  if (log.ocr_fallback_to_claude) return "Fallback to Claude";
  const isUnhealthy = connections.some(c => c.provider === log.provider && !c.connected);
  if (isUnhealthy) return unhealthyLabel;
  return null;
}

export default function ActivityFeed({ initialLogs, connections, lang }: ActivityFeedProps) {
  const t = translations[lang];
  const [items, setItems] = useState<UsageLog[]>(() => initialLogs.slice(0, MAX_VISIBLE_ITEMS));
  const seenIds = useRef<Set<string>>(new Set(initialLogs.slice(0, MAX_VISIBLE_ITEMS).map(l => l.id)));

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/logs");
        if (!res.ok) return;
        const data: UsageLog[] = await res.json();
        if (!Array.isArray(data)) return;

        const newRows = data.filter(l => !seenIds.current.has(l.id));
        if (newRows.length === 0) return;

        newRows.forEach(l => seenIds.current.add(l.id));
        setItems(prev => [...newRows, ...prev].slice(0, MAX_VISIBLE_ITEMS));
      } catch {
        // silent — next tick retries
      }
    };

    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const criticalCount = items.filter(l => getCriticalReason(l, connections, t.providerUnhealthyBadge) !== null).length;

  return (
    <div className="p-4 sm:p-6 rounded-2xl border border-bento-border bg-bento-surface flex flex-col h-full" id="activity-feed-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="font-bold text-base tracking-tight mb-1 text-bento-text-primary">{t.recentActivity}</h4>
          <p className="text-[10px] text-bento-text-secondary">{t.recentActivitySub}</p>
        </div>
        {criticalCount > 0 && (
          <span className="text-[10px] font-extrabold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-full shrink-0">
            {criticalCount} {lang === 'id' ? 'kritis' : 'critical'}
          </span>
        )}
      </div>

      <ul className="space-y-1.5 max-h-[440px] overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {items.length === 0 ? (
            <p className="text-[11px] text-bento-text-secondary italic py-4 text-center">
              {lang === 'id' ? 'Belum ada aktivitas.' : 'No activity yet.'}
            </p>
          ) : (
            items.map(log => {
              const reason = getCriticalReason(log, connections, t.providerUnhealthyBadge);
              return (
                <motion.li
                  key={log.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="p-2.5 rounded-xl bg-bento-surface-lighter border border-bento-border"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-bento-text-primary truncate">{log.app_name || "Unknown App"}</span>
                    <span className="text-[9px] text-bento-text-secondary shrink-0">
                      {new Date(log.created_at).toLocaleTimeString(lang === 'id' ? 'id-ID' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-bento-accent/10 text-bento-accent border border-bento-accent/15">
                      {log.provider}
                    </span>
                    <div className="flex items-center gap-1 text-bento-text-secondary">
                      {getTaskIcon(log.task_type)}
                    </div>
                    <span className="text-[9px] text-bento-text-secondary font-mono">{log.tokens_used.toLocaleString()} tok</span>
                    {reason && (
                      <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 text-[8px] font-extrabold uppercase border border-red-500/20">
                        {reason}
                      </span>
                    )}
                  </div>
                </motion.li>
              );
            })
          )}
        </AnimatePresence>
      </ul>
    </div>
  );
}
