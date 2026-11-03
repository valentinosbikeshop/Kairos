'use client';

import React, { useMemo, useState } from 'react';
import { SCIENCE_TIPS, ScienceTip } from '@/lib/knowledgeBase';
import { normalizeSearchText } from '@/lib/exerciseDatabase';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';

type TopicFilter = 'Todos' | ScienceTip['topic'];

export function ScienceLibraryView() {
  const [topic, setTopic] = useState<TopicFilter>('Todos');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(SCIENCE_TIPS[0]?.id ?? null);

  const topics: TopicFilter[] = [
    'Todos',
    'Hipertrofia',
    'Fuerza',
    'Calistenia',
    'Hyrox & Cardio',
    'Recuperación',
  ];

  const filteredTips = useMemo(() => {
    const q = normalizeSearchText(query);
    return SCIENCE_TIPS.filter((tip) => {
      if (topic !== 'Todos' && tip.topic !== topic) return false;
      if (!q) return true;
      const haystack = normalizeSearchText(
        `${tip.title} ${tip.plainExplanation} ${tip.practicalAction} ${tip.citation} ${tip.topic}`
      );
      return q.split(' ').every((tok) => haystack.includes(tok));
    });
  }, [topic, query]);

  return (
    <div className="px-5 ios-page-safe-pt pb-28 space-y-5">
      {/* Calm Gothic Header */}
      <div className="space-y-1">
        <h1 className="font-gothic text-xl font-semibold tracking-wide text-brand">
          Ciencia Aplicada
        </h1>
        <p className="text-xs text-brand-muted leading-relaxed">
          Hallazgos recientes explicados de forma simple para entrenar con criterio.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-subtle" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar tema (ej: descanso, fallo, estiramiento...)"
          className="w-full rounded-xl border border-stoneborder bg-surface py-2.5 pl-10 pr-3 text-[16px] text-brand placeholder-brand-subtle focus:border-gothic focus:outline-none"
        />
      </div>

      {/* Topic Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {topics.map((t) => {
          const active = topic === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTopic(t)}
              className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'border-gothic bg-gothic/15 text-brand'
                  : 'border-stoneborder bg-surface text-brand-muted hover:text-brand'
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>

      {/* Pure Science Cards (Zero quotes clutter) */}
      <div className="space-y-3">
        {filteredTips.map((tip) => {
          const isOpen = openId === tip.id;
          return (
            <article
              key={tip.id}
              className="rounded-2xl border border-stoneborder bg-surface overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : tip.id)}
                className="w-full p-4 text-left flex items-start justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <span className="text-[11px] text-gothic">
                    {tip.topic} · {tip.year}
                  </span>
                  <h2 className="text-sm font-semibold text-brand leading-snug">{tip.title}</h2>
                  {!isOpen && (
                    <p className="text-xs text-brand-muted leading-relaxed">{tip.shortPreview}</p>
                  )}
                </div>
                <div className="mt-1 shrink-0 text-brand-subtle">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-stoneborder bg-background/60 px-4 py-3.5 space-y-3 animate-fade-up">
                  <p className="text-xs text-brand leading-relaxed">{tip.plainExplanation}</p>

                  <div className="border-l-2 border-gothic/60 pl-3 py-0.5">
                    <span className="block text-[10px] uppercase tracking-wider text-gothic mb-0.5">
                      En la práctica
                    </span>
                    <p className="text-xs text-brand-muted leading-relaxed">
                      {tip.practicalAction}
                    </p>
                  </div>

                  <p className="text-[11px] text-brand-subtle">
                    Estudio: {tip.citation} ({tip.year})
                  </p>
                </div>
              )}
            </article>
          );
        })}

        {filteredTips.length === 0 && (
          <div className="rounded-2xl border border-stoneborder bg-surface p-8 text-center text-xs text-brand-muted">
            No encontramos estudios con esa búsqueda.
          </div>
        )}
      </div>
    </div>
  );
}
