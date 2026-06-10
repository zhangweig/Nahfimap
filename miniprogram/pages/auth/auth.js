// ── NahfiMap Auth / Sync Page ──
const api = require('../../utils/api')
const db = require('../../utils/db')

const app = getApp()

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
  }
})