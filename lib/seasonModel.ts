/**
 * Season model: combines Open-Meteo climate normals (weather layer)
 * with a demand heuristic (peak/shoulder/off-peak) to produce a
 * 12-month season bar for each destination.
 *
 * When Amadeus keys are present (M7), the demand layer is replaced
 * by real price-calendar data. Until then, we use a hemisphere-aware
 * heuristic and label it clearly.
 */

export type SeasonRating = "great" | "good" | "hot" | "cold" | "wet" | "mixed";
export type DemandLevel = "peak" | "shoulder" | "offpeak";

export interface MonthData {
  month: number;       // 1-12
  label: string;       // "Jan", "Feb", ...
  avgTempC: number;
  precipMm: number;
  weatherRating: SeasonRating;
  demand: DemandLevel; // heuristic (labelled as such)
  overall: "best" | "good" | "ok" | "avoid";
}

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/**
 * Classify monthly weather into a human-readable rating.
 * thresholds are intentionally simple and globally applicable.
 */
export function classifyWeather(tempC: number, precipMm: number): SeasonRating {
  if (tempC > 34) return "hot";
  if (tempC < 3)  return "cold";
  if (precipMm > 200) return "wet";
  if (tempC >= 18 && tempC <= 32 && precipMm <= 120) return "great";
  if (tempC >= 12 && precipMm <= 160) return "good";
  return "mixed";
}

/**
 * Heuristic demand model based on hemisphere and month.
 *   Northern (lat >= 15):  peak Jul/Aug/Dec, shoulder Jun/Sep/Mar/Apr.
 *   Southern (lat <= -15): the northern calendar inverted by six months,
 *                          i.e. peak Jan/Feb/Jun, shoulder Dec/Mar/Sep/Oct.
 *   Tropical (|lat| < 15): peak Dec/Jan/Jul/Aug, shoulder Jun/Nov.
 */
export function heuristicDemand(month: number, lat: number): DemandLevel {
  const isTropical = Math.abs(lat) < 15;
  const isSouthern = lat <= -15;

  if (isTropical) {
    if (month === 12 || month === 1 || month === 7 || month === 8) return "peak";
    if (month === 6 || month === 11) return "shoulder";
    return "offpeak";
  }

  // Southern-hemisphere seasons mirror the north, offset by six months,
  // so map the month onto the northern calendar before applying the rules.
  const m = isSouthern ? ((month + 5) % 12) + 1 : month;

  if (m === 7 || m === 8 || m === 12) return "peak";
  if (m === 3 || m === 4 || m === 6 || m === 9) return "shoulder";
  return "offpeak";
}

/** Combine weather + demand into an overall month score. */
function overallRating(
  weather: SeasonRating,
  demand: DemandLevel
): MonthData["overall"] {
  if (weather === "great" && demand === "offpeak") return "best";
  if ((weather === "great" || weather === "good") && demand !== "peak") return "good";
  if (weather === "cold" || weather === "hot") return "avoid";
  return "ok";
}

/** Build a 12-month season bar from climate data arrays. */
export function buildSeasonBar(
  lat: number,
  temps: number[],    // length 12, avg temp C per month
  precip: number[]    // length 12, total precip mm per month
): MonthData[] {
  return temps.map((temp, i) => {
    const month = i + 1;
    const weatherRating = classifyWeather(temp, precip[i]);
    const demand = heuristicDemand(month, lat);
    return {
      month,
      label: MONTH_LABELS[i],
      avgTempC: Math.round(temp * 10) / 10,
      precipMm: Math.round(precip[i]),
      weatherRating,
      demand,
      overall: overallRating(weatherRating, demand),
    };
  });
}

/**
 * Return months that are "deal" windows: off-peak demand AND good/great weather.
 * Always labelled as heuristic -- never presented as guaranteed savings.
 */
export function getDealMonths(months: MonthData[]): MonthData[] {
  return months.filter(
    (m) =>
      m.demand === "offpeak" &&
      (m.weatherRating === "great" || m.weatherRating === "good")
  );
}

/**
 * Return the single best month (overall === "best" first, then "good" + offpeak).
 */
export function getBestMonth(months: MonthData[]): MonthData | null {
  const best = months.filter((m) => m.overall === "best");
  if (best.length > 0) return best[0];
  const good = months.filter((m) => m.overall === "good" && m.demand !== "peak");
  return good[0] ?? null;
}
