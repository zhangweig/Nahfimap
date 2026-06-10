// ── NahfiMap Auth / Sync Page ──
const api = require('../../utils/api')
const db = require('../../utils/db')

const app = getApp()

// Simple KML parser (no dependency needed)
function parseKML(text) {
  const places = []
  const polylines = []
  // Match Placemark blocks
  const pmRegex = /<Placemark[\s\S]*?<\/Placemark>/gi
  const pms = text.match(pmRegex) || []
  for (const pm of pms) {
    const nameMatch = pm.match(/<name>([\s\S]*?)<\/name>/i)
    const descMatch = pm.match(/<description>([\s\S]*?)<\/description>/i)
    const name = nameMatch ? nameMatch[1].trim() : '未命名'

    // Check for LineString (route/polyline)
    const lineMatch = pm.match(/<LineString[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/i)
    if (lineMatch) {
      const coords = lineMatch[1].trim().split(/\s+/).filter(c => c)
      const points = coords.map(c => {
        const [lng, lat] = c.split(',').map(Number)
        return { lat, lng }
      }).filter(p => p.lat && p.lng)
      if (points.length > 1) {
        polylines.push({ name, points })
      }
      continue
    }

    // Check for Point (place marker)
    const pointMatch = pm.match(/<Point[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/i)
    if (pointMatch) {
      const coord = pointMatch[1].trim().split(',')
      const lng = parseFloat(coord[0])
      const lat = parseFloat(coord[1])
      if (lat && lng) {
        places.push({
          id: db.genId(),
          name: name,
          category: 'custom',
          difficulty: '',
          rating: 0,
          note: descMatch ? descMatch[1].trim() : '',
          lat, lng,
          photos: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
      }
    }
  }
  return { places, polylines }
}

// Simple GPX parser
function parseGPX(text) {
  const places = []
  const polylines = []

  // Waypoints
  const wptRegex = /<wpt[\s\S]*?<\/wpt>/gi
  const wpts = text.match(wptRegex) || []
  for (const wpt of wpts) {
    const latMatch = wpt.match(/lat="([^"]+)"/i)
    const lonMatch = wpt.match(/lon="([^"]+)"/i)
    const nameMatch = wpt.match(/<name>([\s\S]*?)<\/name>/i)
    if (latMatch && lonMatch) {
      places.push({
        id: db.genId(),
        name: nameMatch ? nameMatch[1].trim() : '未命名路点',
        category: 'custom',
        difficulty: '',
        rating: 0,
        note: '',
        lat: parseFloat(latMatch[1]),
        lng: parseFloat(lonMatch[1]),
        photos: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
    }
  }

  // Tracks (polylines)
  const trkRegex = /<trk[\s\S]*?<\/trk>/gi
  const trks = text.match(trkRegex) || []
  for (const trk of trks) {
    const nameMatch = trk.match(/<name>([\s\S]*?)<\/name>/i)
    const name = nameMatch ? nameMatch[1].trim() : '未命名路线'
    const trkptRegex = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"/gi
    let match
    const points = []
    while ((match = trkptRegex.exec(trk)) !== null) {
      points.push({ lat: parseFloat(match[1]), lng: parseFloat(match[2]) })
    }
    if (points.length > 1) {
      polylines.push({ name, points })
    }
  }

  return { places, polylines }
}

Page({
  data: {
    isLoggedIn: false,
    authUser: null,
    userInitial: '',
    authTab: 'login',
    authForm: { email: '', password: '', name: '' },
    authError: '',
    loading: false,
    syncing: false,
    syncStatus: '',
    placeCount: 0,
    journeyCount: 0,
    nearbyEnabled: true
  },

  onShow() {
    const isLoggedIn = app.globalData.isLoggedIn
    const authUser = app.globalData.authUser
    const nearbyEnabled = wx.getStorageSync('nahfimap_nearby_enabled') !== false

    this.setData({
      isLoggedIn,
      authUser,
      userInitial: authUser ? authUser.name.charAt(0) : '',
      placeCount: db.getAllPlaces().length,
      journeyCount: db.getAllJourneys().length,
      nearbyEnabled
    })
  },

  // ── Tab switch ──
  switchTab(e) {
    this.setData({
      authTab: e.currentTarget.dataset.tab,
      authError: '',
      authForm: { email: '', password: '', name: '' }
    })
  },

  // ── Form input ──
  onFormInput(e) {
    const field = e.currentTarget.dataset.field
    const val = e.detail.value
    this.data.authForm[field] = val
    this.setData({ authForm: this.data.authForm })
  },

  // ── Register ──
  async doRegister() {
    const { email, password, name } = this.data.authForm
    if (!email || !password || !name) {
      this.setData({ authError: '请填写所有字段' })
      return
    }
    if (password.length < 6) {
      this.setData({ authError: '密码至少 6 位' })
      return
    }

    this.setData({ loading: true, authError: '' })
    try {
      const res = await api.register(email, password, name)
      app.globalData.authToken = res.token
      app.globalData.authUser = res.user
      app.globalData.isLoggedIn = true
      wx.setStorageSync('nahfimap_token', res.token)
      wx.setStorageSync('nahfimap_user', res.user)
      this.setData({
        isLoggedIn: true,
        authUser: res.user,
        userInitial: res.user.name.charAt(0),
        loading: false
      })
      wx.showToast({ title: '注册成功！', icon: 'success' })
    } catch (e) {
      this.setData({ authError: e.message, loading: false })
    }
  },

  // ── Login ──
  async doLogin() {
    const { email, password } = this.data.authForm
    if (!email || !password) {
      this.setData({ authError: '请输入邮箱和密码' })
      return
    }

    this.setData({ loading: true, authError: '' })
    try {
      const res = await api.login(email, password)
      app.globalData.authToken = res.token
      app.globalData.authUser = res.user
      app.globalData.isLoggedIn = true
      wx.setStorageSync('nahfimap_token', res.token)
      wx.setStorageSync('nahfimap_user', res.user)
      this.setData({
        isLoggedIn: true,
        authUser: res.user,
        userInitial: res.user.name.charAt(0),
        loading: false
      })
      wx.showToast({ title: '登录成功！', icon: 'success' })
    } catch (e) {
      this.setData({ authError: e.message, loading: false })
    }
  },

  // ── Logout ──
  doLogout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后本地数据保留，但无法同步',
      success: (res) => {
        if (res.confirm) {
          app.globalData.authToken = null
          app.globalData.authUser = null
          app.globalData.isLoggedIn = false
          wx.removeStorageSync('nahfimap_token')
          wx.removeStorageSync('nahfimap_user')
          this.setData({
            isLoggedIn: false,
            authUser: null,
            authForm: { email: '', password: '', name: '' }
          })
        }
      }
    })
  },

  // ── Cloud sync ──
  async syncCloud() {
    if (!app.globalData.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    this.setData({ syncing: true, syncStatus: '正在同步...' })
    const token = app.globalData.authToken
    const lastSync = wx.getStorageSync('nahfimap_lastSync') || 0

    try {
      // Pull remote changes
      this.setData({ syncStatus: '拉取云端数据...' })
      const remotePlaces = await api.pullPlaces(token, lastSync)
      const remoteJourneys = await api.pullJourneys(token, lastSync)

      // Merge: remote wins for conflicts (same id, newer updatedAt)
      const localPlaces = db.getAllPlaces()
      const localJourneys = db.getAllJourneys()

      const mergedPlaces = this._merge(localPlaces, remotePlaces.places || [])
      const mergedJourneys = this._merge(localJourneys, remoteJourneys.journeys || [])

      // Save merged data locally
      wx.setStorageSync('nahfimap_places', mergedPlaces)
      wx.setStorageSync('nahfimap_journeys', mergedJourneys)

      // Push local-only changes
      this.setData({ syncStatus: '推送本地数据...' })
      const localOnlyPlaces = mergedPlaces.filter(p => p.updatedAt > lastSync)
      const localOnlyJourneys = mergedJourneys.filter(j => j.updatedAt > lastSync)

      if (localOnlyPlaces.length > 0) await api.pushPlaces(token, localOnlyPlaces)
      if (localOnlyJourneys.length > 0) await api.pushJourneys(token, localOnlyJourneys)

      // Update sync timestamp
      wx.setStorageSync('nahfimap_lastSync', Date.now())
      app.loadData()

      this.setData({
        syncing: false,
        syncStatus: `同步完成！${localOnlyPlaces.length} 个地点已上传`,
        placeCount: db.getAllPlaces().length,
        journeyCount: db.getAllJourneys().length
      })
      wx.showToast({ title: '同步成功', icon: 'success' })
    } catch (e) {
      this.setData({
        syncing: false,
        syncStatus: '同步失败：' + e.message
      })
      wx.showToast({ title: '同步失败', icon: 'none' })

      // If token expired, force logout
      if (e.message.includes('过期') || e.message.includes('401')) {
        this.doLogout()
      }
    }
  },

  _merge(localArr, remoteArr) {
    const map = {}
    for (const item of localArr) map[item.id] = item
    for (const item of remoteArr) {
      if (!map[item.id] || item.updatedAt > map[item.id].updatedAt) {
        map[item.id] = item
      } else if (item.updatedAt < map[item.id].updatedAt) {
        // Local is newer, keep local
      }
      // Skip deleted items (soft delete: deletedAt field)
      if (item.deletedAt) delete map[item.id]
    }
    return Object.values(map)
  },

  // ── Nearby toggle ──
  toggleNearby(e) {
    const enabled = e.detail.value
    wx.setStorageSync('nahfimap_nearby_enabled', enabled)
    this.setData({ nearbyEnabled: enabled })

    if (enabled) {
      app.startLocationMonitor()
      wx.showToast({ title: '附近提醒已开启', icon: 'success' })
    } else {
      app.stopLocationMonitor()
      wx.showToast({ title: '附近提醒已关闭', icon: 'none' })
    }
  },

  // ── Export JSON ──
  exportJSON() {
    const data = db.exportAll()
    const json = JSON.stringify(data, null, 2)
    wx.setClipboardData({
      data: json,
      success: () => {
        wx.showToast({ title: '已复制到剪贴板', icon: 'success' })
      }
    })
  },

  // ── Import JSON ──
  importJSON() {
    wx.showActionSheet({
      itemList: ['从剪贴板粘贴', '选择文件'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this._importFromClipboard()
        } else {
          this._importFromFile()
        }
      }
    })
  },

  _importFromClipboard() {
    wx.getClipboardData({
      success: (res) => {
        try {
          const data = JSON.parse(res.data)
          this._doImport(data)
        } catch (e) {
          wx.showToast({ title: '剪贴板内容不是有效 JSON', icon: 'none' })
        }
      },
      fail: () => {
        wx.showToast({ title: '无法读取剪贴板', icon: 'none' })
      }
    })
  },

  _importFromFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success: (res) => {
        const filePath = res.tempFiles[0].path
        const fs = wx.getFileSystemManager()
        try {
          const content = fs.readFileSync(filePath, 'utf-8')
          const data = JSON.parse(content)
          this._doImport(data)
        } catch (e) {
          wx.showToast({ title: '文件解析失败', icon: 'none' })
        }
      }
    })
  },

  _doImport(data) {
    if (!data.places && !data.journeys) {
      wx.showToast({ title: '无效数据格式', icon: 'none' })
      return
    }

    // Merge: existing + imported (same id → imported wins if newer)
    const localPlaces = db.getAllPlaces()
    const localJourneys = db.getAllJourneys()
    const importPlaces = data.places || []
    const importJourneys = data.journeys || []

    const mergedPlaces = this._mergeArrays(localPlaces, importPlaces)
    const mergedJourneys = this._mergeArrays(localJourneys, importJourneys)

    db.importAll({ places: mergedPlaces, journeys: mergedJourneys })
    app.loadData()

    this.setData({
      placeCount: mergedPlaces.length,
      journeyCount: mergedJourneys.length
    })

    wx.showToast({
      title: `导入成功！+${importPlaces.length}地点 +${importJourneys.length}旅程`,
      icon: 'success',
      duration: 2000
    })
  },

  _mergeArrays(local, imported) {
    const map = {}
    for (const item of local) map[item.id] = item
    for (const item of imported) {
      if (!map[item.id] || (item.updatedAt || 0) >= (map[item.id].updatedAt || 0)) {
        map[item.id] = item
      }
    }
    return Object.values(map)
  },

  // ── Import KML/GPX ──
  importKML() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['kml', 'gpx'],
      success: (res) => {
        const filePath = res.tempFiles[0].path
        const fileName = res.tempFiles[0].name.toLowerCase()
        const fs = wx.getFileSystemManager()
        try {
          const content = fs.readFileSync(filePath, 'utf-8')
          let result

          if (fileName.endsWith('.gpx')) {
            result = parseGPX(content)
          } else {
            result = parseKML(content)
          }

          const { places, polylines } = result

          if (places.length === 0 && polylines.length === 0) {
            wx.showToast({ title: '文件中未找到地点或路线', icon: 'none' })
            return
          }

          // Save places
          if (places.length > 0) {
            const existing = db.getAllPlaces()
            const merged = this._mergeArrays(existing, places)
            db.importAll({ places: merged, journeys: db.getAllJourneys() })
          }

          // Save polylines as journeys
          if (polylines.length > 0) {
            const existingJourneys = db.getAllJourneys()
            for (const pl of polylines) {
              existingJourneys.push({
                id: db.genId(),
                name: pl.name,
                points: pl.points,
                createdAt: Date.now(),
                updatedAt: Date.now()
              })
            }
            db.importAll({ places: db.getAllPlaces(), journeys: existingJourneys })
          }

          app.loadData()
          this.setData({
            placeCount: db.getAllPlaces().length,
            journeyCount: db.getAllJourneys().length
          })

          wx.showToast({
            title: `导入成功！+${places.length}地点 +${polylines.length}路线`,
            icon: 'success',
            duration: 2500
          })
        } catch (e) {
          wx.showToast({ title: '文件解析失败: ' + e.message, icon: 'none' })
        }
      }
    })
  }
})