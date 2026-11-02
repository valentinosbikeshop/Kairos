'use client';

import React, { useState } from 'react';
import { ExerciseEvaluation } from '@/types/kairos';
import { formatMmSs } from '@/lib/formatters';

interface VectorEvolutionChartProps {
  evaluation: ExerciseEvaluation;
  userWeightKg?: number;
}

export function VectorEvolutionChart({
  evaluation,
  userWeightKg,
}: VectorEvolutionChartProps) {
  const points = evaluation.history;
  const [selectedIndex, setSelectedIndex] = useState<number>(Math.max(0, points.length - 1));

  const safeIdx = Math.min(points.length - 1, Math.max(0, selectedIndex));
  const activePoint = points[safeIdx];

  if (!points.length || !activePoint) {
    return null;
  }

  const width = 340;
  const height = 140;
  const padX = 18;
  const padTop = 20;
  const padBottom = 26;
  const plotW = width - padX * 2;
  const plotH = height - padTop - padBottom;

  const primaries = points.map((p) => p.primaryMetric);
  const minP = Math.min(...primaries);
  const maxP = Math.max(...primaries);
  const spanP = maxP - minP || Math.max(1, maxP * 0.1);
  const isLowerBetter = Boolean(activePoint.isLowerBetter);

  const bestMetric = isLowerBetter ? minP : maxP;

  const coords = points.map((pt, i) => {
    const x =
      points.length === 1
        ? padX + plotW / 2
        : padX + (i / (points.length - 1)) * plotW;

    const norm = isLowerBetter
      ? (maxP - pt.primaryMetric) / spanP
      : (pt.primaryMetric - minP) / spanP;

    const clamped = points.length === 1 ? 0.55 : 0.18 + norm * 0.68;
    const y = padTop + plotH * (1 - clamped);
    return { x, y, pt, index: i };
  });

  // Smooth cubic Bezier curve instead of jagged stock-market lines
  let smoothPath = '';
  if (coords.length > 1) {
    smoothPath = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const curr = coords[i];
      const next = coords[i + 1];
      const midX = ((curr.x + next.x) / 2).toFixed(1);
      smoothPath += ` C ${midX} ${curr.y.toFixed(1)}, ${midX} ${next.y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
    }
  }

  const areaPath =
    coords.length > 1
      ? `${smoothPath} L ${coords[coords.length - 1].x.toFixed(1)} ${(padTop + plotH).toFixed(
          1
        )} L ${coords[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
      : '';

  const formatVal = (val: number, unit: string) => {
    if (unit === 's/km') return `${formatMmSs(val)} /km`;
    if (unit === 's/100m') return `${formatMmSs(val)} /100m`;
    if (unit === 'seg Split') return formatMmSs(val);
    if (unit.includes('kg')) return `${Math.round(val * 10) / 10} kg`;
    return `${Math.round(val * 10) / 10} ${unit}`;
  };

  // Relative strength note personalized to user's body weight
  const relativeRatio =
    userWeightKg &&
    userWeightKg > 30 &&
    activePoint.primaryUnit.includes('kg') &&
    activePoint.primaryMetric > 0
      ? Math.round((activePoint.primaryMetric / userWeightKg) * 100) / 100
      : null;

  return (
    <div className="rounded-2xl border border-stoneborder bg-background/70 p-4 space-y-3">
      {/* Calm Two-Column Milestone Summary */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <span className="block text-[11px] text-brand-muted">
            Sesión del {activePoint.dateLabel}
          </span>
          <div className="mt-0.5 text-lg font-semibold tabular-nums text-brand">
            {activePoint.summaryText}
          </div>
        </div>

        <div className="text-right">
          <span className="block text-[11px] text-brand-muted">Mejor marca</span>
          <span className="text-sm font-semibold tabular-nums text-gothic">
            {formatVal(bestMetric, activePoint.primaryUnit)}
          </span>
        </div>
      </div>

      {/* Serene Single-Arc Curve (No grids, no candlesticks) */}
      <div className="relative w-full select-none pt-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible"
          role="img"
          aria-label={`Evolución en ${evaluation.exerciseName}`}
        >
          <defs>
            <linearGradient id={`bronze_arc_${evaluation.catalogId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#B5A082" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#B5A082" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Subtle base horizon */}
          <line
            x1={padX}
            y1={padTop + plotH}
            x2={width - padX}
            y2={padTop + plotH}
            stroke="#27242E"
            strokeWidth="1"
          />

          {areaPath && <path d={areaPath} fill={`url(#bronze_arc_${evaluation.catalogId})`} />}

          {smoothPath && (
            <path
              d={smoothPath}
              fill="none"
              stroke="#B5A082"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          )}

          {coords.map((c) => {
            const isSelected = c.index === safeIdx;
            return (
              <g
                key={c.pt.sessionId}
                onClick={() => setSelectedIndex(c.index)}
                className="cursor-pointer"
              >
                <rect x={c.x - 18} y={0} width={36} height={height} fill="transparent" />
                {isSelected && (
                  <circle cx={c.x} cy={c.y} r={8} fill="#B5A082" fillOpacity="0.18" />
                )}
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={isSelected ? 4.5 : 3.2}
                  fill={isSelected ? '#DDD7CC' : '#B5A082'}
                  stroke="#0E0D10"
                  strokeWidth="1.5"
                />
                <text
                  x={c.x}
                  y={height - 6}
                  textAnchor="middle"
                  fill={isSelected ? '#DDD7CC' : '#5E5952'}
                  fontSize="9.5"
                >
                  {c.pt.dateLabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Personalized Relative Strength / Calm Coaching Note */}
      <div className="border-t border-stoneborder/70 pt-2.5 text-xs text-brand-muted leading-relaxed">
        {relativeRatio ? (
          <span>
            Fuerza relativa estimada: <strong className="text-brand">{relativeRatio}×</strong> tu
            peso corporal.{' '}
          </span>
        ) : null}
        <span>
          {evaluation.status === 'advance'
            ? 'Tu rendimiento va en ascenso respecto a tus sesiones anteriores.'
            : evaluation.status === 'regress'
              ? 'Ligero descenso reciente: prioriza un buen descanso antes de subir peso.'
              : 'Marca estable y consolidada.'}
        </span>
      </div>
    </div>
  );
}
