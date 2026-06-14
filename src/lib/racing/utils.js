export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
export function randInt(lo, hi)  { return Math.floor(Math.random() * (hi - lo + 1)) + lo; }

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function deepCopy(obj) { return JSON.parse(JSON.stringify(obj)); }
