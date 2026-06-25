export function levelFromXp(xp: number) {
  // Each level needs level*100 xp cumulatively (1->100, 2->300, 3->600 …)
  let level = 1;
  let needed = 100;
  let remaining = xp;
  while (remaining >= needed) {
    remaining -= needed;
    level += 1;
    needed = level * 100;
  }
  return { level, xpInLevel: remaining, xpForNext: needed };
}

export function bmi(height_cm?: number | null, weight_kg?: number | null) {
  if (!height_cm || !weight_kg) return null;
  const m = height_cm / 100;
  return weight_kg / (m * m);
}

export function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function haversine(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
