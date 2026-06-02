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
  // Southeast
  CLT: { code: "CLT", name: "Charlotte Douglas Intl.", city: "Charlotte", lat: 35.214, lng: -80.9431 },
  TPA: { code: "TPA", name: "Tampa Intl.", city: "Tampa", lat: 27.9755, lng: -82.5332 },
  FLL: { code: "FLL", name: "Fort Lauderdale-Hollywood Intl.", city: "Fort Lauderdale", lat: 26.0742, lng: -80.1506 },
  PBI: { code: "PBI", name: "Palm Beach Intl.", city: "West Palm Beach", lat: 26.6832, lng: -80.0956 },
  RSW: { code: "RSW", name: "Southwest Florida Intl.", city: "Fort Myers", lat: 26.5362, lng: -81.7552 },
  JAX: { code: "JAX", name: "Jacksonville Intl.", city: "Jacksonville", lat: 30.4941, lng: -81.6879 },
  SAV: { code: "SAV", name: "Savannah/Hilton Head Intl.", city: "Savannah", lat: 32.1276, lng: -81.2021 },
  BHM: { code: "BHM", name: "Birmingham-Shuttlesworth Intl.", city: "Birmingham", lat: 33.5629, lng: -86.7535 },
  PNS: { code: "PNS", name: "Pensacola Intl.", city: "Pensacola", lat: 30.4734, lng: -87.1866 },
  MOB: { code: "MOB", name: "Mobile Regional", city: "Mobile", lat: 30.6913, lng: -88.2428 },
  GSP: { code: "GSP", name: "Greenville-Spartanburg Intl.", city: "Greenville", lat: 34.8957, lng: -82.2189 },
  CAE: { code: "CAE", name: "Columbia Metropolitan", city: "Columbia", lat: 33.9388, lng: -81.1195 },
  MYR: { code: "MYR", name: "Myrtle Beach Intl.", city: "Myrtle Beach", lat: 33.6797, lng: -78.9283 },
  TLH: { code: "TLH", name: "Tallahassee Intl.", city: "Tallahassee", lat: 30.3965, lng: -84.3503 },
  // Mid-Atlantic & Northeast
  LGA: { code: "LGA", name: "LaGuardia", city: "New York", lat: 40.7772, lng: -73.8726 },
  EWR: { code: "EWR", name: "Newark Liberty Intl.", city: "Newark", lat: 40.6925, lng: -74.1687 },
  PHL: { code: "PHL", name: "Philadelphia Intl.", city: "Philadelphia", lat: 39.8744, lng: -75.2424 },
  DCA: { code: "DCA", name: "Ronald Reagan Washington National", city: "Washington", lat: 38.8521, lng: -77.0377 },
  IAD: { code: "IAD", name: "Washington Dulles Intl.", city: "Dulles", lat: 38.9531, lng: -77.4565 },
  BWI: { code: "BWI", name: "Baltimore/Washington Intl.", city: "Baltimore", lat: 39.1754, lng: -76.6683 },
  RDU: { code: "RDU", name: "Raleigh-Durham Intl.", city: "Raleigh", lat: 35.8776, lng: -78.7875 },
  // Midwest
  MDW: { code: "MDW", name: "Chicago Midway Intl.", city: "Chicago", lat: 41.7868, lng: -87.7522 },
  MKE: { code: "MKE", name: "Milwaukee Mitchell Intl.", city: "Milwaukee", lat: 42.9472, lng: -87.8966 },
  MSP: { code: "MSP", name: "Minneapolis-Saint Paul Intl.", city: "Minneapolis", lat: 44.8848, lng: -93.2223 },
  STL: { code: "STL", name: "St. Louis Lambert Intl.", city: "St. Louis", lat: 38.7487, lng: -90.37 },
  MCI: { code: "MCI", name: "Kansas City Intl.", city: "Kansas City", lat: 39.2976, lng: -94.7139 },
  CLE: { code: "CLE", name: "Cleveland Hopkins Intl.", city: "Cleveland", lat: 41.4117, lng: -81.8498 },
  CMH: { code: "CMH", name: "John Glenn Columbus Intl.", city: "Columbus", lat: 39.9998, lng: -82.8919 },
  CVG: { code: "CVG", name: "Cincinnati/Northern Kentucky Intl.", city: "Cincinnati", lat: 39.0488, lng: -84.6678 },
  IND: { code: "IND", name: "Indianapolis Intl.", city: "Indianapolis", lat: 39.7173, lng: -86.2944 },
  // South-Central
  BNA: { code: "BNA", name: "Nashville Intl.", city: "Nashville", lat: 36.1245, lng: -86.6782 },
  MEM: { code: "MEM", name: "Memphis Intl.", city: "Memphis", lat: 35.0424, lng: -89.9767 },
  MSY: { code: "MSY", name: "Louis Armstrong New Orleans Intl.", city: "New Orleans", lat: 29.9934, lng: -90.258 },
  LIT: { code: "LIT", name: "Bill and Hillary Clinton National", city: "Little Rock", lat: 34.7294, lng: -92.2243 },
  SHV: { code: "SHV", name: "Shreveport Regional", city: "Shreveport", lat: 32.4466, lng: -93.8256 },
  OKC: { code: "OKC", name: "Will Rogers World", city: "Oklahoma City", lat: 35.3931, lng: -97.6007 },
  TUL: { code: "TUL", name: "Tulsa Intl.", city: "Tulsa", lat: 36.1984, lng: -95.8881 },
  AUS: { code: "AUS", name: "Austin-Bergstrom Intl.", city: "Austin", lat: 30.1975, lng: -97.6664 },
  SAT: { code: "SAT", name: "San Antonio Intl.", city: "San Antonio", lat: 29.5337, lng: -98.4698 },
  HOU: { code: "HOU", name: "William P. Hobby", city: "Houston", lat: 29.6454, lng: -95.2789 },
  DAL: { code: "DAL", name: "Dallas Love Field", city: "Dallas", lat: 32.8471, lng: -96.8518 },
  // West
  SLC: { code: "SLC", name: "Salt Lake City Intl.", city: "Salt Lake City", lat: 40.7884, lng: -111.9778 },
  SAN: { code: "SAN", name: "San Diego Intl.", city: "San Diego", lat: 32.7338, lng: -117.1933 },
  SJC: { code: "SJC", name: "San José Mineta Intl.", city: "San Jose", lat: 37.3626, lng: -121.9290 },
  OAK: { code: "OAK", name: "Oakland Intl.", city: "Oakland", lat: 37.7213, lng: -122.2208 },
  PDX: { code: "PDX", name: "Portland Intl.", city: "Portland", lat: 45.5898, lng: -122.5951 },
  ABQ: { code: "ABQ", name: "Albuquerque Intl. Sunport", city: "Albuquerque", lat: 35.0402, lng: -106.6090 },
  ELP: { code: "ELP", name: "El Paso Intl.", city: "El Paso", lat: 31.8072, lng: -106.3779 },
  TUS: { code: "TUS", name: "Tucson Intl.", city: "Tucson", lat: 32.1161, lng: -110.9410 },
  // International
  CUN: { code: "CUN", name: "Cancún Intl.", city: "Cancún", lat: 21.0365, lng: -86.8771 },
  MEX: { code: "MEX", name: "Benito Juárez Intl.", city: "Mexico City", lat: 19.4363, lng: -99.0721 },
  NAS: { code: "NAS", name: "Lynden Pindling Intl.", city: "Nassau", lat: 25.0390, lng: -77.4662 },
  MBJ: { code: "MBJ", name: "Sangster Intl.", city: "Montego Bay", lat: 18.5037, lng: -77.9134 },
  LHR: { code: "LHR", name: "London Heathrow", city: "London", lat: 51.4775, lng: -0.4614 },
  CDG: { code: "CDG", name: "Paris Charles de Gaulle", city: "Paris", lat: 49.0097, lng: 2.5479 },
  FRA: { code: "FRA", name: "Frankfurt am Main", city: "Frankfurt", lat: 50.0379, lng: 8.5622 },
  AMS: { code: "AMS", name: "Amsterdam Schiphol", city: "Amsterdam", lat: 52.3105, lng: 4.7683 },
  // Military/Other common ATL destinations
  OZR: { code: "OZR", name: "Cairns AAF", city: "Fort Rucker", lat: 31.2757, lng: -85.7140 },
  XNA: { code: "XNA", name: "Northwest Arkansas National", city: "Bentonville", lat: 36.2819, lng: -94.3069 },
  HNL: { code: "HNL", name: "Daniel K. Inouye Intl.", city: "Honolulu", lat: 21.3245, lng: -157.9251 },
  SJU: { code: "SJU", name: "Luis Muñoz Marín Intl.", city: "San Juan", lat: 18.4394, lng: -66.0018 },
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
