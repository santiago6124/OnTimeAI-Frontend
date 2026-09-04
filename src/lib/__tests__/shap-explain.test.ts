import { describe, expect, it } from "vitest";

import { contributionShare, explainFactor } from "@/lib/shap-explain";

/**
 * Vocabulario completo del booster 4year_v9, tomado de `feature_names` en
 * artifacts/4year_v9/model.lgb. Si el modelo incorpora features nuevas, este
 * test falla y obliga a traducirlas antes de que lleguen a la UI en crudo.
 */
const MODEL_FEATURES = [
  "MONTH", "DAY_OF_MONTH", "DAY_OF_WEEK", "OP_CARRIER", "ORIGIN", "DEST",
  "CRS_ELAPSED_TIME", "DISTANCE", "FLOW_ATL", "PAR_AIRPORT", "CRS_DEP_MIN",
  "ORIG_WX_TMPC", "ORIG_WX_DWPC", "ORIG_WX_RELH", "ORIG_WX_DRCT",
  "ORIG_WX_SKNT", "ORIG_WX_ALTI", "ORIG_WX_P01M", "ORIG_WX_VSBY",
  "ORIG_WX_GUST", "ORIG_WX_CODES", "ORIG_WX_PRECIP_FLAG",
  "ORIG_WX_LOW_VIS_FLAG", "ORIG_WX_STRONG_WIND_FLAG", "ORIG_WX_MATCH_GAP_MIN",
  "DEST_WX_TMPC", "DEST_WX_DWPC", "DEST_WX_RELH", "DEST_WX_DRCT",
  "DEST_WX_SKNT", "DEST_WX_ALTI", "DEST_WX_P01M", "DEST_WX_VSBY",
  "DEST_WX_GUST", "DEST_WX_CODES", "DEST_WX_PRECIP_FLAG",
  "DEST_WX_LOW_VIS_FLAG", "DEST_WX_STRONG_WIND_FLAG", "DEST_WX_MATCH_GAP_MIN",
  "BEARING_DEG", "ERA5_U_KT", "ERA5_V_KT", "ERA5_HEADWIND_KT",
  "ERA5_CROSSWIND_KT", "ERA5_TAILWIND_FLAG", "PREV_ACTUAL_BLOCK_MIN",
  "PREV_SCHED_BLOCK_MIN", "PREV_BLOCK_DELTA_MIN", "PREV_HOLDING_MIN",
  "PREV_ROUTE_DEVIATION_PCT", "PREV_ADSB_AVAILABLE", "prev_arr_delay_tail",
  "prev_turnaround_tail_min", "tail_flights_today_prior",
  "carrier_delay_rate_yday", "origin_delay_rate_yday", "carrier_delay_rate_24h",
  "carrier_delay_rate_7d", "origin_delay_rate_1h", "origin_delay_rate_6h",
  "origin_delay_rate_24h", "dest_delay_rate_1h", "dest_delay_rate_6h",
  "dest_delay_rate_24h", "absorb_score_origin", "TAIL_DELAY_DECAY",
  "ORIGIN_PAGERANK", "DEST_PAGERANK", "AIRCRAFT_FAMILY", "is_us_holiday",
  "days_to_nearest_holiday", "is_thanksgiving_window", "is_summer_peak",
  "dep_hour_sin", "dep_hour_cos", "dep_dow_sin", "dep_dow_cos",
  "dep_month_sin", "dep_month_cos", "congestion_orig_window",
  "congestion_dest_window", "wx_both_precip", "wx_both_low_vis",
  "wx_both_strong_wind",
];

describe("explainFactor", () => {
  it("covers every feature the model can emit", () => {
    const untranslated = MODEL_FEATURES.filter(
      (f) => explainFactor(f, "positive").isFallback,
    );
    expect(untranslated).toEqual([]);
  });

  it("never leaks a raw feature name into the sentence", () => {
    for (const feature of MODEL_FEATURES) {
      for (const direction of ["positive", "negative"] as const) {
        const { sentence } = explainFactor(feature, direction, "ATL");
        expect(sentence).not.toContain(feature);
        expect(sentence).not.toContain("_");
      }
    }
  });

  it("gives opposite readings for opposite directions", () => {
    const up = explainFactor("TAIL_DELAY_DECAY", "positive");
    const down = explainFactor("TAIL_DELAY_DECAY", "negative");
    expect(up.sentence).not.toEqual(down.sentence);
    expect(up.sentence).toContain("demoras");
    expect(down.sentence).toContain("horario");
  });

  it("interpolates the observed value for categorical features", () => {
    expect(explainFactor("DEST", "positive", "IND").sentence).toContain("IND");
    expect(explainFactor("OP_CARRIER", "negative", "WN").sentence).toContain("WN");
  });

  it("falls back to a neutral subject when the value is NaN", () => {
    const { sentence } = explainFactor("DEST", "positive", "NaN");
    expect(sentence).not.toContain("NaN");
  });

  it("marks unknown features as fallback instead of throwing", () => {
    const result = explainFactor("SOME_NEW_FEATURE_V10", "positive");
    expect(result.isFallback).toBe(true);
    expect(result.title).toBe("Some new feature v10");
  });
});

describe("contributionShare", () => {
  it("expresses a contribution as a percentage of the total", () => {
    expect(contributionShare(0.25, 1)).toBeCloseTo(25);
    expect(contributionShare(1, 4)).toBeCloseTo(25);
  });

  it("returns zero when there is nothing to divide by", () => {
    expect(contributionShare(0.5, 0)).toBe(0);
  });
});
