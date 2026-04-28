// index.js - 微光日记首页（输入→分析→流派选择→微行动→保存）
const diaryUtils = require('../../utils/diary.js')

Page({
  data: {
    userInput: '',
    isAnalyzing: false,
    isSaving: false,
    showResult: false,
    currentTab: 'home',
    learnProgress: 0,
    greeting: '晚上好',
    schoolResponses: [],
    selectedSchool: '',
    selectedAction: null,
    emotionScores: {},
    emotionsList: [],
    radarData: null,
    showCheckinAnimation: false,
    checkinMessage: ''
  },

  onLoad() {
    this.setGreeting()
    this.loadLearnProgress()
    this.resetPageState()
  },

  onShow() {
    this.loadLearnProgress()
  },

  resetPageState() {
    this.setData({
      userInput: '',
      isAnalyzing: false,
      isSaving: false,
      showResult: false,
      schoolResponses: [],
      selectedSchool: '',
      selectedAction: null,
      emotionScores: {},
      emotionsList: [],
      radarData: null,
      showCheckinAnimation: false,
      checkinMessage: ''
    })
  },

  setGreeting() {
    const hour = new Date().getHours()
    let greeting = '你好'
    if (hour >= 5 && hour < 12) greeting = '早上好'
    else if (hour >= 12 && hour < 14) greeting = '中午好'
    else if (hour >= 14 && hour < 18) greeting = '下午好'
    else if (hour >= 18 && hour < 22) greeting = '晚上好'
    else greeting = '夜深了'
    this.setData({ greeting })
  },

  loadLearnProgress() {
    const progress = wx.getStorageSync('learnProgress') || {}
    const totalSchools = 4
    let completed = 0
    const schools = ['cbt', 'act', 'humanistic', 'narrative']
    schools.forEach(s => { if (progress[s]) completed++ })
    const percent = Math.round((completed / totalSchools) * 100)
    this.setData({ learnProgress: percent })
  },

  onInput(e) {
    this.setData({ userInput: e.detail.value })
  },

  async onAnalyze() {
    const { userInput } = this.data
    if (!userInput.trim() || this.data.isAnalyzing) return

    this.setData({ isAnalyzing: true })
    wx.showLoading({ title: '分析中...', mask: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'analyzeDiary',
        data: { content: userInput },
        timeout: 20000
      })

      wx.hideLoading()

      if (!res.result || !res.result.success) {
        throw new Error(res.result?.error || '分析失败')
      }

      const data = res.result.data
      const scores = data.scores || data.emotions || {}

      const emotionsList = Object.entries(scores).map(([name, score]) => ({
        name,
        score: Math.round(score)
      }))

      const radarData = this.buildRadarData(scores)

      this.setData({
        isAnalyzing: false,
        showResult: true,
        emotionScores: scores,
        emotionsList,
        schoolResponses: data.schoolResponses || this.buildDefaultSchoolResponses(data.dominantEmotion),
        selectedSchool: '',
        selectedAction: null,
        radarData
      }, () => {
        if (radarData) {
          setTimeout(() => this.drawRadarChart(), 300)
        }
      })

    } catch (error) {
      wx.hideLoading()
      this.setData({ isAnalyzing: false })
      wx.showToast({ title: '云端分析失败，使用本地方案', icon: 'none' })

      const fallbackResult = this.getFallbackResult(this.data.userInput)
      this.setData({
        showResult: true,
        emotionScores: fallbackResult.scores,
        emotionsList: fallbackResult.emotionsList,
        schoolResponses: fallbackResult.schoolResponses,
        selectedSchool: '',
        selectedAction: null,
        radarData: this.buildRadarData(fallbackResult.scores)
      }, () => {
        setTimeout(() => this.drawRadarChart(), 300)
      })
    }
  },

  onSelectSchool(e) {
    const key = e.currentTarget.dataset.key
    const responses = this.data.schoolResponses
    const selected = responses.find(r => r.schoolKey === key)

    if (!selected) return

    this.setData({
      selectedSchool: key,
      selectedAction: selected.action || null
    })

    wx.showToast({ title: '已选择：' + selected.schoolName, icon: 'none', duration: 1500 })
  },

  buildRadarData(scores) {
    const emotionOrder = ['快乐', '悲伤', '愤怒', '恐惧', '焦虑', '平静', '期待', '失望', '满足', '孤独', '亲密', '迷茫', '疲惫']
    const data = []
    emotionOrder.forEach(key => {
      if (scores.hasOwnProperty(key)) {
        data.push({
          label: key,
          value: Math.max(1, scores[key])
        })
      }
    })
    return data.length > 0 ? data : null
  },

  buildDefaultSchoolResponses(dominantEmotion) {
    const emotion = dominantEmotion || '平静'
    return [
      {
        schoolKey: 'cbt',
        schoolName: '认知行为疗法',
        schoolTag: '思维纠偏',
        response: '你现在的情绪偏向' + emotion + '。我们可以一起看看，有哪些想法在影响你的感受？',
        action: { name: '思维记录', duration: 5, steps: ['写下此刻最困扰你的想法', '列出支持和反驳它的证据', '写一个更平衡的替代想法'], tip: '看见思维，情绪就会松动' }
      },
      {
        schoolKey: 'act',
        schoolName: '接纳承诺疗法',
        schoolTag: '接纳与行动',
        response: emotion + '是一种正常的情绪。请先允许它存在，然后问问自己：此刻什么最重要？',
        action: { name: '价值澄清', duration: 5, steps: ['深呼吸三次，把注意力带回当下', '问自己：此刻我可以选择做什么？', '选择一个最小的一步行动'], tip: '接纳是改变的开始' }
      },
      {
        schoolKey: 'humanistic',
        schoolName: '人本主义',
        schoolTag: '优势发现',
        response: '感谢你愿意分享自己的感受。你值得被理解和支持。',
        action: { name: '自我肯定', duration: 4, steps: ['对自己说：我现在感受到的是正常的', '写一句对自己的鼓励话', '想象好朋友会对你说什么'], tip: '先肯定自己' }
      },
      {
        schoolKey: 'narrative',
        schoolName: '叙事疗法',
        schoolTag: '问题外化',
        response: '问题是问题，你是你。可以把' + emotion + '命名为一个角色，观察它何时出现、何时变弱。',
        action: { name: '问题外化', duration: 5, steps: ['给当前困扰起一个有趣的名字', '描述它最常出现的场景', '写下一句话作为你的成功宣言'], tip: '你不是问题本身' }
      }
    ]
  },

  getFallbackResult(content) {
    const keywords = {
      '快乐': ['开心', '高兴', '快乐', '幸福'],
      '悲伤': ['难过', '伤心', '悲伤', '痛苦'],
      '焦虑': ['焦虑', '担心', '紧张', '不安'],
      '平静': ['平静', '放松'],
      '孤独': ['孤独', '寂寞', '孤单'],
      '疲惫': ['累', '困', '疲惫']
    }
    const scores = {
      '快乐': 0, '悲伤': 0, '愤怒': 0, '恐惧': 0,
      '焦虑': 0, '平静': 50, '期待': 0, '失望': 0,
      '满足': 0, '孤独': 0, '亲密': 0, '迷茫': 0, '疲惫': 0
    }
    const lowerContent = content.toLowerCase()
    Object.entries(keywords).forEach(([emotion, words]) => {
      words.forEach(w => {
        if (lowerContent.includes(w)) scores[emotion] = Math.min(100, scores[emotion] + 30)
      })
    })
    const emotionsList = Object.entries(scores).map(([name, score]) => ({ name, score }))
    return { scores, emotionsList, schoolResponses: this.buildDefaultSchoolResponses('平静') }
  },

  drawRadarChart() {
    const data = this.data.radarData
    if (!data || data.length === 0) return

    const ctx = wx.createCanvasContext('radarCanvas')
    const width = 320
    const height = 350
    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(width, height) / 2 - 40
    const count = data.length
    const angleStep = (Math.PI * 2) / count

    ctx.setStrokeStyle('#EADBC6')
    ctx.setLineWidth(1)
    for (let level = 1; level <= 5; level++) {
      const r = (radius * level) / 5
      ctx.beginPath()
      for (let i = 0; i <= count; i++) {
        const angle = angleStep * i - Math.PI / 2
        const x = centerX + r * Math.cos(angle)
        const y = centerY + r * Math.sin(angle)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.stroke()
    }

    ctx.beginPath()
    ctx.setFillStyle('rgba(212, 181, 149, 0.35)')
    ctx.setStrokeStyle('#C49A76')
    ctx.setLineWidth(2)
    data.forEach((item, i) => {
      const angle = angleStep * i - Math.PI / 2
      const value = Math.max(1, Math.min(100, item.value)) / 100
      const x = centerX + radius * value * Math.cos(angle)
      const y = centerY + radius * value * Math.sin(angle)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    data.forEach((item, i) => {
      const angle = angleStep * i - Math.PI / 2
      const value = Math.max(1, Math.min(100, item.value)) / 100
      const x = centerX + radius * value * Math.cos(angle)
      const y = centerY + radius * value * Math.sin(angle)

      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.setFillStyle('#C49A76')
      ctx.fill()

      const labelX = centerX + (radius + 20) * Math.cos(angle)
      const labelY = centerY + (radius + 20) * Math.sin(angle)
      ctx.setFontSize(11)
      ctx.setFillStyle('#5C4F42')
      ctx.setTextAlign('center')
      ctx.setTextBaseline('middle')
      ctx.fillText(item.label, labelX, labelY)
    })

    ctx.draw()
  },

  onSave() {
    if (this.data.isSaving) return
    this.setData({ isSaving: true })

    // 构建统一 actionData（与 diary.js 格式一致，供周报/历史读取）
    const actionData = {
      emotions: this.data.emotionScores,
      emotionsList: this.data.emotionsList,
      dominantEmotion: this.getDominantEmotion(),
      analyzedAt: new Date().toLocaleString(),
      schoolResponses: this.data.schoolResponses,
      selectedSchoolIndex: 0,
      selectedAction: this.data.selectedAction
    }

    diaryUtils.saveDiary(this.data.userInput, '', actionData)
      .then(result => {
        this.setData({ isSaving: false })
        if (result && result.success) {
          wx.showToast({ title: '保存成功', icon: 'success' })
          // 首次打卡 → 浇水动画
          if (result.checkinStatus && result.checkinStatus.isFirstCheckInToday) {
            const treeEmojis = ['🌰', '🌱', '🪴', '🌲', '🌳']
            const idx = Math.min(4, Math.floor((result.checkinStatus.totalCheckins || 1) / 6))
            this.setData({
              showCheckinAnimation: true,
              checkinMessage: '💧 今天给情绪小树浇了水！\n已连续打卡 ' + result.checkinStatus.totalCheckins + ' 天\n小树现在是：' + treeEmojis[idx]
            })
            setTimeout(() => this.setData({ showCheckinAnimation: false }), 2500)
          }
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' })
        }
      })
      .catch(() => {
        this.setData({ isSaving: false })
        wx.showToast({ title: '保存失败', icon: 'none' })
      })
  },

  getDominantEmotion() {
    const scores = this.data.emotionScores
    let maxScore = 0
    let dominant = '平静'
    Object.entries(scores).forEach(([name, score]) => {
      if (score > maxScore) {
        maxScore = score
        dominant = name
      }
    })
    return dominant
  },

  onReset() {
    this.setData({
      userInput: '',
      showResult: false,
      schoolResponses: [],
      selectedSchool: '',
      selectedAction: null,
      emotionScores: {},
      emotionsList: [],
      radarData: null
    })
  },

  goToHome() { this.setData({ currentTab: 'home' }) },
  goToLearn() { wx.navigateTo({ url: '/pages/schools/schools' }) },
  goToHistory() { wx.navigateTo({ url: '/pages/list/list' }) },
  goToProfile() { wx.navigateTo({ url: '/pages/profile/profile' }) }
})
