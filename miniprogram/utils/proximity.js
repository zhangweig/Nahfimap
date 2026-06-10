// ── Proximity detection engine ──
// Core of the "nearby reminder" feature
// Checks if user's current position is near any saved places

const { haversine, formatDistance, walkTime } = require('./haversine')

// Category-specific proximity thresholds (in meters)
const THRESHOLDS = {
  'camp': 1000,      // Camping spots - wider range (often in remote areas)
  'hike': 1000,      // Hiking trailheads - wider range
  'park': 500,       // Parks/scenic spots - medium range
  'star': 2000,      // Stargazing spots - wide range (remote locations)
  'food': 300,       // Food/restaurants - tight range (walkable)
  'custom': 500      // Custom - medium range
}

const DEFAULT_THRESHOLD = 500  // meters

// Category emoji icons
const CAT_ICONS = {
  'camp': '⛺',
  'hike': '🥾',
  'park': '🌳',
  'star': '🌟',
  'food': '🍜',
  'custom': '📌'
}

// Category labels
const CAT_LABELS = {
  'camp': '露营',
  'hike': '徒步',
  'park': '公园景点',
  'star': '观星摄影',
  'food': '美食',
  'custom': '自定义'
}

/**
 * Check which saved places are within proximity threshold
 * @param {number} userLat - User's WGS-84 latitude
 * @param {number} userLng - User's WGS-84 longitude
 * @param {Array} places - All saved places (WGS-84 coordinates)
 * @returns {Array} Nearby places with distance info, sorted by distance
 */
function checkProximity(userLat, userLng, places) {
  const nearby = []

  for (const place of places) {
    if (!place.lat || !place.lng) continue

    const distance = haversine(userLat, userLng, place.lat, place.lng)
    const threshold = THRESHOLDS[place.category] || DEFAULT_THRESHOLD

    if (distance <= threshold) {
      nearby.push({
        ...place,
        distance: distance,
        distanceText: formatDistance(distance),
        walkTimeText: walkTime(distance),
        threshold: threshold
      })
    }
  }

  // Sort by distance (closest first)
  nearby.sort((a, b) => a.distance - b.distance)

  // Max 5 nearby alerts to avoid overwhelming the user
  return nearby.slice(0, 5)
}

/**
 * Get category icon
 */
function getCatIcon(cat) {
  return CAT_ICONS[cat] || '📌'
}

/**
 * Get category label
 */
function getCatLabel(cat) {
  return CAT_LABELS[cat] || '自定义'
}

/**
 * Get category color (for UI display)
 */
function getCatColor(cat) {
  const colors = {
    'camp': '#2DB86A',
    'hike': '#0A84FF',
    'park': '#FF9F0A',
    'star': '#BF5AF2',
    'food': '#FF453A',
    'custom': '#8E8E93'
  }
  return colors[cat] || '#8E8E93'
}

/**
 * Get all categories
 */
function getCategories() {
  return [
    { key: 'camp', label: '露营', icon: '⛺', color: '#2DB86A' },
    { key: 'hike', label: '徒步', icon: '🥾', color: '#0A84FF' },
    { key: 'park', label: '公园景点', icon: '🌳', color: '#FF9F0A' },
    { key: 'star', label: '观星摄影', icon: '🌟', color: '#BF5AF2' },
    { key: 'food', label: '美食', icon: '🍜', color: '#FF453A' },
    { key: 'custom', label: '自定义', icon: '📌', color: '#8E8E93' }
  ]
}

module.exports = {
  checkProximity, getCatIcon, getCatLabel, getCatColor,
  getCategories, THRESHOLDS, CAT_ICONS, CAT_LABELS
}