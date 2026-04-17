// index.js
Page({
  goToDiary() {
    wx.navigateTo({
      url: '/pages/schools/schools'
    })
  },

  goToProfile() {
    wx.navigateTo({
      url: '/pages/profile/profile'
    })
  }
})
