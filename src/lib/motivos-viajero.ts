import type { ShapFactor } from "@/lib/api";

/**
 * Traduce lo que el modelo usó a algo que un pasajero entienda.
 *
 * El panel de operaciones muestra `prev_turnaround_tail_min` con su valor SHAP
 * y eso está bien para quien sabe qué es. A un viajero no le dice nada: quiere
 * saber *por qué* su vuelo puede demorarse, en una frase.
 *
 * NINGUNA FEATURE SE DESCARTA. La primera versión omitía las que no sabía
 * explicar, y medido sobre 69.703 predicciones reales eso dejaba al **27,5%**
 * con su razón principal fuera de la lista: el viajero veía motivos
 * secundarios presentados como si fueran la explicación. Lo que no tiene frase
 * propia cae a la etiqueta que ya manda el backend, que es peor que una frase
 * buena pero infinitamente mejor que el silencio.
 *
 * Los nombres salen de `prediction_shap` en producción, no de `FEATURE_LABELS`
 * de api.py: esa lista quedó vieja. Dice `congestion_score`, `vsby_origin` y
 * `CRS_DEP_MIN_sin`, y el modelo usa `congestion_orig_window`, `ORIG_WX_VSBY`
 * y `dep_hour_sin`. La mitad de un mapeo armado desde ahí apunta a nombres que
 * no existen.
 */
type Lectura = { sube: string; baja: string };

const MOTIVOS: Record<string, Lectura> = {
  // ── El avión y su rotación ────────────────────────────────────────────────
  TAIL_DELAY_DECAY: {
    sube: "Este avión viene demorándose seguido en los últimos días",
    baja: "Este avión viene cumpliendo horarios",
  },
  prev_turnaround_tail_min: {
    sube: "Queda poco tiempo en tierra entre el vuelo anterior y éste",
    baja: "Hay margen cómodo en tierra antes de salir",
  },
  prev_arr_delay_tail: {
    sube: "El avión que hace este vuelo viene demorado de su tramo anterior",
    baja: "El avión que hace este vuelo viene en horario",
  },
  tail_flights_today_prior: {
    sube: "El avión ya hizo varios tramos hoy y arrastra los retrasos del día",
    baja: "Es de los primeros tramos del día para este avión",
  },

  // ── El vuelo en sí ────────────────────────────────────────────────────────
  CRS_ELAPSED_TIME: {
    sube: "Es un vuelo largo, con más lugar para que algo se corra",
    baja: "Es un vuelo corto, con poco margen para acumular retraso",
  },
  DISTANCE: {
    sube: "Es un trayecto largo",
    baja: "Es un trayecto corto",
  },
  DEST: {
    sube: "El aeropuerto de destino suele acumular demoras",
    baja: "El aeropuerto de destino suele operar en horario",
  },
  ORIGIN: {
    sube: "El aeropuerto de salida suele acumular demoras",
    baja: "El aeropuerto de salida suele operar en horario",
  },
  PAR_AIRPORT: {
    sube: "Esta ruta en particular suele demorarse",
    baja: "Esta ruta en particular suele cumplir horarios",
  },
  BEARING_DEG: {
    sube: "La dirección del vuelo lo expone a condiciones menos favorables",
    baja: "La dirección del vuelo es favorable",
  },
  DEST_PAGERANK: {
    sube: "El destino es un aeropuerto muy conectado, donde los retrasos se propagan",
    baja: "El destino es un aeropuerto tranquilo dentro de la red",
  },
  AIRCRAFT_FAMILY: {
    sube: "Este tipo de avión suele demorarse más en esta operación",
    baja: "Este tipo de avión suele cumplir horarios",
  },
  OP_CARRIER: {
    sube: "Esta aerolínea viene con más demoras que el promedio",
    baja: "Esta aerolínea viene cumpliendo mejor que el promedio",
  },

  // ── Hora y calendario ─────────────────────────────────────────────────────
  dep_hour_sin: {
    sube: "A esta hora del día suele haber más demoras en Atlanta",
    baja: "Es un horario tranquilo en Atlanta",
  },
  dep_hour_cos: {
    sube: "A esta hora del día suele haber más demoras en Atlanta",
    baja: "Es un horario tranquilo en Atlanta",
  },
  CRS_DEP_MIN: {
    sube: "El horario de salida cae en una franja complicada",
    baja: "El horario de salida cae en una franja tranquila",
  },
  dep_dow_sin: {
    sube: "Este día de la semana suele ser más complicado",
    baja: "Este día de la semana suele ser tranquilo",
  },
  DAY_OF_WEEK: {
    sube: "Este día de la semana suele ser más complicado",
    baja: "Este día de la semana suele ser tranquilo",
  },
  dep_month_sin: {
    sube: "Es una época del año con más demoras",
    baja: "Es una época del año tranquila",
  },
  DAY_OF_MONTH: {
    sube: "Es una fecha del mes con más movimiento",
    baja: "Es una fecha del mes tranquila",
  },

  // ── Congestión ────────────────────────────────────────────────────────────
  congestion_orig_window: {
    sube: "Atlanta está congestionado en la franja en que sale tu vuelo",
    baja: "Atlanta está despejado en la franja en que sale tu vuelo",
  },
  congestion_dest_window: {
    sube: "El aeropuerto de destino está congestionado a la hora de llegada",
    baja: "El aeropuerto de destino está despejado a la hora de llegada",
  },
  absorb_score_origin: {
    sube: "Atlanta tiene poco margen para absorber retrasos ahora",
    baja: "Atlanta tiene margen para absorber retrasos",
  },

  // ── Cómo viene el día ─────────────────────────────────────────────────────
  origin_delay_rate_1h: {
    sube: "Atlanta viene demorando vuelos en la última hora",
    baja: "Atlanta viene saliendo en horario",
  },
  origin_delay_rate_6h: {
    sube: "Atlanta acumula demoras en lo que va del día",
    baja: "El día en Atlanta viene tranquilo",
  },
  origin_delay_rate_24h: {
    sube: "Atlanta viene con demoras desde ayer",
    baja: "Atlanta viene estable desde ayer",
  },
  dest_delay_rate_1h: {
    sube: "El aeropuerto de destino viene con demoras",
    baja: "El aeropuerto de destino viene en horario",
  },
  dest_delay_rate_6h: {
    sube: "El destino acumula demoras en lo que va del día",
    baja: "El destino viene tranquilo hoy",
  },
  dest_delay_rate_24h: {
    sube: "El destino viene con demoras desde ayer",
    baja: "El destino viene estable desde ayer",
  },
  carrier_delay_rate_24h: {
    sube: "La aerolínea viene demorando vuelos hoy",
    baja: "La aerolínea viene cumpliendo horarios hoy",
  },
  carrier_delay_rate_7d: {
    sube: "La aerolínea viene con demoras esta semana",
    baja: "La aerolínea viene cumpliendo esta semana",
  },
  carrier_delay_rate_yday: {
    sube: "La aerolínea tuvo un día complicado ayer",
    baja: "La aerolínea tuvo un día normal ayer",
  },

  // ── Clima en Atlanta ──────────────────────────────────────────────────────
  ORIG_WX_VSBY: {
    sube: "Hay poca visibilidad en Atlanta",
    baja: "La visibilidad en Atlanta es buena",
  },
  ORIG_WX_CODES: {
    sube: "Hay mal tiempo declarado en Atlanta",
    baja: "No hay fenómenos meteorológicos en Atlanta",
  },
  ORIG_WX_SKNT: {
    sube: "Hay viento fuerte en Atlanta",
    baja: "El viento en Atlanta está calmo",
  },
  ORIG_WX_P01M: {
    sube: "Está lloviendo en Atlanta",
    baja: "No hay precipitación en Atlanta",
  },
  ORIG_WX_TMPC: {
    sube: "La temperatura en Atlanta está fuera de lo habitual",
    baja: "La temperatura en Atlanta es normal",
  },
  ORIG_WX_RELH: {
    sube: "Hay mucha humedad en Atlanta",
    baja: "La humedad en Atlanta es normal",
  },
  ORIG_WX_DWPC: {
    sube: "El aire en Atlanta está cerca de la saturación: puede formarse niebla",
    baja: "El aire en Atlanta está seco",
  },
  ORIG_WX_ALTI: {
    sube: "La presión en Atlanta anticipa mal tiempo",
    baja: "La presión en Atlanta es estable",
  },
  ORIG_WX_MATCH_GAP_MIN: {
    sube: "El dato de clima de Atlanta no es tan reciente como sería ideal",
    baja: "El dato de clima de Atlanta está actualizado",
  },

  // ── Clima en destino ──────────────────────────────────────────────────────
  DEST_WX_P01M: {
    sube: "Está lloviendo en el aeropuerto de destino",
    baja: "No hay precipitación en el destino",
  },
  DEST_WX_CODES: {
    sube: "Hay mal tiempo declarado en el destino",
    baja: "No hay fenómenos meteorológicos en el destino",
  },
  DEST_WX_VSBY: {
    sube: "Hay poca visibilidad en el destino",
    baja: "La visibilidad en el destino es buena",
  },
  DEST_WX_GUST: {
    sube: "Hay ráfagas fuertes en el destino",
    baja: "No hay ráfagas en el destino",
  },
  DEST_WX_SKNT: {
    sube: "Hay viento fuerte en el destino",
    baja: "El viento en el destino está calmo",
  },
  DEST_WX_RELH: {
    sube: "Hay mucha humedad en el destino",
    baja: "La humedad en el destino es normal",
  },
  DEST_WX_DWPC: {
    sube: "El aire en el destino está cerca de la saturación: puede formarse niebla",
    baja: "El aire en el destino está seco",
  },
  DEST_WX_TMPC: {
    sube: "La temperatura en el destino está fuera de lo habitual",
    baja: "La temperatura en el destino es normal",
  },
  DEST_WX_ALTI: {
    sube: "La presión en el destino anticipa mal tiempo",
    baja: "La presión en el destino es estable",
  },
  DEST_WX_PRECIP_FLAG: {
    sube: "Hay precipitación registrada en el destino",
    baja: "No hay precipitación registrada en el destino",
  },
  DEST_WX_MATCH_GAP_MIN: {
    sube: "El dato de clima del destino no es tan reciente como sería ideal",
    baja: "El dato de clima del destino está actualizado",
  },

  // ── Viento en ruta ────────────────────────────────────────────────────────
  ERA5_HEADWIND_KT: {
    sube: "El vuelo enfrenta viento en contra en ruta",
    baja: "El vuelo tiene viento a favor en ruta",
  },
  ERA5_U_KT: {
    sube: "Los vientos en ruta son desfavorables",
    baja: "Los vientos en ruta son favorables",
  },
};

export type MotivoViajero = {
  texto: string;
  /** `true` si empuja hacia la demora. */
  enContra: boolean;
  /** Peso relativo dentro de los motivos mostrados, de 0 a 1. */
  peso: number;
  /** `true` cuando no hubo frase propia y se usó la etiqueta del backend. */
  generico: boolean;
};

/**
 * Convierte un factor sin frase propia en algo mostrable.
 *
 * Existe para que ninguna feature desaparezca. Si mañana el modelo agrega una
 * variable nueva, el viajero va a ver su etiqueta técnica —fea, pero cierta—
 * en vez de una lista de motivos a la que le falta el principal.
 */
function respaldo(f: ShapFactor, enContra: boolean): string {
  const etiqueta = (f.label || f.feature).trim();
  return enContra
    ? `${etiqueta}: empuja hacia la demora`
    : `${etiqueta}: juega a favor`;
}

/**
 * Los motivos que vale mostrarle a un pasajero, del que más pesa al que menos.
 *
 * `maximo` recorta porque una lista de quince razones no es una explicación,
 * es un volcado. Tres o cuatro alcanzan para entender de qué se trata.
 */
export function motivosParaViajero(
  factores: ShapFactor[] | undefined,
  maximo = 4,
): MotivoViajero[] {
  if (!factores || factores.length === 0) return [];

  const traducidos = factores.map((f) => {
    // `direction` viene explícito del backend; no se infiere del signo de
    // `contribution`, que según el endpoint puede llegar ya en valor absoluto
    // y dejaría todos los motivos del mismo lado.
    const enContra = f.direction === "positive";
    const lectura = MOTIVOS[f.feature];
    return {
      texto: lectura ? (enContra ? lectura.sube : lectura.baja) : respaldo(f, enContra),
      enContra,
      generico: !lectura,
      magnitud: Math.abs(f.contribution),
    };
  });

  traducidos.sort((a, b) => b.magnitud - a.magnitud);

  // Se eliminan los duplicados por texto: varias ventanas de la misma señal
  // —origen a 1 h, 6 h y 24 h, o seno y coseno de la hora— se traducen igual,
  // y repetir la misma frase hace ver como ruido lo que es una sola causa. Se
  // conserva la de mayor magnitud porque la lista ya está ordenada.
  const vistos = new Set<string>();
  const unicos = traducidos.filter((m) => {
    if (vistos.has(m.texto)) return false;
    vistos.add(m.texto);
    return true;
  });

  const recortados = unicos.slice(0, maximo);
  const mayor = recortados[0]?.magnitud ?? 1;
  return recortados.map((m) => ({
    texto: m.texto,
    enContra: m.enContra,
    generico: m.generico,
    peso: mayor > 0 ? m.magnitud / mayor : 0,
  }));
}

/** Una frase sobre la probabilidad, sin número. */
export function veredicto(probabilidad: number): {
  titulo: string;
  detalle: string;
} {
  if (probabilidad >= 0.5) {
    return {
      titulo: "Es probable que se demore",
      detalle: "Conviene tenerlo en cuenta si tenés una conexión ajustada.",
    };
  }
  if (probabilidad >= 0.2) {
    return {
      titulo: "Puede demorarse",
      detalle: "No es lo más probable, pero hay señales de riesgo.",
    };
  }
  return {
    titulo: "Debería salir en horario",
    detalle: "No vemos señales de demora para este vuelo.",
  };
}
