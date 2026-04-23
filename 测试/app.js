// app.js
App({
  onLaunch: function () {
    if (wx.cloud) {
      wx.cloud.init({

        traceUser: true   // 用于追踪用户，方便在控制台查看用户信息
      })
    }
  }
})