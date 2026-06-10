// ── Local storage database ──
// Replaces Dexie (IndexedDB) with wx.setStorageSync
// Max ~10MB storage per user in Mini Program

const PLACE_KEY = 'nahfimap_places'
const JOURNEY_KEY = 'nahfimap_journeys'

// ── Places ──

function getAllPlaces() {
  return wx.getStorageSync(PLACE_KEY) || []
}

function getPlaceById(id) {
  const places = getAllPlaces()
  return places.find(p => p.id === id) || null
}

function savePlace(place) {
  const places = getAllPlaces()
  const idx = places.findIndex(p => p.id === place.id)
  place.updatedAt = Date.now()
  if (idx >= 0) {
    places[idx] = place
  } else {
    places.push(place)
  }
  wx.setStorageSync(PLACE_KEY, places)
  return place
}

function deletePlace(id) {
  let places = getAllPlaces()
  places = places.filter(p => p.id !== id)
  wx.setStorageSync(PLACE_KEY, places)
}

function getPlacesByCategory(cat) {
  return getAllPlaces().filter(p => p.category === cat)
}

// ── Journeys ──

function getAllJourneys() {
  return wx.getStorageSync(JOURNEY_KEY) || []
}

function getJourneyById(id) {
  const journeys = getAllJourneys()
  return journeys.find(j => j.id === id) || null
}

function saveJourney(journey) {
  const journeys = getAllJourneys()
  const idx = journeys.findIndex(j => j.id === journey.id)
  journey.updatedAt = Date.now()
  if (idx >= 0) {
    journeys[idx] = journey
  } else {
    journeys.push(journey)
  }
  wx.setStorageSync(JOURNEY_KEY, journeys)
  return journey
}

function deleteJourney(id) {
  let journeys = getAllJourneys()
  journeys = journeys.filter(j => j.id !== id)
  wx.setStorageSync(JOURNEY_KEY, journeys)
}

// ── Search ──

function searchPlaces(query) {
  const q = query.toLowerCase()
  return getAllPlaces().filter(p =>
    (p.name && p.name.toLowerCase().includes(q)) ||
    (p.note && p.note.toLowerCase().includes(q))
  )
}

// ── Export / Import ──

function exportAll() {
  return {
    places: getAllPlaces(),
    journeys: getAllJourneys(),
    exportedAt: Date.now()
  }
}

function importAll(data) {
  if (data.places) wx.setStorageSync(PLACE_KEY, data.places)
  if (data.journeys) wx.setStorageSync(JOURNEY_KEY, data.journeys)
}

// ── Generate unique ID ──

function genId() {
  return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5)
}

module.exports = {
  getAllPlaces, getPlaceById, savePlace, deletePlace, getPlacesByCategory,
  getAllJourneys, getJourneyById, saveJourney, deleteJourney,
  searchPlaces, exportAll, importAll, genId
}