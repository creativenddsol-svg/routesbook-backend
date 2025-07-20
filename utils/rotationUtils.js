// ✅ utils/rotationUtils.js

/**
 * Get all operating trip turns for a bus on a given date
 * Supports both rotating schedule buses and regular static ones
 * @param {Object} bus - The bus object with rotationSchedule
 * @param {String} queryDateStr - Date string in YYYY-MM-DD
 * @returns {Array} Array of turn objects { departureTime, arrivalTime }
 */
export function getBusTurnsOnDate(bus, queryDateStr) {
  if (!bus.rotationSchedule?.isRotating) {
    // Regular bus – return the static schedule
    return [
      {
        departureTime: bus.departureTime,
        arrivalTime: bus.arrivalTime,
      },
    ];
  }

  const { startDate, rotationLength, intervals } = bus.rotationSchedule;

  // Validate input
  if (
    !startDate ||
    !rotationLength ||
    !Array.isArray(intervals) ||
    intervals.length === 0
  ) {
    return [];
  }

  const start = new Date(startDate);
  const query = new Date(queryDateStr);

  if (isNaN(start.getTime()) || isNaN(query.getTime())) return [];

  const dayDiff = Math.floor((query - start) / (1000 * 60 * 60 * 24));
  if (dayDiff < 0) return [];

  const rotationDay = dayDiff % rotationLength;

  // ✅ Find all intervals for this rotationDay (supports multiple turns)
  const matched = intervals.find((i) => i.dayOffset === rotationDay);
  if (!matched || !Array.isArray(matched.turns)) return [];

  // Return all defined turns for the day
  return matched.turns;
}
