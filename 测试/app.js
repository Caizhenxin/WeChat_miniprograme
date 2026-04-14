// app.js
App({
  onLaunch: function () {
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloud1-5g19n2tef3830d46',   // 从云开发控制台获取
        traceUser: true
      })
    }
  }
})