import { AIRPORTS, greatCirclePoint, initialBearing } from "./geo";

export type RiskLevel = "low" | "medium" | "high";

export type FlightStatus = "scheduled" | "boarding" | "departed" | "arrived";

export type ShapFactor = {
  feature: string;
  label: string;
  contribution: number;
  direction: "positive" | "negative";
};

export type Flight = {
  id: string;
  flightNumber: string;
  airline: string;
  airlineCode: string;
  origin: string;
  originName: string;
  destination: string;
  destinationName: string;
  scheduledDeparture: string;
  scheduledArrival: string;
  gate: string;
  aircraft: string;
  status: FlightStatus;
  risk: RiskLevel;
  delayProbability: number;
  expectedDelayMinutes: number;
  shap: ShapFactor[];
};

const RAW_FLIGHTS: Array<
  Omit<Flight, "shap"> & { shap: ShapFactor[] | null }
> = [
  {
    id: "DL1841",
    flightNumber: "DL 1841",
    airline: "Delta Air Lines",
    airlineCode: "DL",
    origin: "ATL",
    originName: "Hartsfield-Jackson Atlanta Intl.",
    destination: "LAX",
    destinationName: "Los Angeles Intl.",
    scheduledDeparture: "06:25",
    scheduledArrival: "08:45",
    gate: "T-5",
    aircraft: "B738",
    status: "scheduled",
    risk: "high",
    delayProbability: 0.82,
    expectedDelayMinutes: 38,
    shap: [
      {
        feature: "weather_vis",
        label: "Visibilidad < 3SM (niebla)",
        contribution: 0.31,
        direction: "positive",
      },
      {
        feature: "prev_delay",
        label: "Retraso previo de la aeronave",
        contribution: 0.24,
        direction: "positive",
      },
      {
        feature: "time_of_day",
        label: "Franja horaria 06-09 (peak salida)",
        contribution: 0.14,
        direction: "positive",
      },
      {
        feature: "route_hist",
        label: "Histórico puntualidad ATL→LAX",
        contribution: 0.08,
        direction: "negative",
      },
    ],
  },
  {
    id: "AA2102",
    flightNumber: "AA 2102",
    airline: "American Airlines",
    airlineCode: "AA",
    origin: "ATL",
    originName: "Hartsfield-Jackson Atlanta Intl.",
    destination: "DFW",
    destinationName: "Dallas/Fort Worth Intl.",
    scheduledDeparture: "07:10",
    scheduledArrival: "08:35",
    gate: "T-12",
    aircraft: "A321",
    status: "boarding",
    risk: "medium",
    delayProbability: 0.54,
    expectedDelayMinutes: 18,
    shap: [
      {
        feature: "weather_wind",
        label: "Viento cruzado 18kt",
        contribution: 0.19,
        direction: "positive",
      },
      {
        feature: "congestion",
        label: "Congestión de rodaje ATL",
        contribution: 0.15,
        direction: "positive",
      },
      {
        feature: "prev_delay",
        label: "Rotación sin demora previa",
        contribution: 0.11,
        direction: "negative",
      },
    ],
  },
  {
    id: "UA588",
    flightNumber: "UA 588",
    airline: "United Airlines",
    airlineCode: "UA",
    origin: "ATL",
    originName: "Hartsfield-Jackson Atlanta Intl.",
    destination: "ORD",
    destinationName: "Chicago O'Hare Intl.",
    scheduledDeparture: "07:55",
    scheduledArrival: "08:55",
    gate: "T-20",
    aircraft: "B739",
    status: "scheduled",
    risk: "low",
    delayProbability: 0.17,
    expectedDelayMinutes: 4,
    shap: [
      {
        feature: "weather_clear",
        label: "Clima despejado",
        contribution: 0.21,
        direction: "negative",
      },
      {
        feature: "time_of_day",
        label: "Franja matutina baja congestión",
        contribution: 0.09,
        direction: "negative",
      },
    ],
  },
  {
    id: "WN3344",
    flightNumber: "WN 3344",
    airline: "Southwest Airlines",
    airlineCode: "WN",
    origin: "ATL",
    originName: "Hartsfield-Jackson Atlanta Intl.",
    destination: "MCO",
    destinationName: "Orlando Intl.",
    scheduledDeparture: "08:20",
    scheduledArrival: "09:35",
    gate: "C-14",
    aircraft: "B737",
    status: "scheduled",
    risk: "medium",
    delayProbability: 0.47,
    expectedDelayMinutes: 15,
    shap: [
      {
        feature: "turnaround",
        label: "Turnaround apretado (28 min)",
        contribution: 0.22,
        direction: "positive",
      },
      {
        feature: "weather_rain",
        label: "Lluvia ligera esperada",
        contribution: 0.12,
        direction: "positive",
      },
    ],
  },
  {
    id: "B6420",
    flightNumber: "B6 420",
    airline: "JetBlue",
    airlineCode: "B6",
    origin: "ATL",
    originName: "Hartsfield-Jackson Atlanta Intl.",
    destination: "JFK",
    destinationName: "New York JFK Intl.",
    scheduledDeparture: "09:05",
    scheduledArrival: "11:20",
    gate: "E-3",
    aircraft: "A320",
    status: "scheduled",
    risk: "high",
    delayProbability: 0.74,
    expectedDelayMinutes: 32,
    shap: [
      {
        feature: "dest_congestion",
        label: "Congestión destino JFK",
        contribution: 0.28,
        direction: "positive",
      },
      {
        feature: "weather_dest",
        label: "Tormenta prevista JFK 11:00",
        contribution: 0.21,
        direction: "positive",
      },
      {
        feature: "prev_delay",
        label: "Retraso previo aeronave 22 min",
        contribution: 0.15,
        direction: "positive",
      },
    ],
  },
  {
    id: "AS1220",
    flightNumber: "AS 1220",
    airline: "Alaska Airlines",
    airlineCode: "AS",
    origin: "ATL",
    originName: "Hartsfield-Jackson Atlanta Intl.",
    destination: "SEA",
    destinationName: "Seattle-Tacoma Intl.",
    scheduledDeparture: "10:30",
    scheduledArrival: "13:15",
    gate: "T-7",
    aircraft: "B739",
    status: "scheduled",
    risk: "low",
    delayProbability: 0.21,
    expectedDelayMinutes: 6,
    shap: [
      {
        feature: "weather_clear",
        label: "Clima estable ATL y SEA",
        contribution: 0.18,
        direction: "negative",
      },
      {
        feature: "slot",
        label: "Slot con buffer operativo",
        contribution: 0.12,
        direction: "negative",
      },
    ],
  },
  {
    id: "DL217",
    flightNumber: "DL 217",
    airline: "Delta Air Lines",
    airlineCode: "DL",
    origin: "ATL",
    originName: "Hartsfield-Jackson Atlanta Intl.",
    destination: "MIA",
    destinationName: "Miami Intl.",
    scheduledDeparture: "11:15",
    scheduledArrival: "13:05",
    gate: "T-3",
    aircraft: "A220",
    status: "scheduled",
    risk: "medium",
    delayProbability: 0.42,
    expectedDelayMinutes: 12,
    shap: [
      {
        feature: "weather_rain",
        label: "Chubascos aislados MIA",
        contribution: 0.17,
        direction: "positive",
      },
      {
        feature: "time_of_day",
        label: "Banda horaria media-alta",
        contribution: 0.1,
        direction: "positive",
      },
    ],
  },
  {
    id: "F92011",
    flightNumber: "F9 2011",
    airline: "Frontier Airlines",
    airlineCode: "F9",
    origin: "ATL",
    originName: "Hartsfield-Jackson Atlanta Intl.",
    destination: "DEN",
    destinationName: "Denver Intl.",
    scheduledDeparture: "12:00",
    scheduledArrival: "13:45",
    gate: "D-28",
    aircraft: "A321",
    status: "scheduled",
    risk: "low",
    delayProbability: 0.28,
    expectedDelayMinutes: 7,
    shap: [
      {
        feature: "weather_clear",
        label: "Condiciones meteo favorables",
        contribution: 0.14,
        direction: "negative",
      },
    ],
  },
  {
    id: "UA1299",
    flightNumber: "UA 1299",
    airline: "United Airlines",
    airlineCode: "UA",
    origin: "ATL",
    originName: "Hartsfield-Jackson Atlanta Intl.",
    destination: "IAH",
    destinationName: "Houston Bush Intl.",
    scheduledDeparture: "13:45",
    scheduledArrival: "15:05",
    gate: "T-18",
    aircraft: "B737",
    status: "scheduled",
    risk: "high",
    delayProbability: 0.69,
    expectedDelayMinutes: 26,
    shap: [
      {
        feature: "weather_storm",
        label: "Tormentas convectivas Texas",
        contribution: 0.33,
        direction: "positive",
      },
      {
        feature: "congestion",
        label: "Tráfico acumulado ATL",
        contribution: 0.16,
        direction: "positive",
      },
    ],
  },
  {
    id: "DL3502",
    flightNumber: "DL 3502",
    airline: "Delta Air Lines",
    airlineCode: "DL",
    origin: "ATL",
    originName: "Hartsfield-Jackson Atlanta Intl.",
    destination: "BOS",
    destinationName: "Boston Logan Intl.",
    scheduledDeparture: "14:30",
    scheduledArrival: "16:55",
    gate: "T-9",
    aircraft: "A320",
    status: "scheduled",
    risk: "medium",
    delayProbability: 0.51,
    expectedDelayMinutes: 17,
    shap: [
      {
        feature: "prev_delay",
        label: "Retraso propagado rotación previa",
        contribution: 0.22,
        direction: "positive",
      },
      {
        feature: "weather_wind",
        label: "Viento cruzado moderado",
        contribution: 0.13,
        direction: "positive",
      },
    ],
  },
  {
    id: "AA556",
    flightNumber: "AA 556",
    airline: "American Airlines",
    airlineCode: "AA",
    origin: "ATL",
    originName: "Hartsfield-Jackson Atlanta Intl.",
    destination: "PHX",
    destinationName: "Phoenix Sky Harbor Intl.",
    scheduledDeparture: "15:20",
    scheduledArrival: "17:00",
    gate: "T-22",
    aircraft: "A321",
    status: "scheduled",
    risk: "low",
    delayProbability: 0.22,
    expectedDelayMinutes: 5,
    shap: [
      {
        feature: "weather_clear",
        label: "Ambas terminales estables",
        contribution: 0.17,
        direction: "negative",
      },
    ],
  },
  {
    id: "WN1812",
    flightNumber: "WN 1812",
    airline: "Southwest Airlines",
    airlineCode: "WN",
    origin: "ATL",
    originName: "Hartsfield-Jackson Atlanta Intl.",
    destination: "LAS",
    destinationName: "Las Vegas Harry Reid Intl.",
    scheduledDeparture: "16:00",
    scheduledArrival: "17:35",
    gate: "C-2",
    aircraft: "B737",
    status: "scheduled",
    risk: "high",
    delayProbability: 0.78,
    expectedDelayMinutes: 41,
    shap: [
      {
        feature: "prev_delay",
        label: "Aeronave retrasada 35 min previo",
        contribution: 0.34,
        direction: "positive",
      },
      {
        feature: "congestion",
        label: "Hora pico salida ATL",
        contribution: 0.19,
        direction: "positive",
      },
      {
        feature: "weather_storm",
        label: "Celda convectiva ruta",
        contribution: 0.15,
        direction: "positive",
      },
    ],
  },
  {
    id: "DL2988",
    flightNumber: "DL 2988",
    airline: "Delta Air Lines",
    airlineCode: "DL",
    origin: "ATL",
    originName: "Hartsfield-Jackson Atlanta Intl.",
    destination: "DTW",
    destinationName: "Detroit Metro.",
    scheduledDeparture: "17:15",
    scheduledArrival: "19:00",
    gate: "T-4",
    aircraft: "B717",
    status: "scheduled",
    risk: "medium",
    delayProbability: 0.49,
    expectedDelayMinutes: 14,
    shap: [
      {
        feature: "time_of_day",
        label: "Segundo pico del día",
        contribution: 0.16,
        direction: "positive",
      },
      {
        feature: "weather_rain",
        label: "Llovizna destino DTW",
        contribution: 0.11,
        direction: "positive",
      },
    ],
  },
  {
    id: "B62011",
    flightNumber: "B6 2011",
    airline: "JetBlue",
    airlineCode: "B6",
    origin: "ATL",
    originName: "Hartsfield-Jackson Atlanta Intl.",
    destination: "BOS",
    destinationName: "Boston Logan Intl.",
    scheduledDeparture: "18:05",
    scheduledArrival: "20:25",
    gate: "E-6",
    aircraft: "A321",
    status: "scheduled",
    risk: "low",
    delayProbability: 0.19,
    expectedDelayMinutes: 3,
    shap: [
      {
        feature: "weather_clear",
        label: "Cielos despejados",
        contribution: 0.12,
        direction: "negative",
      },
    ],
  },
  {
    id: "DL1205",
    flightNumber: "DL 1205",
    airline: "Delta Air Lines",
    airlineCode: "DL",
    origin: "ATL",
    originName: "Hartsfield-Jackson Atlanta Intl.",
    destination: "SFO",
    destinationName: "San Francisco Intl.",
    scheduledDeparture: "19:45",
    scheduledArrival: "22:30",
    gate: "T-1",
    aircraft: "A330",
    status: "scheduled",
    risk: "medium",
    delayProbability: 0.45,
    expectedDelayMinutes: 13,
    shap: [
      {
        feature: "weather_fog",
        label: "Niebla costera SFO",
        contribution: 0.2,
        direction: "positive",
      },
      {
        feature: "time_of_day",
        label: "Franja tarde-noche",
        contribution: 0.08,
        direction: "positive",
      },
    ],
  },
];

export type FlightTrack = Flight & {
  origin: string;
  destination: string;
  progress: number;
  currentLat: number;
  currentLng: number;
  bearing: number;
  altitudeFt: number;
  groundSpeedKt: number;
};

const PROGRESS_SEED = [0.22, 0.45, 0.73, 0.31, 0.58, 0.12, 0.84, 0.65, 0.38, 0.52, 0.27, 0.7, 0.48, 0.18, 0.91, 0.6];

export const MOCK_FLIGHTS: FlightTrack[] = RAW_FLIGHTS.map((f, idx) => {
  const o = AIRPORTS[f.origin];
  const d = AIRPORTS[f.destination];
  const progress = PROGRESS_SEED[idx % PROGRESS_SEED.length];
  const current = o && d ? greatCirclePoint(o, d, progress) : { lat: 0, lng: 0 };
  const bearing = o && d ? initialBearing(current, d) : 0;
  const altitudeFt = 24000 + Math.round(Math.sin(progress * Math.PI) * 12000);
  const groundSpeedKt = 410 + Math.round(Math.sin(progress * Math.PI) * 60);
  return {
    ...f,
    shap: f.shap ?? [],
    progress,
    currentLat: current.lat,
    currentLng: current.lng,
    bearing,
    altitudeFt,
    groundSpeedKt,
  };
});

export function getFlightById(id: string): FlightTrack | undefined {
  return MOCK_FLIGHTS.find((f) => f.id === id);
}

export const MOCK_METRICS = {
  totalFlights: MOCK_FLIGHTS.length,
  onTimeRate: 0.68,
  avgDelayMinutes: 14.3,
  highRiskCount: MOCK_FLIGHTS.filter((f) => f.risk === "high").length,
  mediumRiskCount: MOCK_FLIGHTS.filter((f) => f.risk === "medium").length,
  lowRiskCount: MOCK_FLIGHTS.filter((f) => f.risk === "low").length,
  weather: {
    temperatureF: 71,
    windKt: 14,
    visibilitySm: 6,
    condition: "Parcialmente nublado",
    metar: "KATL 201453Z 22014KT 6SM BKN035 22/14 A2998",
  },
};

export const MOCK_HOURLY_DELAY = [
  { hour: "06:00", avgDelay: 8, flights: 18 },
  { hour: "07:00", avgDelay: 12, flights: 24 },
  { hour: "08:00", avgDelay: 17, flights: 31 },
  { hour: "09:00", avgDelay: 22, flights: 28 },
  { hour: "10:00", avgDelay: 15, flights: 22 },
  { hour: "11:00", avgDelay: 11, flights: 20 },
  { hour: "12:00", avgDelay: 9, flights: 19 },
  { hour: "13:00", avgDelay: 13, flights: 23 },
  { hour: "14:00", avgDelay: 19, flights: 27 },
  { hour: "15:00", avgDelay: 24, flights: 30 },
  { hour: "16:00", avgDelay: 28, flights: 33 },
  { hour: "17:00", avgDelay: 21, flights: 29 },
  { hour: "18:00", avgDelay: 16, flights: 26 },
  { hour: "19:00", avgDelay: 14, flights: 22 },
  { hour: "20:00", avgDelay: 10, flights: 17 },
];

export type WeatherStation = {
  code: string;
  name: string;
  lat: number;
  lng: number;
  temperatureF: number;
  windKt: number;
  windDeg: number;
  visibilitySm: number;
  condition: "clear" | "cloudy" | "rain" | "storm" | "fog";
  impact: RiskLevel;
};

export const MOCK_WEATHER_STATIONS: WeatherStation[] = [
  { code: "ATL", name: "Atlanta", lat: 33.6367, lng: -84.4281, temperatureF: 71, windKt: 14, windDeg: 220, visibilitySm: 6, condition: "cloudy", impact: "medium" },
  { code: "CLT", name: "Charlotte", lat: 35.214, lng: -80.9431, temperatureF: 68, windKt: 11, windDeg: 200, visibilitySm: 8, condition: "clear", impact: "low" },
  { code: "MCO", name: "Orlando", lat: 28.4312, lng: -81.3081, temperatureF: 79, windKt: 9, windDeg: 140, visibilitySm: 7, condition: "rain", impact: "medium" },
  { code: "MIA", name: "Miami", lat: 25.7959, lng: -80.287, temperatureF: 82, windKt: 12, windDeg: 120, visibilitySm: 6, condition: "storm", impact: "high" },
  { code: "DFW", name: "Dallas", lat: 32.8968, lng: -97.038, temperatureF: 76, windKt: 18, windDeg: 180, visibilitySm: 5, condition: "storm", impact: "high" },
  { code: "IAH", name: "Houston", lat: 29.9902, lng: -95.3368, temperatureF: 80, windKt: 15, windDeg: 160, visibilitySm: 5, condition: "storm", impact: "high" },
  { code: "ORD", name: "Chicago", lat: 41.9742, lng: -87.9073, temperatureF: 54, windKt: 17, windDeg: 290, visibilitySm: 8, condition: "cloudy", impact: "medium" },
  { code: "DTW", name: "Detroit", lat: 42.2124, lng: -83.3534, temperatureF: 51, windKt: 12, windDeg: 270, visibilitySm: 9, condition: "cloudy", impact: "low" },
  { code: "BOS", name: "Boston", lat: 42.3656, lng: -71.0096, temperatureF: 49, windKt: 19, windDeg: 310, visibilitySm: 10, condition: "clear", impact: "low" },
  { code: "JFK", name: "New York", lat: 40.6413, lng: -73.7781, temperatureF: 56, windKt: 16, windDeg: 300, visibilitySm: 3, condition: "fog", impact: "high" },
  { code: "DEN", name: "Denver", lat: 39.8561, lng: -104.6737, temperatureF: 60, windKt: 13, windDeg: 230, visibilitySm: 10, condition: "clear", impact: "low" },
  { code: "PHX", name: "Phoenix", lat: 33.4343, lng: -112.0116, temperatureF: 89, windKt: 8, windDeg: 210, visibilitySm: 10, condition: "clear", impact: "low" },
  { code: "LAS", name: "Las Vegas", lat: 36.084, lng: -115.1537, temperatureF: 85, windKt: 11, windDeg: 220, visibilitySm: 10, condition: "clear", impact: "low" },
  { code: "LAX", name: "Los Angeles", lat: 33.9425, lng: -118.4081, temperatureF: 72, windKt: 10, windDeg: 250, visibilitySm: 9, condition: "cloudy", impact: "low" },
  { code: "SFO", name: "San Francisco", lat: 37.6213, lng: -122.379, temperatureF: 63, windKt: 14, windDeg: 270, visibilitySm: 4, condition: "fog", impact: "medium" },
  { code: "SEA", name: "Seattle", lat: 47.4502, lng: -122.3088, temperatureF: 55, windKt: 12, windDeg: 230, visibilitySm: 8, condition: "rain", impact: "medium" },
];

export const MOCK_ROUTES = [
  { route: "ATL → LAX", flights: 18, onTimeRate: 0.71, avgDelay: 14 },
  { route: "ATL → DFW", flights: 14, onTimeRate: 0.78, avgDelay: 9 },
  { route: "ATL → ORD", flights: 12, onTimeRate: 0.64, avgDelay: 18 },
  { route: "ATL → MCO", flights: 22, onTimeRate: 0.82, avgDelay: 7 },
  { route: "ATL → JFK", flights: 9, onTimeRate: 0.51, avgDelay: 27 },
  { route: "ATL → SEA", flights: 6, onTimeRate: 0.79, avgDelay: 11 },
  { route: "ATL → MIA", flights: 15, onTimeRate: 0.74, avgDelay: 12 },
  { route: "ATL → DEN", flights: 10, onTimeRate: 0.72, avgDelay: 13 },
  { route: "ATL → BOS", flights: 11, onTimeRate: 0.69, avgDelay: 15 },
  { route: "ATL → SFO", flights: 7, onTimeRate: 0.66, avgDelay: 17 },
];
