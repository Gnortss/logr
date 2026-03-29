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

export const GOAL_DIRECTIONS = ["at_least", "at_most", "approximately"] as const;
export type GoalDirection = (typeof GOAL_DIRECTIONS)[number];

export const APPROX_TOLERANCE = 0.1; // 10% tolerance for "approximately" direction

export function isGoalMet(
  value: number,
  goal: number | null,
  direction: GoalDirection | null,
  tolerance: number = APPROX_TOLERANCE
): boolean {
  if (goal == null || direction == null) return false;
  switch (direction) {
    case "at_least":
      return value >= goal;
    case "at_most":
      return value <= goal;
    case "approximately":
      return value >= goal * (1 - tolerance) && value <= goal * (1 + tolerance);
  }
}
