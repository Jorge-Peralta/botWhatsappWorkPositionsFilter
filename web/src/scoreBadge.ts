// Shared score-tiering helpers for the image-overlay relevance badge,
// used by both JobCard (gallery) and DetailPanel.

export function scoreBadgeClasses(score: number | null): string {
  const base = 'rounded-full px-2.5 py-1 text-xs font-bold backdrop-blur-sm';

  if (score === null) {
    return `${base} bg-neutral-700/80 text-neutral-200`;
  }
  if (score >= 60) {
    return `${base} bg-emerald-500/90 text-white`;
  }
  if (score >= 30) {
    return `${base} bg-amber-500/90 text-white`;
  }
  return `${base} bg-red-500/90 text-white`;
}

export function scoreBadgeLabel(score: number | null): string {
  return score === null ? 'Unscored' : String(score);
}
