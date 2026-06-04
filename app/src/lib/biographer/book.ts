/* ═══════════════════════════════════════════════════════
   Book outline.
   Turn the memory timeline into a table of contents: segment the span of
   a life into eras (chapters), each with its date range and how many
   moments it holds. Pure + testable; the chapter assembler fills each in.
   ═══════════════════════════════════════════════════════ */

export interface Era { label: string; from: string; to: string; count: number; }
export interface Outline { eras: Era[]; total: number; span: { from: string; to: string } | null; }

/** Segment dated memories into eras. Bucket size scales with how long a life span is. */
export function buildOutline(dates: string[]): Outline {
  const valid = dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (!valid.length) return { eras: [], total: 0, span: null };

  const y0 = Number(valid[0].slice(0, 4));
  const y1 = Number(valid[valid.length - 1].slice(0, 4));
  const span = y1 - y0;
  const bucket = span <= 2 ? 1 : span <= 6 ? 2 : span <= 15 ? 3 : 5;

  const eras: Era[] = [];
  for (let y = y0; y <= y1; y += bucket) {
    const from = `${y}-01-01`;
    const toY = Math.min(y + bucket - 1, y1);
    const to = `${toY}-12-31`;
    const count = valid.filter((d) => d >= from && d <= to).length;
    if (count > 0) {
      eras.push({ label: y === toY ? `${y}` : `${y}–${toY}`, from, to, count });
    }
  }
  return { eras, total: valid.length, span: { from: valid[0], to: valid[valid.length - 1] } };
}
