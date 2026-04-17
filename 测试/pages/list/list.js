// pages/list/list.js
const diaryUtils = require('../../utils/diary.js')

Page({
  data: {
    diaries: [],
    loading: false,
    cloudSync: false,
    localPathTip: '微信小程序本地存储（仅当前设备可见）'
  },

  onLoad() {
    this.loadDiaries()
  },

  onShow() {
    this.loadDiaries()
  },

  async loadDiaries() {
    this.setData({ loading: true })
    const diaries = await diaryUtils.getDiaryList()
    const settings = diaryUtils.initUserSettings()
    const normalized = diaries.map(item => ({
      ...item,
      createTimeText: this.formatTime(item.createTime),
      preview: (item.content || '').replace(/\s+/g, ' ').slice(0, 44),
      feedbackMeta: this.extractFeedbackMeta(item)
    }))

    this.setData({
      diaries: normalized,
      cloudSync: !!settings.cloudSync,
      loading: false
    })
  },

  onPullDownRefresh() {
    this.loadDiaries().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  formatTime(value) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const hh = String(date.getHours()).padStart(2, '0')
    const mm = String(date.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${d} ${hh}:${mm}`
  },

  onViewDiary(e) {
    const { index } = e.currentTarget.dataset
    const diary = this.data.diaries[index]
    if (!diary) return

    wx.showModal({
      title: diary.createTimeText || '日记详情',
      content: diary.content || '无内容',
      showCancel: false,
      confirmText: '我知道了'
    })
  },

  extractFeedbackMeta(diary) {
    const actionData = diary.actionData || {}
    const schoolResponses = actionData.schoolResponses || []
    const selectedIndex = Number(actionData.selectedSchoolIndex)
    const selected = schoolResponses[selectedIndex] || schoolResponses[0] || null
    return {
      hasFeedback: !!selected,
      schoolName: selected?.schoolName || '未记录流派',
      schoolTag: selected?.schoolTag || '',
      response: selected?.response || '本条未保存流派反馈',
      actionName: selected?.action?.name || actionData.selectedAction?.name || '暂无微行动',
      actionSteps: selected?.action?.steps || actionData.selectedAction?.steps || [],
      actionTip: selected?.action?.tip || actionData.selectedAction?.tip || ''
    }
  },

  onViewFeedback(e) {
    const { index } = e.currentTarget.dataset
    const diary = this.data.diaries[index]
    if (!diary) return
    const meta = diary.feedbackMeta || this.extractFeedbackMeta(diary)
    const stepsText = Array.isArray(meta.actionSteps)
      ? meta.actionSteps.map((item, idx) => `${idx + 1}. ${item}`).join('\n')
      : ''

    const detail = [
      `流派：${meta.schoolName}${meta.schoolTag ? `（${meta.schoolTag}）` : ''}`,
      '',
      `回应：${meta.response}`,
      '',
      `微行动：${meta.actionName}`,
      stepsText,
      meta.actionTip ? `提示：${meta.actionTip}` : ''
    ].filter(Boolean).join('\n')

    wx.showModal({
      title: '当时的AI反馈记录',
      content: detail,
      showCancel: false,
      confirmText: '知道了'
    })
  },

  onDeleteDiary(e) {
    const { id } = e.currentTarget.dataset
    wx.showModal({
      title: '删除确认',
      content: '删除后无法恢复，是否继续？',
      success: (res) => {
        if (!res.confirm) return
        const ok = diaryUtils.deleteDiaryById(id)
        if (ok) {
          wx.showToast({ title: '已删除', icon: 'success' })
          this.loadDiaries()
        } else {
          wx.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    })
  }
})