// pages/diary/diary.js
const diaryUtils = require('../../utils/diary.js')

const CORE_SCHOOLS = [
  {
    key: 'cbt',
    name: '认知行为疗法（CBT）',
    focus: '识别自动化负向想法，练习更平衡的解释',
    scene: '适合反复焦虑、反刍、想法很绝对的时候'
  },
  {
    key: 'act',
    name: '接纳承诺疗法（ACT）',
    focus: '接纳情绪存在，把注意力带回有价值的行动',
    scene: '适合情绪很强烈但仍希望继续向前的时候'
  },
  {
    key: 'humanistic',
    name: '人本主义',
    focus: '无条件积极关注，尊重与接纳当下的你',
    scene: '适合需要被理解、被看见和自我支持的时候'
  },
  {
    key: 'narrative',
    name: '叙事疗法',
    focus: '把问题外化，重写“我和问题”的关系',
    scene: '适合陷入自责标签、希望换个视角讲述自己时'
  }
]

Page({
  data: {
    coreSchools: CORE_SCHOOLS,
    content: '',
    isAnalyzing: false,
    isSaving: false,
    showRadar: false,
    radarData: null,
    actionData: {
      emotions: {},
      emotionsList: [],
      dominantEmotion: '',
      analyzedAt: '',
      schoolResponses: [],
      selectedSchoolIndex: null,
      selectedAction: null
    },
    showCheckinAnimation: false,
    checkinMessage: '',
    radarRetryCount: 0
  },

  onInputContent(e) {
    this.setData({ content: e.detail.value })
  },

  goToSchoolsPage() {
    wx.navigateTo({
      url: '/pages/schools/schools'
    })
  },

  onAnalyze() {
    const { content, isAnalyzing } = this.data
    if (!content.trim()) {
      wx.showToast({ title: '请输入日记内容', icon: 'none' })
      return
    }
    if (isAnalyzing) return

    this.setData({ isAnalyzing: true })
    wx.showLoading({ title: '分析中...', mask: true })
    this.analyzeContent(content)
  },

  async analyzeContent(content) {
    try {
      if (!wx.cloud) {
        this.setData({ isAnalyzing: false })
        wx.hideLoading()
        wx.showToast({ title: '请先初始化云开发', icon: 'none' })
        return
      }

      const res = await wx.cloud.callFunction({
        name: 'analyzeDiary',
        data: { content }
      })

      if (!res.result || !res.result.success) {
        throw new Error(res.result?.error || '分析失败')
      }

      const data = res.result.data || {}
      const scores = data.scores || data.emotions || data.emotionScores || {}
      const emotionsList = Object.keys(scores)
        .map(name => ({ name, score: scores[name] }))
        .sort((a, b) => b.score - a.score)

      const schoolResponses = this.buildSchoolResponses(data, content)
      const selectedSchoolIndex = schoolResponses.length > 0 ? 0 : null
      const selectedAction = selectedSchoolIndex !== null ? schoolResponses[0].action : null

      this.setData({
        actionData: {
          emotions: scores,
          emotionsList,
          dominantEmotion: data.dominantEmotion || '平静',
          analyzedAt: new Date().toLocaleString(),
          schoolResponses,
          selectedSchoolIndex,
          selectedAction
        },
        radarData: this.buildRadarData(scores),
        showRadar: emotionsList.length > 0,
        radarRetryCount: 0
      }, () => {
        if (this.data.showRadar && this.data.actionData.schoolResponses.length > 0) {
          setTimeout(() => this.drawRadarChart(), 300)
        }
      })

      wx.hideLoading()
      this.setData({ isAnalyzing: false })
      wx.showToast({ title: '分析完成', icon: 'success' })
    } catch (error) {
      console.error('分析失败:', error)
      wx.hideLoading()
      this.setData({ isAnalyzing: false })
      wx.showToast({ title: '分析失败，请重试', icon: 'none' })
    }
  },

  // 构建雷达图数据
  buildRadarData(scores) {
    if (!scores) return null
    
    const dimensions = []
    const values = []
    for (let key in scores) {
      if (scores.hasOwnProperty(key)) {
        dimensions.push(key)
        values.push(scores[key])
      }
    }
    
    if (dimensions.length === 0) return null
    
    return {
      indicator: dimensions.map(dim => ({ name: dim, max: 100 })),
      series: [{
        name: '情绪维度',
        type: 'radar',
        data: [{ value: values, name: '当前情绪' }]
      }]
    }
  },

  // 绘制雷达图
  drawRadarChart: function() {
    if (!this.data.showRadar || !this.data.radarData) {
      return
    }
    
    const canvasQuery = wx.createSelectorQuery()
    canvasQuery.select('#radarCanvas').boundingClientRect()
    canvasQuery.exec((rectRes) => {
      const rect = rectRes && rectRes[0]
      if (!rect || !rect.width || !rect.height) {
        const retry = (this.data.radarRetryCount || 0) + 1
        if (retry <= 3) {
          this.setData({ radarRetryCount: retry })
          setTimeout(() => this.drawRadarChart(), 220)
        } else {
          console.warn('雷达图容器未就绪，停止重试')
        }
        return
      }

      const ctx = wx.createCanvasContext('radarCanvas', this)
      if (!ctx) {
        console.error('获取 canvas 上下文失败')
        return
      }

      const { radarData } = this.data
      if (!radarData || !radarData.indicator || radarData.indicator.length === 0) {
        console.error('雷达图数据无效')
        return
      }

      this.renderRadarChart(ctx, radarData, rect.width, rect.height)
      this.setData({ radarRetryCount: 0 })
    })
  },

  buildSchoolResponses(data, content) {
    if (Array.isArray(data.schoolResponses) && data.schoolResponses.length > 0) {
      return data.schoolResponses
    }

    if (data.counseling && data.counseling.counselingResponse) {
      const main = {
        schoolKey: 'cbt',
        schoolName: data.counseling.counselingType || '认知行为疗法（CBT）',
        schoolTag: data.counseling.counselingDesc || '思维纠偏镜',
        response: data.counseling.counselingResponse,
        action: data.counseling.action || {
          name: '三栏笔记法速写',
          duration: 4,
          steps: [
            '第一栏写情况：发生了什么',
            '第二栏写自动思维：我脑海里第一反应是什么',
            '第三栏写理性回应：更平衡、可执行的一句话'
          ],
          tip: '目标不是自我否定，而是更准确地看待自己'
        }
      }
      return [main].concat(this.buildLocalSchoolResponses(content).slice(1))
    }

    return this.buildLocalSchoolResponses(content)
  },

  buildLocalSchoolResponses(content) {
    const shortText = (content || '').slice(0, 36)
    return [
      {
        schoolKey: 'cbt',
        schoolName: '认知行为疗法（CBT）',
        schoolTag: '思维纠偏镜',
        response: `我注意到你在“${shortText}”里可能把一次挫折放大成了对自己的整体否定。我们可以做一次证据检验：有没有反例说明你并不是“彻底不行”？`,
        action: {
          name: '三栏笔记法速写',
          duration: 4,
          steps: [
            '画三栏：情况、自动思维、理性回应',
            '把当下最刺痛的一句话写在自动思维栏',
            '写一句更平衡、可执行的理性回应'
          ],
          tip: '理性回应要具体，最好能直接指导下一步行动'
        }
      },
      {
        schoolKey: 'act',
        schoolName: '接纳承诺疗法（ACT）',
        schoolTag: '情绪容纳器',
        response: '先不急着把情绪赶走。请允许这份沉重暂时在你身边坐一会儿，然后把注意力慢慢带回你真正在意的事情。情绪在场，你也仍然可以行动。',
        action: {
          name: '给情绪泡杯茶',
          duration: 5,
          steps: [
            '接一杯温水并双手握住',
            '默念：我正在体验一阵强烈情绪，但它不等于我',
            '喝一口水后，做一个1分钟的小行动'
          ],
          tip: '接纳不是放弃，而是停止内耗后继续向前'
        }
      },
      {
        schoolKey: 'humanistic',
        schoolName: '人本主义',
        schoolTag: '优势探测器',
        response: '你在不舒服时还愿意记录和反思，这本身就说明你在认真对待生活。请先承认自己的努力，再去看还能怎样照顾自己，而不是只盯着做错的部分。',
        action: {
          name: '反向感恩',
          duration: 4,
          steps: [
            '写一句：感谢这次不顺，它提醒了我____',
            '补一句：我身上仍在发挥作用的优点是____',
            '给自己一句鼓励并读出来'
          ],
          tip: '先看见自己的价值，行动会更稳定'
        }
      },
      {
        schoolKey: 'narrative',
        schoolName: '叙事疗法',
        schoolTag: '问题外化者',
        response: '问题是问题，你是你。可以把这次困扰命名成“挑刺怪”或“自我怀疑怪”，然后观察它何时最吵、何时变弱，这样你就不再被它完全定义。',
        action: {
          name: '画一张通缉令',
          duration: 3,
          steps: [
            '把困扰画成一个角色并命名',
            '写下它最常出现的时机和套路',
            '写一条你的反制策略并大声读一次'
          ],
          tip: '你在观察问题时，就已经在夺回主动权'
        }
      }
    ]
  },

  // 渲染雷达图
  renderRadarChart: function(ctx, data, width, height) {
    const dimensions = data.indicator.length
    const values = data.series[0].data[0].value
    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(width, height) * 0.35
    const angleStep = (Math.PI * 2) / dimensions
    
    // 清空画布
    ctx.clearRect(0, 0, width, height)
    
    // 绘制背景网格（5层）
    const levels = [0.2, 0.4, 0.6, 0.8, 1.0]
    levels.forEach(level => {
      ctx.beginPath()
      for (let i = 0; i <= dimensions; i++) {
        const angle = i * angleStep - Math.PI / 2
        const x = centerX + radius * level * Math.cos(angle)
        const y = centerY + radius * level * Math.sin(angle)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.setStrokeStyle('#ddd')
      ctx.stroke()
    })
    
    // 绘制轴线
    for (let i = 0; i < dimensions; i++) {
      const angle = i * angleStep - Math.PI / 2
      const x = centerX + radius * Math.cos(angle)
      const y = centerY + radius * Math.sin(angle)
      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.lineTo(x, y)
      ctx.setStrokeStyle('#ddd')
      ctx.stroke()
      
      // 添加标签
      ctx.setFontSize(12)
      ctx.setFillStyle('#666')
      const labelX = x + (x > centerX ? 8 : -8)
      const labelY = y + (y > centerY ? -8 : 8)
      ctx.fillText(data.indicator[i].name, labelX, labelY)
    }
    
    // 绘制数据区域
    ctx.beginPath()
    for (let i = 0; i <= dimensions; i++) {
      const angle = i * angleStep - Math.PI / 2
      const value = (values[i % values.length] || 0) / 100
      const x = centerX + radius * value * Math.cos(angle)
      const y = centerY + radius * value * Math.sin(angle)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.setFillStyle('rgba(102, 126, 234, 0.3)')
    ctx.fill()
    ctx.setStrokeStyle('#667eea')
    ctx.setLineWidth(2)
    ctx.stroke()
    
    // 绘制数据点
    for (let i = 0; i < dimensions; i++) {
      const angle = i * angleStep - Math.PI / 2
      const value = (values[i] || 0) / 100
      const x = centerX + radius * value * Math.cos(angle)
      const y = centerY + radius * value * Math.sin(angle)
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, 2 * Math.PI)
      ctx.setFillStyle('#667eea')
      ctx.fill()
    }
    
    // 执行绘制
    ctx.draw(true)
    console.log('雷达图绘制完成')
  },

  onSelectSchool(e) {
    const index = Number(e.currentTarget.dataset.index)
    const schoolResponses = this.data.actionData.schoolResponses || []
    const selected = schoolResponses[index]
    if (!selected) return
    this.setData({
      'actionData.selectedSchoolIndex': index,
      'actionData.selectedAction': selected.action || null
    })
    wx.showToast({ title: `已选择${selected.schoolName}`, icon: 'none' })
  },

  showSaveSuccessDialog(result) {
    const checkinStatus = result?.checkinStatus || {}
    const content = checkinStatus.isFirstCheckInToday
      ? `今日打卡成功，已累计浇水 ${checkinStatus.totalCheckins} 次。\n\n你现在可以查看这篇日记和AI反馈，或继续记录。`
      : '这篇日记已保存。\n\n你现在可以查看这篇日记和AI反馈，或继续记录。'

    wx.showModal({
      title: result.cloudSynced ? '保存成功（已云同步）' : '保存成功（仅本地）',
      content,
      confirmText: '查看我的日记',
      cancelText: '继续记录',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({
            url: '/pages/list/list'
          })
          return
        }
        this.setData({
          content: '',
          actionData: {
            emotions: {},
            emotionsList: [],
            dominantEmotion: '',
            analyzedAt: '',
            schoolResponses: [],
            selectedSchoolIndex: null,
            selectedAction: null
          },
          radarData: null,
          showRadar: false,
          radarRetryCount: 0
        })
      }
    })
  },

  async onSave() {
    const { content, actionData, isSaving } = this.data
    if (!content.trim()) {
      wx.showToast({ title: '请先输入日记内容', icon: 'none' })
      return
    }
    if (isSaving) return

    this.setData({ isSaving: true })
    wx.showLoading({ title: '保存中...', mask: true })

    try {
      const result = await diaryUtils.saveDiary(content, '', actionData)
      wx.hideLoading()
      this.setData({ isSaving: false })

      if (!result || !result.success) {
        wx.showToast({ title: '保存失败', icon: 'none' })
        return
      }

      const checkinStatus = result.checkinStatus || {}
      if (checkinStatus.isFirstCheckInToday) {
        this.setData({
          showCheckinAnimation: true,
          checkinMessage: `今日打卡成功，已浇水 ${checkinStatus.totalCheckins} 次，继续坚持！`
        })
        setTimeout(() => {
          this.setData({ showCheckinAnimation: false })
        }, 2000)
      }
      this.showSaveSuccessDialog(result)
    } catch (error) {
      wx.hideLoading()
      this.setData({ isSaving: false })
      wx.showToast({ title: '保存失败', icon: 'none' })
      console.error('保存失败:', error)
    }
  },

  onClearContent() {
    const { content } = this.data
    
    if (content.trim()) {
      wx.showModal({
        title: '确认清空',
        content: '确定要清空当前输入的内容吗？',
        success: (res) => {
          if (res.confirm) {
            this.setData({
              content: '',
              actionData: {
                emotions: {},
                emotionsList: [],
                dominantEmotion: '',
                analyzedAt: '',
                schoolResponses: [],
                selectedSchoolIndex: null,
                selectedAction: null
              },
              radarData: null,
              showRadar: false
            })
          }
        }
      })
    }
  }
})