// ── Coordinate transformation: WGS-84 ↔ GCJ-02 ──
// China uses GCJ-02 ("Mars coordinates") which adds an offset to WGS-84
// WeChat map component uses GCJ-02, our stored data uses WGS-84

const PI = Math.PI
const a = 6378245.0   // Semi-major axis
const ee = 0.00669342162296594323  // Eccentricity squared

function inChina(lat, lng) {
  return lng > 72.004 && lng < 137.8347 && lat > 0.8293 && lat < 55.8271
}

function _transformLat(x, y) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0
  ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0
  ret += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0
  return ret
}

function _transformLng(x, y) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0
  ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0
  ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0
  return ret
}

/**
 * WGS-84 → GCJ-02 (for displaying stored data on map)
 */
function wgs84ToGcj02(lat, lng) {
  if (!inChina(lat, lng)) return [lat, lng]
  let dLat = _transformLat(lng - 105.0, lat - 35.0)
  let dLng = _transformLng(lng - 105.0, lat - 35.0)
  const radLat = lat / 180.0 * PI
  let magic = Math.sin(radLat)
  magic = 1 - ee * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * PI)
  dLng = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * PI)
  return [lat + dLat, lng + dLng]
}

/**
 * GCJ-02 → WGS-84 (for storing new places from map coordinates)
 */
function gcj02ToWgs84(lat, lng) {
  if (!inChina(lat, lng)) return [lat, lng]
  let dLat = _transformLat(lng - 105.0, lat - 35.0)
  let dLng = _transformLng(lng - 105.0, lat - 35.0)
  const radLat = lat / 180.0 * PI
  let magic = Math.sin(radLat)
  magic = 1 - ee * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * PI)
  dLng = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * PI)
  return [lat - dLat, lng - dLng]
}

module.exports = { wgs84ToGcj02, gcj02ToWgs84, inChina }