/* ═══════════════════════════════════════════════════════
   Chapter assembly helpers.
   A chapter is several beats told in order. We sort the recalled
   moments chronologically and split them into contiguous beats; each
   beat becomes one scene, written with continuity from the last.
   ═══════════════════════════════════════════════════════ */

/**
 * Split sources (numbered 1..N in recall order) into `beatCount` chronological
 * beats. Returns, for each beat, the 1-based source numbers it covers — so the
 * writer can cite against one global numbering while focusing each scene.
 */
export function segmentBeats(sources: { date?: string }[], beatCount: number): number[][] {
  const n = sources.length;
  if (n === 0) return [];
  const k = Math.max(1, Math.min(Math.floor(beatCount) || 1, n));

  // Order by date (undated sink to the end), carrying the original 1-based index.
  const order = sources
    .map((s, i) => ({ idx: i + 1, d: (s.date && /^\d{4}/.test(s.date)) ? s.date : "9999-12-31" }))
    .sort((a, b) => a.d.localeCompare(b.d));

  const beats: number[][] = Array.from({ length: k }, () => []);
  order.forEach((o, i) => {
    const b = Math.min(k - 1, Math.floor((i * k) / order.length));
    beats[b].push(o.idx);
  });
  return beats.filter((b) => b.length);
}
