'use client';

import { Language } from "@/lib/types";
import { translations } from "@/lib/i18n";
import { getProviderColor } from "@/lib/providerDisplay";

export interface UsageRankRow {
  provider: string;
  displayName: string;
  count: number;
  percent: number;
  costUsd: string;
}

export interface ActiveModelRow {
  provider: string;
  displayName: string;
  model: string;
}

interface RankingCardProps {
  usageRows: UsageRankRow[];
  activeModelRows: ActiveModelRow[];
  highlightedProvider: string | null;
  onSelectProvider: (provider: string) => void;
  lang: Language;
}

export default function RankingCard({ usageRows, activeModelRows, highlightedProvider, onSelectProvider, lang }: RankingCardProps) {
  const t = translations[lang];
  const activeModelByProvider = new Map(activeModelRows.map(row => [row.provider, row]));

  return (
    <div className="p-4 sm:p-6 rounded-2xl border border-bento-border bg-bento-surface flex flex-col h-full" id="ranking-card">
      <div className="mb-4">
        <h4 className="font-bold text-base tracking-tight mb-1 text-bento-text-primary">{t.rankingCardTitle}</h4>
      </div>

      <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
        {usageRows.length === 0 ? (
          <p className="text-[11px] text-bento-text-secondary italic py-4 text-center">
            {lang === 'id' ? 'Belum ada data panggilan.' : 'No call data yet.'}
          </p>
        ) : (
          usageRows.map((row, i) => {
            const color = getProviderColor(row.provider);
            const activeModel = activeModelByProvider.get(row.provider);
            const isHighlighted = highlightedProvider === row.provider;
            return (
              <button
                key={row.provider}
                type="button"
                onClick={() => onSelectProvider(row.provider)}
                className={`w-full text-left p-2.5 rounded-xl border transition-all ${
                  isHighlighted
                    ? 'bg-bento-surface-lighter border-bento-accent'
                    : 'border-transparent hover:bg-bento-surface-lighter hover:border-bento-border'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-mono font-bold text-bento-text-secondary w-4 shrink-0">#{i + 1}</span>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-xs font-bold text-bento-text-primary truncate">{row.displayName}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-bento-text-secondary shrink-0">{row.count}x</span>
                </div>
                <div className="mt-1.5 h-1 rounded-full bg-bento-surface-lighter overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${row.percent}%`, backgroundColor: color }} />
                </div>
                {activeModel && (
                  <p className="mt-1.5 text-[9px] text-bento-text-secondary truncate">
                    {t.rankingLiveRoutingLabel}: <span className="font-semibold text-bento-text-primary">{activeModel.model}</span>
                  </p>
                )}
              </button>
            );
          })
        )}
      </div>

      {activeModelRows.length > 0 && (
        <p className="mt-3 pt-3 border-t border-bento-border/50 text-[9px] text-bento-text-secondary italic leading-relaxed">
          {t.rankingLiveRoutingNote}
        </p>
      )}
    </div>
  );
}
