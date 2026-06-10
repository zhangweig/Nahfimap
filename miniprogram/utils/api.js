// ── Worker API wrapper ──
// Wraps the Cloudflare Worker API for cloud sync

const API_URL = 'https://nahfimap-api.nahfimap.workers.dev'

/**
 * Register a new user
 */
function register(email, password, name) {
  return wx.request({
    url: `${API_URL}/api/auth/register`,
    method: 'POST',
    data: { email, password, name },
    header: { 'Content-Type': 'application/json' }
  }).then(res => {
    if (res.data.ok) return res.data
    throw new Error(res.data.error || '注册失败')
  })
}

/**
 * Login with email + password
 */
function login(email, password) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_URL}/api/auth/login`,
      method: 'POST',
      data: { email, password },
      header: { 'Content-Type': 'application/json' },
      success: (res) => {
        if (res.data.ok) resolve(res.data)
        else reject(new Error(res.data.error || '登录失败'))
      },
      fail: (err) => reject(new Error('网络错误'))
    })
  })
}

/**
 * Pull places since last sync
 */
function pullPlaces(token, since) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_URL}/api/places${since ? '?since=' + since : ''}`,
      method: 'GET',
      header: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      success: (res) => {
        if (res.statusCode === 200) resolve(res.data)
        else if (res.statusCode === 401) reject(new Error('登录已过期，请重新登录'))
        else reject(new Error('同步失败'))
      },
      fail: () => reject(new Error('网络错误'))
    })
  })
}

/**
 * Push local places to server
 */
function pushPlaces(token, places) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_URL}/api/places/push`,
      method: 'POST',
      data: { places },
      header: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      success: (res) => {
        if (res.data.ok) resolve(res.data)
        else reject(new Error(res.data.error || '推送失败'))
      },
      fail: () => reject(new Error('网络错误'))
    })
  })
}

/**
 * Pull journeys since last sync
 */
function pullJourneys(token, since) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_URL}/api/journeys${since ? '?since=' + since : ''}`,
      method: 'GET',
      header: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      success: (res) => {
        if (res.statusCode === 200) resolve(res.data)
        else reject(new Error('同步失败'))
      },
      fail: () => reject(new Error('网络错误'))
    })
  })
}

/**
 * Push local journeys to server
 */
function pushJourneys(token, journeys) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_URL}/api/journeys/push`,
      method: 'POST',
      data: { journeys },
      header: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      success: (res) => {
        if (res.data.ok) resolve(res.data)
        else reject(new Error(res.data.error || '推送失败'))
      },
      fail: () => reject(new Error('网络错误'))
    })
  })
}

module.exports = { register, login, pullPlaces, pushPlaces, pullJourneys, pushJourneys, API_URL }