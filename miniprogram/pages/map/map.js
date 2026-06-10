// ── NahfiMap Map Page Logic ──
const db = require('../../utils/db')
const { wgs84ToGcj02, gcj02ToWgs84 } = require('../../utils/coord')
const { getCategories, getCatIcon, getCatColor, getCatLabel } = require('../../utils/proximity')

const app = getApp()

Page({
  data: {
    // Map state
    mapLat: 31,        // GCJ-02 center lat
    mapLng: 103.5,     // GCJ-02 center lng
    mapScale: 5,
    markers: [],
    polylines: [],
    showLocation: true,
    activeTile: 'voyager',
    tileOptions: [
      { key: 'voyager', label: '简约' },
      { key: 'zh', label: '中文' },
      { key: 'satellite', label: '卫星' },
      { key: 'hybrid', label: '混合' },
      { key: 'topo', label: '地形' }
    ],

    // Category filter
    categories: getCategories(),
    activeCat: '',     // '' means show all

    // Nearby alerts
    nearbyAlerts: [],
    nearbyDismissed: false,

    // Location
    isLocating: false,

    // Search
    searchQuery: '',
    searchResults: [],

    // Add modal
    showAddModal: false,
    addLat: 0,
    addLng: 0
  },

  _mapCtx: null,

  onLoad() {
    // Get map context for controls
    this._mapCtx = wx.createMapContext('map')
    // Load places and render markers
    this.renderMarkers()
    // Try to center on user location
    this.locateUser()
  },

  onShow() {
    // Refresh markers when returning to this page
    this.renderMarkers()
    // Check for nearby alerts
    const nearby = app.globalData.nearbyAlerts
    if (nearby.length > 0 && !app.globalData.nearbyShown) {
      this.setData({
        nearbyAlerts: nearby.map(p => ({
          ...p,
          catIcon: getCatIcon(p.category),
          catColor: getCatColor(p.category),
          gcjLat: wgs84ToGcj02(p.lat, p.lng)[0],
          gcjLng: wgs84ToGcj02(p.lat, p.lng)[1]
        })),
        nearbyDismissed: false
      })
      app.globalData.nearbyShown = true
    }

    // Register nearby callback for real-time detection
    app.onNearbyDetected((nearby) => {
      this.setData({
        nearbyAlerts: nearby.map(p => ({
          ...p,
          catIcon: getCatIcon(p.category),
          catColor: getCatColor(p.category),
          gcjLat: wgs84ToGcj02(p.lat, p.lng)[0],
          gcjLng: wgs84ToGcj02(p.lat, p.lng)[1]
        })),
        nearbyDismissed: false
      })
    })
  },

  onHide() {
    // Unregister nearby callback
    app.onNearbyDetected(null)
  },

  // ── Render markers from stored places ──
  renderMarkers() {
    app.loadData()
    const places = app.globalData.places
    const activeCat = this.data.activeCat

    const filtered = activeCat
      ? places.filter(p => p.category === activeCat)
      : places

    const markers = filtered.map(p => {
      const [gcjLat, gcjLng] = wgs84ToGcj02(p.lat, p.lng)
      const catColor = getCatColor(p.category)
      return {
        id: p.id,
        latitude: gcjLat,
        longitude: gcjLng,
        title: p.name,
        iconPath: this._getMarkerIcon(p.category),
        width: 24,
        height: 24,
        callout: {
          content: getCatIcon(p.category) + ' ' + p.name,
          color: '#F5F5F7',
          fontSize: 13,
          borderRadius: 8,
          bgColor: catColor + 'DD',
          padding: 6,
          display: 'BYCLICK'
        },
        anchor: { x: 0.5, y: 1 }
      }
    })

    this.setData({ markers })
  },

  _getMarkerIcon(cat) {
    // Mini Program map markers need local icon files
    // We'll create simple colored dot icons in images/
    const iconMap = {
      'camp': '/images/marker-camp.png',
      'hike': '/images/marker-hike.png',
      'park': '/images/marker-park.png',
      'star': '/images/marker-star.png',
      'food': '/images/marker-food.png',
      'custom': '/images/marker-custom.png'
    }
    return iconMap[cat] || '/images/marker-custom.png'
  },

  // ── Map events ──

  onMarkerTap(e) {
    const markerId = e.detail.markerId
    const place = db.getPlaceById(markerId)
    if (place) {
      wx.navigateTo({
        url: `/pages/detail/detail?id=${place.id}`
      })
    }
  },

  onMapTap(e) {
    // Dismiss nearby sheet
    if (this.data.nearbyAlerts.length > 0) {
      this.setData({ nearbyDismissed: true })
    }
  },

  onMapLongPress(e) {
    // Long press to add a new place at this location
    const lat = e.detail.latitude  // GCJ-02 from map
    const lng = e.detail.longitude
    this.setData({
      showAddModal: true,
      addLat: lat.toFixed(4),
      addLng: lng.toFixed(4)
    })
    // Store GCJ-02 coords for conversion later
    this._addCoords = [lat, lng]
  },

  onRegionChange(e) {
    // Track map center/scale for state management
    if (e.type === 'end' && e.causedBy === 'gesture') {
      this.setData({
        mapScale: e.detail.scale
      })
    }
  },

  // ── Add place ──

  confirmAdd() {
    const [gcjLat, gcjLng] = this._addCoords
    const [wgsLat, wgsLng] = gcj02ToWgs84(gcjLat, gcjLng)
    wx.navigateTo({
      url: `/pages/add/add?lat=${wgsLat}&lng=${wgsLng}`
    })
    this.setData({ showAddModal: false })
  },

  cancelAdd() {
    this.setData({ showAddModal: false })
  },

  // ── Category filter ──

  toggleCat(e) {
    const cat = e.currentTarget.dataset.cat
    const newCat = this.data.activeCat === cat ? '' : cat
    this.setData({ activeCat: newCat })
    this.renderMarkers()
  },

  // ── Map controls ──

  locateUser() {
    this.setData({ isLocating: true })
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          mapLat: res.latitude,
          mapLng: res.longitude,
          mapScale: 14,
          isLocating: false
        })
      },
      fail: () => {
        this.setData({ isLocating: false })
        wx.showToast({ title: '定位失败', icon: 'none' })
      }
    })
  },

  zoomIn() {
    this.setData({ mapScale: Math.min(this.data.mapScale + 1, 20) })
  },

  zoomOut() {
    this.setData({ mapScale: Math.max(this.data.mapScale - 1, 3) })
  },

  // ── Nearby alerts ──

  goToNearby(e) {
    const id = e.currentTarget.dataset.id
    const lat = e.currentTarget.dataset.lat
    const lng = e.currentTarget.dataset.lng
    // Center map on this place
    this.setData({
      mapLat: lat,
      mapLng: lng,
      mapScale: 16,
      nearbyDismissed: true
    })
    // Mark as reminded
    app.markReminded(id)
  },

  dismissNearby() {
    this.setData({ nearbyDismissed: true })
    // Mark all as reminded
    this.data.nearbyAlerts.forEach(p => app.markReminded(p.id))
  },

  // ── Search ──

  onSearchInput(e) {
    this.setData({ searchQuery: e.detail.value })
  },

  onSearch(e) {
    const q = e.detail.value || this.data.searchQuery
    if (!q) return
    const results = db.searchPlaces(q)
    if (results.length > 0) {
      const first = results[0]
      const [gcjLat, gcjLng] = wgs84ToGcj02(first.lat, first.lng)
      this.setData({
        mapLat: gcjLat,
        mapLng: gcjLng,
        mapScale: 16,
        searchQuery: ''
      })
    } else {
      wx.showToast({ title: '未找到地点', icon: 'none' })
    }
  },

  // ── Tile switcher ──
  // Note: WeChat Mini Program map component doesn't support
  // custom tile layers. We use the built-in style options instead.

  switchTile(e) {
    const tile = e.currentTarget.dataset.tile
    this.setData({ activeTile: tile })
    // The native map component style cannot be changed dynamically
    // in current WeChat MP framework. We show a toast about this.
    if (tile !== 'voyager') {
      wx.showToast({
        title: '小程序暂不支持自定义底图',
        icon: 'none',
        duration: 2000
      })
    }
  }
})