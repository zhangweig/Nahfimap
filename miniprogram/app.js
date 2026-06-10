// ── NahfiMap Mini Program ── Global Logic
// Background location monitoring + proximity detection

const { haversine } = require('./utils/haversine')
const { gcj02ToWgs84, wgs84ToGcj02 } = require('./utils/coord')
const { checkProximity } = require('./utils/proximity')
const db = require('./utils/db')

App({
  globalData: {
    // Location
    currentLat: null,       // GCJ-02 latitude (map coords)
    currentLng: null,       // GCJ-02 longitude (map coords)
    locationWatching: false,
    // Nearby alerts
    nearbyAlerts: [],       // places within proximity threshold
    nearbyShown: false,     // whether alert has been shown to user
    // Places data
    places: [],
    journeys: [],
    // Auth
    authToken: null,
    authUser: null,
    isLoggedIn: false,
    // API
    apiUrl: 'https://nahfimap-api.nahfimap.workers.dev'
  },

  onLaunch() {
    // Load data from local storage
    this.loadData()

    // Check saved auth
    const token = wx.getStorageSync('nahfimap_token')
    const user = wx.getStorageSync('nahfimap_user')
    if (token && user) {
      this.globalData.authToken = token
      this.globalData.authUser = user
      this.globalData.isLoggedIn = true
    }

    // Request location permission and start monitoring
    this.startLocationMonitor()
  },

  onShow() {
    // Refresh data when app comes to foreground
    this.loadData()
    // Check nearby alerts if we have location
    if (this.globalData.currentLat) {
      this.detectNearby()
    }
  },

  onHide() {
    // App goes to background - location monitoring continues
    // (via wx.startLocationUpdateBackground)
  },

  // ── Load local data ──
  loadData() {
    this.globalData.places = db.getAllPlaces()
    this.globalData.journeys = db.getAllJourneys()
  },

  // ── Start location monitoring ──
  startLocationMonitor() {
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.userLocation']) {
          this._startWatch()
        } else {
          // Request permission first
          wx.authorize({
            scope: 'scope.userLocation',
            success: () => { this._startWatch() },
            fail: () => {
              // User denied - try again later or guide them to settings
              console.log('Location permission denied')
            }
          })
        }
      }
    })
  },

  _startWatch() {
    if (this.globalData.locationWatching) return

    // Start background location updates (works even when app is in background!)
    wx.startLocationUpdateBackground({
      type: 'gcj02',  // Use GCJ-02 directly (matches map component)
      success: () => {
        this.globalData.locationWatching = true
        console.log('Background location started')
      },
      fail: (err) => {
        // Fallback: try foreground-only location
        wx.startLocationUpdate({
          type: 'gcj02',
          success: () => {
            this.globalData.locationWatching = true
            console.log('Foreground location started (fallback)')
          },
          fail: () => { console.log('All location methods failed:', err) }
        })
      }
    })

    // Listen for location changes
    wx.onLocationChange((res) => {
      this.globalData.currentLat = res.latitude
      this.globalData.currentLng = res.longitude
      this.detectNearby()
    })
  },

  // ── Detect nearby saved places ──
  detectNearby() {
    const lat = this.globalData.currentLat
    const lng = this.globalData.currentLng
    if (!lat || !lng) return

    const places = this.globalData.places
    if (!places.length) return

    // Convert user position from GCJ-02 to WGS-84 for comparison with stored data
    const [wgsLat, wgsLng] = gcj02ToWgs84(lat, lng)

    const nearby = checkProximity(wgsLat, wgsLng, places)
    if (nearby.length > 0) {
      // Filter out already-reminded places (within 24h)
      const reminded = wx.getStorageSync('nahfimap_reminded') || {}
      const filtered = nearby.filter(p => {
        const lastRemind = reminded[p.id]
        if (!lastRemind) return true
        return (Date.now() - lastRemind) > 24 * 3600000  // 24h cooldown
      })

      if (filtered.length > 0) {
        this.globalData.nearbyAlerts = filtered
        this.globalData.nearbyShown = false
        // Notify all pages about nearby discovery
        this._broadcastNearby(filtered)
      }
    }
  },

  // ── Broadcast nearby alert to active pages ──
  _broadcastNearby(nearby) {
    // Mini Program doesn't have global event bus
    // Pages check globalData.nearbyAlerts on their onShow()
    // For immediate foreground notification, we use a callback
    if (this._nearbyCallback) {
      this._nearbyCallback(nearby)
    }
  },

  // ── Register callback for nearby alert (called by map page) ──
  onNearbyDetected(callback) {
    this._nearbyCallback = callback
  },

  // ── Mark a place as reminded ──
  markReminded(placeId) {
    const reminded = wx.getStorageSync('nahfimap_reminded') || {}
    reminded[placeId] = Date.now()
    wx.setStorageSync('nahfimap_reminded', reminded)
  },

  // ── Stop location monitoring ──
  stopLocationMonitor() {
    wx.stopLocationUpdate()
    this.globalData.locationWatching = false
  }
})