// ── NahfiMap Add Place Page ──
const db = require('../../utils/db')
const { getCategories, getCatIcon, getCatColor, getCatLabel } = require('../../utils/proximity')
const { gcj02ToWgs84 } = require('../../utils/coord')

const app = getApp()

Page({
  data: {
    name: '',
    category: 'food',       // Default to food (most common use case for nearby reminder)
    difficulty: '',
    rating: 0,
    note: '',
    photos: [],
    photoPaths: [],          // Original file paths for storage
    lat: 0,
    lng: 0,
    useCurrentLocation: false,
    useExifCoord: false,
    hasExifCoord: false,
    saving: false,
    categories: getCategories()
  },

  onLoad(options) {
    // Coordinates passed from map long-press or current location
    if (options.lat && options.lng) {
      this.setData({
        lat: parseFloat(options.lat),
        lng: parseFloat(options.lng)
      })
    } else {
      // Use current location as default
      this._useCurrentLocation()
    }
  },

  _useCurrentLocation() {
    const gLat = app.globalData.currentLat
    const gLng = app.globalData.currentLng
    if (gLat && gLng) {
      const [wgsLat, wgsLng] = gcj02ToWgs84(gLat, gLng)
      this.setData({
        lat: wgsLat,
        lng: wgsLng,
        useCurrentLocation: true
      })
    } else {
      wx.getLocation({
        type: 'wgs84',
        success: (res) => {
          this.setData({
            lat: res.latitude,
            lng: res.longitude,
            useCurrentLocation: true
          })
        }
      })
    }
  },

  // ── Input handlers ──

  onNameInput(e) { this.setData({ name: e.detail.value }) },
  onNoteInput(e) { this.setData({ note: e.detail.value }) },

  selectCat(e) { this.setData({ category: e.currentTarget.dataset.cat }) },
  selectDiff(e) { this.setData({ difficulty: e.currentTarget.dataset.d }) },
  selectRating(e) { this.setData({ rating: e.currentTarget.dataset.r }) },

  // ── Photo selection ──
  // Mini Program: wx.chooseImage → get tempFilePath
  // EXIF GPS extraction happens on server side

  choosePhoto() {
    const remaining = 6 - this.data.photos.length
    wx.chooseImage({
      count: remaining,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newPaths = res.tempFilePaths
        this.setData({
          photos: [...this.data.photos, ...newPaths],
          photoPaths: [...this.data.photoPaths, ...newPaths]
        })

        // Try to get EXIF GPS from first photo if no coords yet
        if (!this.data.useExifCoord && !this.data.useCurrentLocation) {
          this._tryExifGPS(newPaths[0])
        }
      }
    })
  },

  _tryExifGPS(filePath) {
    // Mini Program can't read EXIF directly
    // wx.getImageInfo provides basic info but NOT GPS coordinates
    // For MVP, we skip EXIF GPS and rely on map long-press or current location
    // In future, we can upload photo to server and extract EXIF there
    // For now, just show a note
    wx.getImageInfo({
      src: filePath,
      success: (info) => {
        // info only contains width, height, path, orientation - no GPS
        console.log('Image info (no GPS in MP):', info)
      }
    })
  },

  // ── Save place ──

  savePlace() {
    const { name, category, difficulty, rating, note, lat, lng, photos } = this.data

    if (!name) {
      wx.showToast({ title: '请输入地点名称', icon: 'none' })
      return
    }
    if (!lat || !lng) {
      wx.showToast({ title: '请设置坐标', icon: 'none' })
      return
    }

    this.setData({ saving: true })

    const place = {
      id: db.genId(),
      name: name,
      category: category,
      difficulty: difficulty,
      rating: rating,
      note: note,
      lat: lat,
      lng: lng,
      photos: photos,     // Store temp paths (in production, upload to R2 first)
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    db.savePlace(place)
    app.loadData()

    this.setData({ saving: false })
    wx.showToast({ title: '已保存！', icon: 'success' })

    // Navigate back to map after saving
    setTimeout(() => {
      wx.switchTab({ url: '/pages/map/map' })
    }, 1000)
  }
})