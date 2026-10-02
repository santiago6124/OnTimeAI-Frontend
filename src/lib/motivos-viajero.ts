import type { ShapFactor } from "@/lib/api";

/**
 * Traduce lo que el modelo usó a algo que un pasajero entienda.
 *
 * El panel de operaciones muestra `prev_arr_delay_tail` con su valor SHAP y
 * eso está bien para quien sabe qué es. A un viajero no le dice nada: lo que
 * quiere saber es *por qué* su vuelo puede demorarse, en una frase.
 *
 * Cada feature tiene dos lecturas según el signo del SHAP, porque la misma
 * variable empuja en direcciones opuestas: que el avión anterior venga tarde
 * suma riesgo, que venga puntual lo resta. Mostrar solo el nombre perdería
 * justamente eso.
 *
 * Las que no están acá se omiten a propósito. `CRS_DEP_MIN_sin`,
 * `PAGERANK_ORIGIN` o `AIRCRAFT_FAMILY` son reales y pesan, pero no hay forma
 * honesta de explicárselas a un pasajero en una línea, y una explicación que
 * no se entiende es peor que una explicación de menos.
 */
type Lectura = { sube: string; baja: string };

const MOTIVOS: Record<string, Lectura> = {
  prev_arr_delay_tail: {
    sube: "El avión que hace este vuelo viene demorado de su tramo anterior",
    baja: "El avión que hace este vuelo viene en horario",
  },
  prev_turnaround_tail_min: {
    sube: "Queda poco tiempo en tierra entre el vuelo anterior y éste",
    baja: "Hay margen cómodo en tierra antes de salir",
  },
  tail_flights_today_prior: {
    sube: "El avión ya hizo varios tramos hoy y arrastra los retrasos del día",
    baja: "Es de los primeros tramos del día para este avión",
  },
  TAIL_DELAY_DECAY: {
    sube: "Este avión viene demorándose seguido en los últimos días",
    baja: "Este avión viene cumpliendo horarios",
  },
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
  origin_delay_rate_yday: {
    sube: "Atlanta tuvo un día complicado ayer",
    baja: "Atlanta tuvo un día normal ayer",
  },
  dest_delay_rate_1h: {
    sube: "El aeropuerto de destino viene con demoras",
    baja: "El aeropuerto de destino viene en horario",
  },
  dest_delay_rate_6h: {
    sube: "El destino acumula demoras en lo que va del día",
    baja: "El destino viene tranquilo hoy",
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
  vsby_origin: {
    sube: "Hay poca visibilidad en Atlanta",
    baja: "La visibilidad en Atlanta es buena",
  },
  sknt_origin: {
    sube: "Hay viento fuerte en Atlanta",
    baja: "El viento en Atlanta está calmo",
  },
  tmpf_origin: {
    sube: "La temperatura en Atlanta está fuera de lo habitual",
    baja: "La temperatura en Atlanta es normal",
  },
  alti_origin: {
    sube: "La presión en Atlanta anticipa mal tiempo",
    baja: "La presión en Atlanta es estable",
  },
  congestion_score: {
    sube: "Atlanta está congestionado a esta hora",
    baja: "Atlanta está despejado a esta hora",
  },
  absorb_score: {
    sube: "Atlanta tiene poco margen para absorber retrasos ahora",
    baja: "Atlanta tiene margen para absorber retrasos",
  },
  CRS_ELAPSED_TIME: {
    sube: "Es un vuelo largo, con más lugar para que algo se corra",
    baja: "Es un vuelo corto",
  },
  DISTANCE: {
    sube: "Es un trayecto largo",
    baja: "Es un trayecto corto",
  },
};

export type MotivoViajero = {
  texto: string;
  /** `true` si empuja hacia la demora. */
  enContra: boolean;
  /** Peso relativo dentro de los motivos mostrados, de 0 a 1. */
  peso: number;
};

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

  const traducidos = factores
    .map((f) => {
      const lectura = MOTIVOS[f.feature];
      if (!lectura) return null;
      // `direction` viene explícito del backend; no se infiere del signo de
      // `contribution`, que según el endpoint puede llegar ya en valor
      // absoluto y dejaría todos los motivos del mismo lado.
      const enContra = f.direction === "positive";
      return {
        texto: enContra ? lectura.sube : lectura.baja,
        enContra,
        magnitud: Math.abs(f.contribution),
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null)
    .sort((a, b) => b.magnitud - a.magnitud);

  // Se eliminan los duplicados por texto: varias ventanas de la misma señal
  // —origen a 1 h, 6 h y 24 h— pueden traducirse parecido, y repetir la misma
  // frase tres veces hace ver como ruido lo que es una sola causa.
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
