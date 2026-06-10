// ── Haversine distance formula ──
// Calculates the great-circle distance between two points on Earth

/**
 * Calculate distance between two coordinates in meters
 * @param {number} lat1 - Point 1 latitude (degrees)
 * @param {number} lng1 - Point 1 longitude (degrees)
 * @param {number} lat2 - Point 2 latitude (degrees)
 * @param {number} lng2 - Point 2 longitude (degrees)
 * @returns {number} Distance in meters
 */
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000  // Earth radius in meters
  const toRad = Math.PI / 180
  const dLat = (lat2 - lat1) * toRad
  const dLng = (lng2 - lng1) * toRad
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) *
    Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Format distance for display
 * @param {number} meters
 * @returns {string} e.g. "380m" or "1.2km"
 */
function formatDistance(meters) {
  if (meters < 1000) {
    return Math.round(meters) + 'm'
  }
  return (meters / 1000).toFixed(1) + 'km'
}

/**
 * Estimate walking time (average 5km/h)
 * @param {number} meters
 * @returns {string} e.g. "3min" or "15min"
 */
function walkTime(meters) {
  const minutes = Math.round(meters / 83.3)  // 5km/h = 83.3m/min
  if (minutes < 1) return '1min'
  if (minutes < 60) return minutes + 'min'
  return Math.round(minutes / 60) + 'h' + (minutes % 60 > 0 ? Math.round(minutes % 60) + 'min' : '')
}

module.exports = { haversine, formatDistance, walkTime }