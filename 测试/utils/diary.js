// utils/diary.js

// ========== 日记数据结构 ==========
class DiaryData {
  constructor(content, schoolId, actionData) {
    this.id = Date.now()
    this.content = content
    this.selectedSchool = schoolId
    this.action = actionData
    this.timestamp = new Date()
    this.synced = false
    this.version = 1
  }
}

// ========== 用户设置管理 ==========
function initUserSettings() {
  try {
    let settings = wx.getStorageSync('userSettings')
    if (!settings) {
      settings = {
        cloudSync: false,
        autoBackup: false,
        lastSyncTime: null
      }
      wx.setStorageSync('userSettings', settings)
    }
    return settings
  } catch (e) {
    console.error('读取设置失败', e)
    return { cloudSync: false, autoBackup: false }
  }
}

function updateUserSettings(newSettings) {
  try {
    const currentSettings = initUserSettings()
    const mergedSettings = { ...currentSettings, ...newSettings }
    wx.setStorageSync('userSettings', mergedSettings)
    return mergedSettings
  } catch (e) {
    console.error('保存设置失败', e)
  }
}

function isCloudSyncEnabled() {
  const settings = initUserSettings()
  return settings.cloudSync === true
}

// ========== 日记保存（核心） ==========
async function saveDiary(content, imagePath = '', actionData = {}) {
  try {
    const db = wx.cloud.database()
    const userInfo = wx.getStorageSync('userInfo') || {}
    
    await db.collection('diaries').add({
      data: {
        content: content,
        imagePath: imagePath,
        actionData: actionData,
        userId: userInfo.openId || '',
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })
    
    return true
  } catch (error) {
    console.error('保存日记失败:', error)
    return false
  }
}

/**
 * 获取日记列表
 * @returns {Promise<Array>} 日记列表
 */
async function getDiaryList() {
  try {
    const db = wx.cloud.database()
    const res = await db.collection('diaries')
      .orderBy('createTime', 'desc')
      .get()
    
    return res.data
  } catch (error) {
    console.error('获取日记列表失败:', error)
    return []
  }
}

// 导出方法（CommonJS 规范）
module.exports = {
  saveDiary: saveDiary,
  getDiaryList: getDiaryList
}
