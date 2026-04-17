// utils/diary.js

const LOCAL_DIARY_KEY = 'localDiaries'
const USER_SETTINGS_KEY = 'userSettings'
const CHECKIN_DATES_KEY = 'checkinDates'

function initUserSettings() {
  try {
    let settings = wx.getStorageSync(USER_SETTINGS_KEY)
    if (!settings) {
      settings = {
        cloudSync: false,
        autoBackup: false,
        lastSyncTime: null
      }
      wx.setStorageSync(USER_SETTINGS_KEY, settings)
    }
    return settings
  } catch (e) {
    console.error('读取设置失败', e)
    return { cloudSync: false, autoBackup: false, lastSyncTime: null }
  }
}

function updateUserSettings(newSettings) {
  try {
    const currentSettings = initUserSettings()
    const mergedSettings = { ...currentSettings, ...newSettings }
    wx.setStorageSync(USER_SETTINGS_KEY, mergedSettings)
    return mergedSettings
  } catch (e) {
    console.error('保存设置失败', e)
    return initUserSettings()
  }
}

function isCloudSyncEnabled() {
  const settings = initUserSettings()
  return settings.cloudSync === true
}

function getTodayDateKey() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getCheckinDates() {
  try {
    return wx.getStorageSync(CHECKIN_DATES_KEY) || []
  } catch (e) {
    console.error('读取打卡记录失败', e)
    return []
  }
}

function addCheckinIfNeeded() {
  try {
    const today = getTodayDateKey()
    const dates = getCheckinDates()
    const alreadyCheckedIn = dates.includes(today)
    if (!alreadyCheckedIn) {
      dates.push(today)
      wx.setStorageSync(CHECKIN_DATES_KEY, dates)
    }
    return {
      isFirstCheckInToday: !alreadyCheckedIn,
      totalCheckins: dates.length,
      today
    }
  } catch (e) {
    console.error('更新打卡记录失败', e)
    return {
      isFirstCheckInToday: false,
      totalCheckins: getCheckinDates().length,
      today: getTodayDateKey()
    }
  }
}

function getLocalDiaryList() {
  try {
    return wx.getStorageSync(LOCAL_DIARY_KEY) || []
  } catch (e) {
    console.error('读取本地日记失败', e)
    return []
  }
}

function setLocalDiaryList(diaries) {
  wx.setStorageSync(LOCAL_DIARY_KEY, diaries)
}

async function saveDiaryToCloud(record) {
  try {
    if (!wx.cloud) return false
    const db = wx.cloud.database()
    await db.collection('diaries').add({
      data: {
        content: record.content,
        imagePath: record.imagePath,
        actionData: record.actionData,
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })
    return true
  } catch (error) {
    console.error('云端保存失败:', error)
    return false
  }
}

async function saveDiary(content, imagePath = '', actionData = {}) {
  try {
    const now = new Date().toISOString()
    const record = {
      id: `diary_${Date.now()}`,
      content,
      imagePath,
      actionData,
      createTime: now,
      updateTime: now,
      saveMode: 'local'
    }

    const diaries = getLocalDiaryList()
    diaries.unshift(record)
    setLocalDiaryList(diaries)

    const checkinStatus = addCheckinIfNeeded()
    let cloudSynced = false
    if (isCloudSyncEnabled()) {
      cloudSynced = await saveDiaryToCloud(record)
      if (cloudSynced) {
        updateUserSettings({ lastSyncTime: now })
      }
    }

    return {
      success: true,
      diary: record,
      checkinStatus,
      cloudSynced
    }
  } catch (error) {
    console.error('保存日记失败:', error)
    return {
      success: false,
      error: error.message || '保存失败'
    }
  }
}

async function getDiaryList() {
  const diaries = getLocalDiaryList()
  return diaries.sort((a, b) => new Date(b.createTime) - new Date(a.createTime))
}

function deleteDiaryById(id) {
  try {
    const diaries = getLocalDiaryList()
    const next = diaries.filter(item => item.id !== id)
    setLocalDiaryList(next)
    return true
  } catch (e) {
    console.error('删除日记失败', e)
    return false
  }
}

module.exports = {
  initUserSettings,
  updateUserSettings,
  isCloudSyncEnabled,
  saveDiary,
  getDiaryList,
  deleteDiaryById,
  getCheckinDates
}
