// Scores are from the side to move. Never vary forced mates or deeply losing positions.
export function parseVariation(line) {
  if (/\b(?:lowerbound|upperbound)\b/.test(line)) return null;
  const depth = line.match(/\bdepth (\d+)/),
    score = line.match(/\bscore (cp|mate) (-?\d+)/),
    pv = line.match(/\bpv ([a-h][1-8][a-h][1-8][qrbn]?)(?:\s|$)/);
  if (!depth || !score || !pv) return null;
  return {
    index: Number(line.match(/\bmultipv (\d+)/)?.[1] || 1),
    depth: Number(depth[1]),
    kind: score[1],
    score: Number(score[2]),
    uci: pv[1],
  };
}
export function pickVariation(best, variations, enabled, random = Math.random) {
  const strongest = variations.get(1);
  const fallback = { uci: best, varied: false };
  if (
    !enabled ||
    !strongest ||
    strongest.uci !== best ||
    strongest.kind !== "cp" ||
    strongest.score < -100 ||
    random() >= 0.15
  )
    return fallback;
  const candidates = [...variations.values()].filter(
    (v) =>
      v.index > 1 &&
      v.kind === "cp" &&
      v.depth >= strongest.depth - 1 &&
      v.uci !== best &&
      strongest.score - v.score >= 20 &&
      strongest.score - v.score <= 110 &&
      v.score >= -100,
  );
  if (!candidates.length) return fallback;
  const chosen =
    candidates[
      Math.min(candidates.length - 1, Math.floor(random() * candidates.length))
    ];
  return {
    uci: chosen.uci,
    varied: true,
    score: chosen.score,
    depth: chosen.depth,
  };
}
