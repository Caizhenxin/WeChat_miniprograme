// index.js
Page({
  goToDiary() {
    wx.navigateTo({
      url: '/pages/diary/diary'
    })
  },

  goToProfile() {
    wx.navigateTo({
      url: '/pages/profile/profile'
    })
  }
})
