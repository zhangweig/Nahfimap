// ── Nearby Alert Card Component ──
const app = getApp()

Component({
  properties: {
    places: { type: Array, value: [] },
    visible: { type: Boolean, value: false }
  },

  methods: {
    goToPlace(e) {
      const id = e.currentTarget.dataset.id
      this.triggerEvent('goto', { id })
      // Mark as reminded
      app.markReminded(id)
    },

    dismiss() {
      // Mark all current alerts as reminded
      this.data.places.forEach(p => app.markReminded(p.id))
      this.triggerEvent('dismiss')
    }
  }
})