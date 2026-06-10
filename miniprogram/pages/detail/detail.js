// ── NahfiMap Detail Page ──
const db = require('../../utils/db')
const { getCatIcon, getCatLabel, getCatColor } = require('../../utils/proximity')
const { wgs84ToGcj02 } = require('../../utils/coord')
const { haversine, formatDistance, walkTime } = require('../../utils/haversine')

const app = getApp()

Page({
  data: {
    place: {},
    catIcon: '',
    catLabel: '',
    catColor: '',
    distanceText: '',
    walkTimeText: ''
  },

  onLoad(options) {
    const id = options.id
    const place = db.getPlaceById(id)
    if (!place) {
      wx.showToast({ title: '地点不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1000)
      return
    }

    // Calculate distance from current location
    const userLat = app.globalData.currentLat
    const userLng = app.globalData.currentLng
    let distanceText = ''
    let walkTimeText = ''
    if (userLat && userLng) {
      const [wgsLat, wgsLng] = require('../../utils/coord').gcj02ToWgs84(userLat, userLng)
      const dist = haversine(wgsLat, wgsLng, place.lat, place.lng)
      distanceText = formatDistance(dist)
      walkTimeText = walkTime(dist)
    }

    this.setData({
      place,
      catIcon: getCatIcon(place.category),
      catLabel: getCatLabel(place.category),
      catColor: getCatColor(place.category),
      distanceText,
      walkTimeText
    })
  },

  navigateTo() {
    const [gcjLat, gcjLng] = wgs84ToGcj02(this.data.place.lat, this.data.place.lng)
    wx.openLocation({
      latitude: gcjLat,
      longitude: gcjLng,
      name: this.data.place.name,
      address: this.data.place.note || this.data.place.name,
      scale: 16
    })
  },

  showOnMap() {
    const [gcjLat, gcjLng] = wgs84ToGcj02(this.data.place.lat, this.data.place.lng)
    wx.switchTab({ url: '/pages/map/map' })
    // Map page will center on this location when shown
    app.globalData._pendingCenter = { lat: gcjLat, lng: gcjLng }
  },

  sharePlace() {
    wx.showShareMenu({ withShareTicket: true })
  },

  deletePlace() {
    wx.showModal({
      title: '确认删除',
      content: `删除「${this.data.place.name}」？此操作不可恢复。`,
      confirmColor: '#FF453A',
      success: (res) => {
        if (res.confirm) {
          db.deletePlace(this.data.place.id)
          app.loadData()
          wx.showToast({ title: '已删除', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1000)
        }
      }
    })
  }
})