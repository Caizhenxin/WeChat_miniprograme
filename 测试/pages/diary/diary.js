// pages/diary/diary.js
const diaryUtils = require('../../utils/diary.js')

Page({
  data: {
    content: '',
    actionData: {
      emotions: {},
      emotionsList: [],
      dominantEmotion: '',
      analyzedAt: '',
      schoolResponses: [],
      selectedSchoolIndex: 0,
      selectedAction: null
    },
    isAnalyzing: false,
    isSaving: false,
    emotionsList: [],
    radarData: null,
    showRadar: false,
    radarRetryCount: 0,
    showCheckinAnimation: false,
    checkinMessage: ''
  },

  onInputContent(e) { this.setData({ content: e.detail.value }) },

  async onAnalyze() {
    const { content } = this.data
    if (!content.trim()) { wx.showToast({ title: '请输入日记内容', icon: 'none' }); return }
    if (this.data.isAnalyzing) return
    this.setData({ isAnalyzing: true })
    wx.showLoading({ title: '分析中...', mask: true })
    try {
      const res = await wx.cloud.callFunction({ name: 'analyzeDiary', data: { content }, timeout: 20000 })
      wx.hideLoading()
      if (!res.result || !res.result.success) throw new Error(res.result?.error || '分析失败')
      const data = res.result.data
      const scores = data.scores || data.emotions || {}
      const emotionsArray = Object.entries(scores).map(([name, score]) => ({ name, score: Math.round(score) }))
      const radarChartData = this.buildRadarData(scores)
      this.setData({
        actionData: {
          emotions: scores, emotionsList: emotionsArray, dominantEmotion: data.dominantEmotion || '未知',
          analyzedAt: new Date().toLocaleString(),
          schoolResponses: data.schoolResponses || this.buildFallbackSchoolResponses(data.dominantEmotion, content),
          selectedSchoolIndex: 0, selectedAction: null
        },
        radarData: radarChartData, showRadar: radarChartData !== null, isAnalyzing: false
      }, () => { if (this.data.showRadar) setTimeout(() => this.drawRadarChart(), 500) })
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: '云端分析失败，使用本地方案', icon: 'none' })
      // 本地兜底分析
      const fallbackScores = this.getFallbackScores(content)
      const emotionsArray = Object.entries(fallbackScores).map(([name, score]) => ({ name, score }))
      const radarChartData = this.buildRadarData(fallbackScores)
      this.setData({
        actionData: {
          emotions: fallbackScores, emotionsList: emotionsArray, dominantEmotion: this.getDominant(fallbackScores),
          analyzedAt: new Date().toLocaleString(),
          schoolResponses: this.buildFallbackSchoolResponses(this.getDominant(fallbackScores), content),
          selectedSchoolIndex: 0, selectedAction: null
        },
        radarData: radarChartData, showRadar: radarChartData !== null, isAnalyzing: false
      }, () => { if (this.data.showRadar) setTimeout(() => this.drawRadarChart(), 500) })
    }
  },

  getFallbackScores(content) {
    const keywords = {
      '快乐': ['开心', '高兴', '快乐', '幸福'], '悲伤': ['难过', '伤心', '悲伤', '痛苦'],
      '焦虑': ['焦虑', '担心', '紧张', '不安'], '平静': ['平静', '放松'],
      '孤独': ['孤独', '寂寞', '孤单'], '疲惫': ['累', '困', '疲惫']
    }
    const scores = { '快乐': 0, '悲伤': 0, '愤怒': 0, '恐惧': 0, '焦虑': 0, '平静': 50, '期待': 0, '失望': 0, '满足': 0, '孤独': 0, '亲密': 0, '迷茫': 0, '疲惫': 0 }
    const lower = content.toLowerCase()
    Object.entries(keywords).forEach(([emotion, words]) => {
      words.forEach(w => { if (lower.includes(w)) scores[emotion] = Math.min(100, scores[emotion] + 30) })
    })
    return scores
  },

  getDominant(scores) {
    let max = 0, dominant = '平静'
    Object.entries(scores).forEach(([name, score]) => { if (score > max) { max = score; dominant = name } })
    return dominant
  },

  buildFallbackSchoolResponses(dominantEmotion, content) {
    const emotion = dominantEmotion || '情绪'
    const shortText = (content || '').slice(0, 36)
    return [
      { schoolKey: 'cbt', schoolName: '认知行为疗法（CBT）', schoolTag: '思维纠偏镜',
        response: '我注意到你在"' + shortText + '"中可能产生了一些自动化思维。我们可以做一次证据检验。',
        action: { name: '三栏笔记法', duration: 4, steps: ['写下发生的情况', '写下你的自动思维', '写下更平衡的理性回应'], tip: '目标是更准确地看待自己' } },
      { schoolKey: 'act', schoolName: '接纳承诺疗法（ACT）', schoolTag: '情绪容纳器',
        response: '你感受到了' + emotion + '，这很正常。请先允许这种情绪存在。',
        action: { name: '情绪接纳练习', duration: 5, steps: ['深呼吸3次', '承认"我现在感到' + emotion + '"', '问自己"此刻什么对我最重要"'], tip: '接纳不是放弃' } },
      { schoolKey: 'humanistic', schoolName: '人本主义', schoolTag: '优势探测器',
        response: '你在不舒服时还愿意记录和反思，这说明你在认真对待自己的生活。',
        action: { name: '优势发现', duration: 3, steps: ['写下今天做对的一件事', '写下自己拥有的一个优点', '对自己说一句鼓励的话'], tip: '先看见自己的价值' } },
      { schoolKey: 'narrative', schoolName: '叙事疗法', schoolTag: '问题外化者',
        response: '问题是问题，你是你。可以把' + emotion + '命名为一个角色。',
        action: { name: '问题外化', duration: 3, steps: ['给困扰起一个名字', '描述它最常出现的时机', '写一条应对策略'], tip: '你在观察问题时就夺回了主动权' } }
    ]
  },

  buildRadarData(scores) {
    if (!scores) return null
    const emotionOrder = ['快乐', '悲伤', '愤怒', '恐惧', '焦虑', '平静', '期待', '失望', '满足', '孤独', '亲密', '迷茫', '疲惫']
    const dimensions = []; const values = []
    emotionOrder.forEach(key => { if (scores.hasOwnProperty(key) && scores[key] > 0) { dimensions.push(key); values.push(scores[key] || 1) } })
    if (dimensions.length === 0) return null
    return { indicator: dimensions.map(d => ({ name: d, max: 100 })), series: [{ name: '情绪维度', type: 'radar', data: [{ value: values, name: '当前情绪' }] }] }
  },

  drawRadarChart() {
    if (!this.data.showRadar || !this.data.radarData) return
    const query = wx.createSelectorQuery()
    query.select('#radarCanvas').boundingClientRect()
    query.exec((res) => {
      if (!res || !res[0] || res[0].width === 0) {
        const retry = (this.data.radarRetryCount || 0) + 1
        if (retry <= 3) { this.setData({ radarRetryCount: retry }); setTimeout(() => this.drawRadarChart(), 300) }
        return
      }
      const ctx = wx.createCanvasContext('radarCanvas', this)
      if (ctx) { this.renderRadarChart(ctx, this.data.radarData, res[0].width, res[0].height); this.setData({ radarRetryCount: 0 }) }
    })
  },

  renderRadarChart(ctx, data, width, height) {
    const dimensions = data.indicator.length; const values = data.series[0].data[0].value
    const centerX = width / 2; const centerY = height / 2
    const radius = Math.min(width, height) * 0.32; const angleStep = (Math.PI * 2) / dimensions
    ctx.clearRect(0, 0, width, height)
    ;[0.2, 0.4, 0.6, 0.8, 1.0].forEach((level, idx) => {
      ctx.beginPath(); ctx.arc(centerX, centerY, radius * level, 0, 2 * Math.PI)
      ctx.setStrokeStyle(idx === 4 ? '#EADBC6' : '#FDF0E4'); ctx.setLineWidth(idx === 4 ? 2 : 1); ctx.stroke()
    })
    for (let i = 0; i < dimensions; i++) {
      const angle = i * angleStep - Math.PI / 2; const x = centerX + radius * Math.cos(angle); const y = centerY + radius * Math.sin(angle)
      ctx.beginPath(); ctx.moveTo(centerX, centerY); ctx.lineTo(x, y); ctx.setStrokeStyle('#EADBC6'); ctx.stroke()
      ctx.setFontSize(10); ctx.setFillStyle('#8B7E74')
      ctx.fillText(data.indicator[i].name, x + (x > centerX ? 5 : -25), y + (y > centerY ? -5 : 15))
    }
    ctx.beginPath()
    for (let i = 0; i <= dimensions; i++) {
      const angle = i * angleStep - Math.PI / 2; const value = (values[i % values.length] || 0) / 100
      const x = centerX + radius * value * Math.cos(angle); const y = centerY + radius * value * Math.sin(angle)
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.closePath(); ctx.setFillStyle('rgba(212, 181, 149, 0.35)'); ctx.fill(); ctx.setStrokeStyle('#C49A76'); ctx.setLineWidth(2); ctx.stroke()
    for (let i = 0; i < dimensions; i++) {
      const angle = i * angleStep - Math.PI / 2; const value = (values[i] || 0) / 100
      const x = centerX + radius * value * Math.cos(angle); const y = centerY + radius * value * Math.sin(angle)
      ctx.beginPath(); ctx.arc(x, y, 5, 0, 2 * Math.PI); ctx.setFillStyle('#fff'); ctx.fill(); ctx.setStrokeStyle('#C49A76'); ctx.setLineWidth(2); ctx.stroke()
      ctx.beginPath(); ctx.arc(x, y, 3, 0, 2 * Math.PI)
      ctx.setFillStyle(value >= 0.5 ? '#D4B595' : (value >= 0.3 ? '#C49A76' : '#EADBC6')); ctx.fill()
    }
    ctx.draw()
  },

  onSelectSchool(e) {
    const index = Number(e.currentTarget.dataset.index)
    const responses = this.data.actionData.schoolResponses || []
    const selected = responses[index]
    if (!selected) return
    this.setData({ 'actionData.selectedSchoolIndex': index, 'actionData.selectedAction': selected.action || null })
    wx.showToast({ title: '已选择' + selected.schoolName, icon: 'none' })
  },

  async onSave() {
    const { content, actionData, isSaving } = this.data
    if (!content.trim()) { wx.showToast({ title: '请先输入日记内容', icon: 'none' }); return }
    if (isSaving) return
    this.setData({ isSaving: true }); wx.showLoading({ title: '保存中...', mask: true })
    try {
      const result = await diaryUtils.saveDiary(content, '', actionData)
      wx.hideLoading(); this.setData({ isSaving: false })
      if (result) {
        wx.showToast({ title: '保存成功', icon: 'success' })
        // 第一次打卡显示浇水动画
        if (result.checkinStatus && result.checkinStatus.isFirstCheckInToday) {
          const treeEmojis = ['🌰', '🌱', '🪴', '🌲', '🌳']
          const idx = Math.min(4, Math.floor((result.checkinStatus.totalCheckins || 1) / 6))
          this.setData({
            showCheckinAnimation: true,
            checkinMessage: '💧 今天给情绪小树浇了水！\n已连续打卡 ' + result.checkinStatus.totalCheckins + ' 天\n小树现在是：' + treeEmojis[idx]
          })
          setTimeout(() => this.setData({ showCheckinAnimation: false }), 2500)
        }
        setTimeout(() => wx.navigateBack(), 1500)
      } else {
        wx.showToast({ title: '保存失败', icon: 'none' })
      }
    } catch (error) {
      wx.hideLoading(); this.setData({ isSaving: false }); wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  onClearContent() {
    if (!this.data.content.trim()) return
    wx.showModal({
      title: '确认清空', content: '确定要清空当前输入的内容吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            content: '',
            actionData: { emotions: {}, emotionsList: [], dominantEmotion: '', analyzedAt: '', schoolResponses: [], selectedSchoolIndex: 0, selectedAction: null },
            radarData: null, showRadar: false
          })
        }
      }
    })
  },

  goToSchoolsPage() { wx.navigateTo({ url: '/pages/schools/schools' }) }
})
