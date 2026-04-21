export type LatLng = { lat: number; lng: number };

export type Airport = LatLng & {
  code: string;
  name: string;
  city: string;
};

export const AIRPORTS: Record<string, Airport> = {
  ATL: { code: "ATL", name: "Hartsfield-Jackson Atlanta Intl.", city: "Atlanta", lat: 33.6367, lng: -84.4281 },
  LAX: { code: "LAX", name: "Los Angeles Intl.", city: "Los Angeles", lat: 33.9425, lng: -118.4081 },
  DFW: { code: "DFW", name: "Dallas/Fort Worth Intl.", city: "Dallas", lat: 32.8968, lng: -97.038 },
  ORD: { code: "ORD", name: "Chicago O'Hare Intl.", city: "Chicago", lat: 41.9742, lng: -87.9073 },
  MCO: { code: "MCO", name: "Orlando Intl.", city: "Orlando", lat: 28.4312, lng: -81.3081 },
  JFK: { code: "JFK", name: "New York JFK Intl.", city: "New York", lat: 40.6413, lng: -73.7781 },
  SEA: { code: "SEA", name: "Seattle-Tacoma Intl.", city: "Seattle", lat: 47.4502, lng: -122.3088 },
  MIA: { code: "MIA", name: "Miami Intl.", city: "Miami", lat: 25.7959, lng: -80.287 },
  DEN: { code: "DEN", name: "Denver Intl.", city: "Denver", lat: 39.8561, lng: -104.6737 },
  IAH: { code: "IAH", name: "Houston Bush Intercontinental", city: "Houston", lat: 29.9902, lng: -95.3368 },
  BOS: { code: "BOS", name: "Boston Logan Intl.", city: "Boston", lat: 42.3656, lng: -71.0096 },
  PHX: { code: "PHX", name: "Phoenix Sky Harbor Intl.", city: "Phoenix", lat: 33.4343, lng: -112.0116 },
  LAS: { code: "LAS", name: "Harry Reid Intl.", city: "Las Vegas", lat: 36.084, lng: -115.1537 },
  DTW: { code: "DTW", name: "Detroit Metro.", city: "Detroit", lat: 42.2124, lng: -83.3534 },
  SFO: { code: "SFO", name: "San Francisco Intl.", city: "San Francisco", lat: 37.6213, lng: -122.379 },
};

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function greatCirclePoint(a: LatLng, b: LatLng, f: number): LatLng {
  const φ1 = toRad(a.lat);
  const λ1 = toRad(a.lng);
  const φ2 = toRad(b.lat);
  const λ2 = toRad(b.lng);

  const Δφ = φ2 - φ1;
  const Δλ = λ2 - λ1;

  const havA =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const δ = 2 * Math.atan2(Math.sqrt(havA), Math.sqrt(1 - havA));

  if (δ === 0) return { lat: a.lat, lng: a.lng };

  const A = Math.sin((1 - f) * δ) / Math.sin(δ);
  const B = Math.sin(f * δ) / Math.sin(δ);

  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);

  const φi = Math.atan2(z, Math.sqrt(x * x + y * y));
  const λi = Math.atan2(y, x);

  return { lat: toDeg(φi), lng: toDeg(λi) };
}

export function initialBearing(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function greatCirclePath(
  a: LatLng,
  b: LatLng,
  steps = 64,
): Array<[number, number]> {
  const path: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const p = greatCirclePoint(a, b, f);
    path.push([p.lat, p.lng]);
  }
  return path;
}
