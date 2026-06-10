// ── NahfiMap List Page ──
const db = require('../../utils/db')
const { getCategories, getCatIcon, getCatColor, getCatLabel } = require('../../utils/proximity')
const { haversine, formatDistance } = require('../../utils/haversine')
const { gcj02ToWgs84 } = require('../../utils/coord')

const app = getApp()

Page({
  data: {
    categories: getCategories(),
    activeCat: '',
    searchQuery: '',
    filteredPlaces: [],
    allPlaces: []
  },

  onShow() {
    this.loadPlaces()
  },

  loadPlaces() {
    const places = db.getAllPlaces()
    const userLat = app.globalData.currentLat
    const userLng = app.globalData.currentLng

    const enriched = places.map(p => ({
      ...p,
      catIcon: getCatIcon(p.category),
      catColor: getCatColor(p.category),
      catLabel: getCatLabel(p.category),
      distanceText: userLat ? formatDistance(haversine(
        gcj02ToWgs84(userLat, userLng)[0],
        gcj02ToWgs84(userLat, userLng)[1],
        p.lat, p.lng
      )) : ''
    }))

    this.setData({ allPlaces: enriched, filteredPlaces: enriched })
  },

  toggleCat(e) {
    const cat = e.currentTarget.dataset.cat
    const newCat = this.data.activeCat === cat ? '' : cat
    this.setData({ activeCat: newCat })
    this.filterPlaces()
  },

  onSearch(e) {
    this.setData({ searchQuery: e.detail.value })
    this.filterPlaces()
  },

  filterPlaces() {
    const { activeCat, searchQuery, allPlaces } = this.data
    let filtered = allPlaces

    if (activeCat) {
      filtered = filtered.filter(p => p.category === activeCat)
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.note && p.note.toLowerCase().includes(q))
      )
    }

    this.setData({ filteredPlaces: filtered })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  },

  goAdd() {
    wx.switchTab({ url: '/pages/add/add' })
  }
})