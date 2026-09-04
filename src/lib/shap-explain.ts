/**
 * Traducción de features del modelo a lenguaje natural (issue #7).
 *
 * El booster v9 expone 84 features con nombres de código (`TAIL_DELAY_DECAY`,
 * `dest_delay_rate_24h`, `ORIG_WX_SKNT`). Mostrarlos en crudo obliga al lector
 * a conocer el feature engineering. Acá se traducen a un nombre corto y a una
 * frase que además depende de la dirección del aporte SHAP: la misma variable
 * explica algo distinto según empuje el riesgo hacia arriba o hacia abajo.
 */

export type FactorCopy = {
  /** Nombre corto, apto para una tabla. */
  title: string;
  /** Frase cuando el factor aumenta el riesgo. */
  up: string;
  /** Frase cuando el factor lo reduce. */
  down: string;
};

/** Métricas meteorológicas: aplican igual a origen y destino. */
const WX_METRICS: Record<string, FactorCopy> = {
  TMPC: {
    title: "Temperatura",
    up: "La temperatura {loc} acompaña condiciones que suelen demorar la operación",
    down: "La temperatura {loc} está en un rango sin impacto operativo",
  },
  DWPC: {
    title: "Punto de rocío",
    up: "El punto de rocío {loc} indica humedad alta, asociada a niebla o tormentas",
    down: "El punto de rocío {loc} no sugiere formación de niebla",
  },
  RELH: {
    title: "Humedad relativa",
    up: "Humedad alta {loc}, condición previa a niebla o precipitación",
    down: "Humedad {loc} en rango normal",
  },
  DRCT: {
    title: "Dirección del viento",
    up: "La dirección del viento {loc} obliga a una configuración de pista menos eficiente",
    down: "La dirección del viento {loc} favorece la configuración de pista habitual",
  },
  SKNT: {
    title: "Intensidad del viento",
    up: "Viento fuerte {loc}, que reduce la tasa de operaciones por hora",
    down: "Viento suave {loc}, sin impacto sobre la capacidad de pista",
  },
  ALTI: {
    title: "Presión atmosférica",
    up: "La presión {loc} es baja, indicador de sistema frontal activo",
    down: "Presión estable {loc}, típica de buen tiempo",
  },
  P01M: {
    title: "Precipitación",
    up: "Hay precipitación registrada {loc}",
    down: "Sin precipitación {loc}",
  },
  VSBY: {
    title: "Visibilidad",
    up: "Visibilidad reducida {loc}, que fuerza separación mayor entre aeronaves",
    down: "Buena visibilidad {loc}",
  },
  GUST: {
    title: "Ráfagas",
    up: "Ráfagas {loc} que pueden interrumpir la secuencia de aterrizajes",
    down: "Sin ráfagas relevantes {loc}",
  },
  CODES: {
    title: "Fenómenos METAR",
    up: "El METAR {loc} reporta fenómenos significativos (tormenta, niebla o nieve)",
    down: "El METAR {loc} no reporta fenómenos adversos",
  },
  PRECIP_FLAG: {
    title: "Indicador de precipitación",
    up: "Precipitación activa {loc}",
    down: "Sin precipitación activa {loc}",
  },
  LOW_VIS_FLAG: {
    title: "Indicador de baja visibilidad",
    up: "Condición de baja visibilidad {loc}",
    down: "Visibilidad sobre el mínimo operativo {loc}",
  },
  STRONG_WIND_FLAG: {
    title: "Indicador de viento fuerte",
    up: "Viento fuerte declarado {loc}",
    down: "Viento por debajo del umbral crítico {loc}",
  },
  MATCH_GAP_MIN: {
    title: "Antigüedad del METAR",
    up: "La observación meteorológica {loc} está desactualizada, lo que agrega incertidumbre",
    down: "Observación meteorológica {loc} reciente",
  },
};

const EXPLANATIONS: Record<string, FactorCopy> = {
  // ── Linaje del avión ────────────────────────────────────────────────────
  prev_arr_delay_tail: {
    title: "Demora del vuelo anterior",
    up: "El avión viene demorado de su vuelo anterior y arrastra ese retraso",
    down: "El avión llegó en horario de su vuelo anterior",
  },
  prev_turnaround_tail_min: {
    title: "Tiempo en tierra",
    up: "El tiempo en tierra programado es ajustado para recuperar demora",
    down: "El avión tiene margen suficiente en tierra para absorber demoras",
  },
  tail_flights_today_prior: {
    title: "Vuelos previos del avión",
    up: "El avión ya voló varias veces hoy y acumula desvíos de itinerario",
    down: "El avión tiene pocos vuelos previos en la jornada",
  },
  TAIL_DELAY_DECAY: {
    title: "Historial de demoras del avión",
    up: "Esta aeronave viene encadenando demoras en sus vuelos recientes",
    down: "Esta aeronave viene operando en horario en sus vuelos recientes",
  },

  // ── Tramo previo reconstruido por ADS-B ─────────────────────────────────
  PREV_ACTUAL_BLOCK_MIN: {
    title: "Duración real del tramo previo",
    up: "El tramo anterior tardó más de lo previsto",
    down: "El tramo anterior se completó dentro del tiempo previsto",
  },
  PREV_SCHED_BLOCK_MIN: {
    title: "Duración programada del tramo previo",
    up: "El tramo anterior tenía poco margen programado",
    down: "El tramo anterior tenía margen programado holgado",
  },
  PREV_BLOCK_DELTA_MIN: {
    title: "Desvío del tramo previo",
    up: "El tramo anterior excedió su tiempo de bloque programado",
    down: "El tramo anterior se ajustó a su tiempo de bloque",
  },
  PREV_HOLDING_MIN: {
    title: "Espera en vuelo previa",
    up: "El avión estuvo en espera en el aire durante su tramo anterior",
    down: "El tramo anterior no requirió esperas en vuelo",
  },
  PREV_ROUTE_DEVIATION_PCT: {
    title: "Desvío de ruta previo",
    up: "El tramo anterior se desvió de la ruta directa, señal de reencaminamiento",
    down: "El tramo anterior siguió la ruta prevista",
  },
  PREV_ADSB_AVAILABLE: {
    title: "Cobertura ADS-B previa",
    up: "Sin datos ADS-B del tramo anterior, lo que agrega incertidumbre",
    down: "Hay datos ADS-B del tramo anterior que confirman su comportamiento",
  },

  // ── Tasas de demora recientes ───────────────────────────────────────────
  carrier_delay_rate_yday: {
    title: "Demoras de la aerolínea (ayer)",
    up: "La aerolínea acumuló demoras ayer",
    down: "La aerolínea operó puntual ayer",
  },
  carrier_delay_rate_24h: {
    title: "Demoras de la aerolínea (24 h)",
    up: "La aerolínea viene con alta tasa de demoras en las últimas 24 horas",
    down: "La aerolínea viene operando puntual en las últimas 24 horas",
  },
  carrier_delay_rate_7d: {
    title: "Demoras de la aerolínea (7 d)",
    up: "La aerolínea arrastra una semana con demoras por encima de lo normal",
    down: "La aerolínea tuvo una semana con buena puntualidad",
  },
  origin_delay_rate_yday: {
    title: "Demoras en origen (ayer)",
    up: "El aeropuerto de origen tuvo muchas demoras ayer",
    down: "El aeropuerto de origen operó con normalidad ayer",
  },
  origin_delay_rate_1h: {
    title: "Demoras en origen (última hora)",
    up: "El aeropuerto de origen está demorando vuelos en este momento",
    down: "El aeropuerto de origen está operando en horario ahora mismo",
  },
  origin_delay_rate_6h: {
    title: "Demoras en origen (6 h)",
    up: "El origen viene acumulando demoras en las últimas 6 horas",
    down: "El origen operó sin demoras relevantes en las últimas 6 horas",
  },
  origin_delay_rate_24h: {
    title: "Demoras en origen (24 h)",
    up: "El origen tuvo alta tasa de demoras en las últimas 24 horas",
    down: "El origen mantuvo buena puntualidad en las últimas 24 horas",
  },
  dest_delay_rate_1h: {
    title: "Demoras en destino (última hora)",
    up: "El aeropuerto de destino está demorando llegadas ahora mismo",
    down: "El destino está recibiendo llegadas en horario",
  },
  dest_delay_rate_6h: {
    title: "Demoras en destino (6 h)",
    up: "El destino viene acumulando demoras en las últimas 6 horas",
    down: "El destino operó sin demoras relevantes en las últimas 6 horas",
  },
  dest_delay_rate_24h: {
    title: "Demoras en destino (24 h)",
    up: "El destino tuvo alta tasa de demoras en las últimas 24 horas",
    down: "El destino mantuvo buena puntualidad en las últimas 24 horas",
  },

  // ── Red y congestión ────────────────────────────────────────────────────
  absorb_score_origin: {
    title: "Capacidad de absorción del origen",
    up: "El origen tiene poco margen para absorber demoras en esta franja",
    down: "El origen tiene margen operativo para absorber demoras",
  },
  congestion_orig_window: {
    title: "Congestión en origen",
    up: "Hay muchos vuelos programados en origen en la misma franja horaria",
    down: "La franja horaria en origen está descongestionada",
  },
  congestion_dest_window: {
    title: "Congestión en destino",
    up: "Hay muchos vuelos programados llegando al destino en la misma franja",
    down: "La franja de llegada al destino está descongestionada",
  },
  ORIGIN_PAGERANK: {
    title: "Centralidad del origen",
    up: "El origen es un nodo central de la red: sus demoras se propagan",
    down: "El origen es un nodo periférico, con menor efecto de propagación",
  },
  DEST_PAGERANK: {
    title: "Centralidad del destino",
    up: "El destino es un nodo central de la red, más expuesto a congestión",
    down: "El destino es un nodo periférico de la red",
  },
  FLOW_ATL: {
    title: "Flujo en ATL",
    up: "El flujo de operaciones en Atlanta está por encima de lo habitual",
    down: "El flujo de operaciones en Atlanta está dentro de lo normal",
  },
  PAR_AIRPORT: {
    title: "Aeropuerto par",
    up: "El par origen-destino tiene historial de demoras",
    down: "El par origen-destino tiene buen historial de puntualidad",
  },

  // ── Ruta y aeronave ─────────────────────────────────────────────────────
  DISTANCE: {
    title: "Distancia del vuelo",
    up: "La distancia del vuelo deja poco margen para recuperar demora en el aire",
    down: "La distancia del vuelo permite recuperar demora durante el crucero",
  },
  CRS_ELAPSED_TIME: {
    title: "Duración programada",
    up: "La duración programada es ajustada respecto del tiempo real habitual",
    down: "La duración programada tiene colchón sobre el tiempo real habitual",
  },
  BEARING_DEG: {
    title: "Rumbo de la ruta",
    up: "El rumbo de la ruta la expone a vientos y corredores congestionados",
    down: "El rumbo de la ruta evita los corredores más congestionados",
  },
  AIRCRAFT_FAMILY: {
    title: "Familia de aeronave",
    up: "Este tipo de aeronave tiene peor desempeño de puntualidad en esta operación",
    down: "Este tipo de aeronave tiene buen desempeño de puntualidad",
  },
  OP_CARRIER: {
    title: "Aerolínea",
    up: "El historial de puntualidad de la aerolínea {value} pesa en contra",
    down: "El historial de puntualidad de la aerolínea {value} juega a favor",
  },
  ORIGIN: {
    title: "Aeropuerto de origen",
    up: "Salir desde {value} agrega riesgo según el historial del modelo",
    down: "Salir desde {value} reduce el riesgo según el historial del modelo",
  },
  DEST: {
    title: "Aeropuerto de destino",
    up: "Llegar a {value} agrega riesgo según el historial del modelo",
    down: "Llegar a {value} reduce el riesgo según el historial del modelo",
  },

  // ── Viento en altura (ERA5) ─────────────────────────────────────────────
  ERA5_HEADWIND_KT: {
    title: "Viento de frente",
    up: "Viento de frente en ruta, que alarga el tiempo de vuelo",
    down: "Sin viento de frente relevante en la ruta",
  },
  ERA5_CROSSWIND_KT: {
    title: "Viento cruzado",
    up: "Viento cruzado en ruta, que complica la aproximación",
    down: "Viento cruzado bajo en la ruta",
  },
  ERA5_TAILWIND_FLAG: {
    title: "Viento de cola",
    up: "Sin viento de cola que ayude a recuperar tiempo",
    down: "Viento de cola en ruta, que ayuda a recuperar tiempo",
  },
  ERA5_U_KT: {
    title: "Componente zonal del viento",
    up: "La componente este-oeste del viento en altura juega en contra",
    down: "La componente este-oeste del viento en altura juega a favor",
  },
  ERA5_V_KT: {
    title: "Componente meridional del viento",
    up: "La componente norte-sur del viento en altura juega en contra",
    down: "La componente norte-sur del viento en altura juega a favor",
  },

  // ── Calendario ──────────────────────────────────────────────────────────
  MONTH: {
    title: "Mes",
    up: "El mes coincide con temporada de mayor demanda",
    down: "El mes corresponde a temporada de menor demanda",
  },
  DAY_OF_MONTH: {
    title: "Día del mes",
    up: "El día del mes coincide con picos de tráfico",
    down: "El día del mes cae en un período de tráfico bajo",
  },
  DAY_OF_WEEK: {
    title: "Día de la semana",
    up: "Es un día de la semana con alta demanda",
    down: "Es un día de la semana de menor demanda",
  },
  CRS_DEP_MIN: {
    title: "Horario de salida",
    up: "El horario de salida cae en una franja congestionada",
    down: "El horario de salida cae en una franja descongestionada",
  },
  is_us_holiday: {
    title: "Feriado en EE.UU.",
    up: "Es feriado en Estados Unidos, con tráfico por encima de lo normal",
    down: "No es feriado, el tráfico sigue el patrón habitual",
  },
  days_to_nearest_holiday: {
    title: "Cercanía a un feriado",
    up: "La fecha está cerca de un feriado, en ventana de alta demanda",
    down: "La fecha está lejos de cualquier feriado",
  },
  is_thanksgiving_window: {
    title: "Ventana de Thanksgiving",
    up: "Cae dentro de la ventana de Thanksgiving, el pico anual de tráfico",
    down: "Fuera de la ventana de Thanksgiving",
  },
  is_summer_peak: {
    title: "Pico de verano",
    up: "Cae en el pico de tráfico del verano boreal",
    down: "Fuera del pico de tráfico estival",
  },

  // ── Clima combinado ─────────────────────────────────────────────────────
  wx_both_precip: {
    title: "Precipitación en ambos extremos",
    up: "Hay precipitación tanto en origen como en destino",
    down: "No hay precipitación simultánea en origen y destino",
  },
  wx_both_low_vis: {
    title: "Baja visibilidad en ambos extremos",
    up: "Baja visibilidad tanto en origen como en destino",
    down: "La visibilidad es adecuada en al menos uno de los dos extremos",
  },
  wx_both_strong_wind: {
    title: "Viento fuerte en ambos extremos",
    up: "Viento fuerte tanto en origen como en destino",
    down: "Sin viento fuerte simultáneo en origen y destino",
  },
};

/** Las features cíclicas son un artefacto de codificación, no un concepto. */
const CYCLIC: Record<string, string> = {
  dep_hour: "la hora de salida",
  dep_dow: "el día de la semana",
  dep_month: "el mes",
};

function cyclicCopy(feature: string): FactorCopy | null {
  const match = /^(dep_hour|dep_dow|dep_month)_(sin|cos)$/.exec(feature);
  if (!match) return null;
  const subject = CYCLIC[match[1]];
  return {
    title: `Estacionalidad — ${subject.replace(/^(la|el) /, "")}`,
    up: `Por ${subject}, el vuelo cae en una franja históricamente conflictiva`,
    down: `Por ${subject}, el vuelo cae en una franja históricamente tranquila`,
  };
}

function weatherCopy(feature: string): FactorCopy | null {
  const match = /^(ORIG|DEST)_WX_(.+)$/.exec(feature);
  if (!match) return null;
  const metric = WX_METRICS[match[2]];
  if (!metric) return null;
  const where = match[1] === "ORIG" ? "origen" : "destino";
  return {
    title: `${metric.title} en ${where}`,
    up: metric.up.replace("{loc}", `en ${where}`),
    down: metric.down.replace("{loc}", `en ${where}`),
  };
}

/** Último recurso: `dest_delay_rate_24h` → `Dest delay rate 24h`. */
function humanizeFallback(feature: string): string {
  const spaced = feature.replace(/_/g, " ").toLowerCase().trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export type ExplainedFactor = {
  /** Nombre corto en lenguaje natural. */
  title: string;
  /** Frase completa, ya resuelta según la dirección del aporte. */
  sentence: string;
  /** true si no hay traducción y se cayó al nombre técnico. */
  isFallback: boolean;
};

export function explainFactor(
  feature: string,
  direction: "positive" | "negative",
  value?: string | null,
): ExplainedFactor {
  const copy =
    EXPLANATIONS[feature] ?? weatherCopy(feature) ?? cyclicCopy(feature);

  if (!copy) {
    const title = humanizeFallback(feature);
    return {
      title,
      sentence:
        direction === "positive"
          ? `${title} empuja la predicción hacia el retraso`
          : `${title} empuja la predicción hacia la puntualidad`,
      isFallback: true,
    };
  }

  const raw = direction === "positive" ? copy.up : copy.down;
  const readable = value && value !== "NaN" ? value : "este vuelo";
  return {
    title: copy.title,
    sentence: raw.replace("{value}", readable),
    isFallback: false,
  };
}

/**
 * Reparte el aporte de cada factor como porcentaje del total absoluto.
 * El SHAP crudo vive en el espacio de margen del booster, que no significa
 * nada para quien lee; el peso relativo sí.
 */
export function contributionShare(
  contribution: number,
  total: number,
): number {
  if (total <= 0) return 0;
  return (contribution / total) * 100;
}
