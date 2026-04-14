// pages/settings/settings.js
const diaryUtils = require('../../utils/diary.js')

Page({
  data: {
    cloudSync: false
  },

  onLoad() {
    const settings = diaryUtils.initUserSettings()
    this.setData({ cloudSync: settings.cloudSync })
  },

  onCloudSyncChange(e) {
    const enabled = e.detail.value
    this.setData({ cloudSync: enabled })

    diaryUtils.updateUserSettings({ cloudSync: enabled })

    if (enabled) {
      wx.showModal({
        title: '确认开启云端同步',
        content: '开启后，您的日记将上传至云端。请确保您信任本服务的数据安全措施。',
        confirmText: '确认开启',
        success: (res) => {
          if (!res.confirm) {
            this.setData({ cloudSync: false })
            diaryUtils.updateUserSettings({ cloudSync: false })
          }
        }
      })
    } else {
      wx.showToast({
        title: '已关闭云端同步',
        icon: 'none'
      })
    }
  }
})