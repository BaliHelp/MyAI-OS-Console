'use client';

import { useEffect, useState } from "react";

interface UseAutoTourResult {
  current: string | null;
  isPaused: boolean;
  pause: () => void;
  resume: () => void;
}

// Cycles `current` through `targetIds` every `intervalMs`, pausable. Ownership of what to do
// with `current` (highlight a node, scroll a row into view, etc.) belongs to the caller —
// this hook only tracks "which id is focused right now" and "is the cycle running."
export function useAutoTour(targetIds: string[], intervalMs = 4000): UseAutoTourResult {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused || targetIds.length === 0) return;

    const id = setInterval(() => {
      setIndex(i => (i + 1) % targetIds.length);
    }, intervalMs);

    return () => clearInterval(id);
  }, [isPaused, intervalMs, targetIds.length]);

  const safeIndex = targetIds.length > 0 ? index % targetIds.length : 0;

  return {
    current: targetIds[safeIndex] ?? null,
    isPaused,
    pause: () => setIsPaused(true),
    resume: () => setIsPaused(false),
  };
}
