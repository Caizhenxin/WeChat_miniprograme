// pages/profile/profile.js
const diaryUtils = require('../../utils/diary.js')

Page({
  data: {
    diaryCount: 0,
    cloudSync: false
  },

  onShow() {
    // 加载日记数量
    this.loadDiaryCount()
  },

  loadDiaryCount() {
    try {
      const diaries = wx.getStorageSync('localDiaries') || []
      const settings = diaryUtils.initUserSettings()
      this.setData({ diaryCount: diaries.length, cloudSync: !!settings.cloudSync })
    } catch (e) {
      console.error('加载日记数量失败', e)
      this.setData({ diaryCount: 0, cloudSync: false })
    }
  },

  goToSettings() {
    wx.navigateTo({
      url: '/pages/settings/settings'
    })
  },

  goToReport() {
    wx.navigateTo({
      url: '/pages/report/report'
    })
  },

  goToDiaryList() {
    wx.navigateTo({
      url: '/pages/list/list'
    })
  },

  showPrivacyInfo() {
    wx.showModal({
      title: '隐私说明',
      content: '微光日记非常重视您的隐私保护。\n\n您的日记数据仅保存在本设备的本地存储中，我们无法访问您的任何数据。\n\n• 数据存储在您的手机本地\n• 未开启云端同步时，数据不会上传\n• 我们不会收集、存储或查看您的日记内容\n• 您可以随时删除所有数据',
      showCancel: false,
      confirmText: '知道了'
    })
  }
})