export const METRIC_TYPES = [
  "boolean",
  "volume",
  "weight",
  "count",
  "energy",
  "duration",
  "distance",
  "percent",
] as const;

export type MetricType = (typeof METRIC_TYPES)[number];

export const UNITS_BY_TYPE: Record<MetricType, string[]> = {
  boolean: [],
  volume: ["liters", "milliliters"],
  weight: ["kilograms", "grams", "pounds"],
  count: ["count"],
  energy: ["kilocalories", "kilojoules"],
  duration: ["minutes", "hours"],
  distance: ["kilometers", "miles", "meters"],
  percent: ["%"],
};
