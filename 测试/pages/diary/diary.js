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

      console.log('📤 开始调用云函数 analyzeDiary，输入内容:', content.slice(0, 50) + '...')
      
      const res = await wx.cloud.callFunction({
        name: 'analyzeDiary',
        data: { content },
        timeout: 20000  // 20秒超时
      })

      console.log('📥 云函数返回完整结果:', JSON.stringify(res))

      if (!res.result || !res.result.success) {
        throw new Error(res.result?.error || '分析失败')
      }

      const data = res.result.data || {}
      
      // 检查是否使用了兜底方案
      if (res.result.usingFallback) {
        console.warn('⚠️ 使用了本地兜底方案，原因:', res.result.fallbackReason)
        wx.showToast({ 
          title: 'AI未接入，使用默认回应', 
          icon: 'none',
          duration: 3000
        })
      } else {
        console.log('✅ AI分析成功，dominantEmotion:', data.dominantEmotion)
      }

      const scores = data.scores || data.emotions || data.emotionScores || {}
      const emotionsList = Object.keys(scores)
        .map(name => ({ name, score: scores[name] }))
        .sort((a, b) => b.score - a.score)

      console.log('📊 情绪分数:', emotionsList)
      console.log('💬 流派回应数量:', data.schoolResponses?.length || 0)

      const schoolResponses = this.buildSchoolResponses(data, content)
      const selectedSchoolIndex = schoolResponses.length > 0 ? 0 : null
      const selectedAction = selectedSchoolIndex !== null ? schoolResponses[0].action : null

      console.log('🔍 selectedSchoolIndex:', selectedSchoolIndex)
      console.log('🔍 selectedAction:', selectedAction)

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
    if (!scores) {
      console.log('⚠️ buildRadarData: scores为空')
      return null
    }
    
    // 只选择有分数的情绪维度（过滤掉0值的）
    const emotionOrder = ['快乐', '悲伤', '愤怒', '恐惧', '焦虑', '平静', '期待', '失望', '满足', '孤独', '亲密', '迷茫', '疲惫']
    const dimensions = []
    const values = []
    
    emotionOrder.forEach(key => {
      if (scores.hasOwnProperty(key)) {
        dimensions.push(key)
        // 确保值不会太小，如果是0给一个很小的基数让图形不会退化
        values.push(scores[key] || 1)  // 0改为1，避免图形退化
      }
    })
    
    console.log('📊 buildRadarData dimensions:', dimensions)
    console.log('📊 buildRadarData values:', values)
    
    if (dimensions.length === 0) return null
    
    // 检查是否所有值都一样（会导致图形退化）
    const allSame = values.every(v => v === values[0])
    if (allSame && values[0] <= 1) {
      console.log('⚠️ 所有情绪值相同且接近0，使用默认值')
      values[0] = 30  // 至少显示一些变化
    }
    
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
      console.log('跳过雷达图绘制: showRadar=', this.data.showRadar, 'radarData=', !!this.data.radarData)
      return
    }
    
    try {
      const canvasQuery = wx.createSelectorQuery()
      canvasQuery.select('#radarCanvas').boundingClientRect()
      canvasQuery.exec((rectRes) => {
        try {
          const rect = rectRes && rectRes[0]
          if (!rect || !rect.width || !rect.height) {
            const retry = (this.data.radarRetryCount || 0) + 1
            if (retry <= 3) {
              console.log(`雷达图重试 ${retry}/3`)
              this.setData({ radarRetryCount: retry })
              setTimeout(() => this.drawRadarChart(), 300)
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
            console.error('雷达图数据无效', radarData)
            return
          }

          this.renderRadarChart(ctx, radarData, rect.width, rect.height)
          this.setData({ radarRetryCount: 0 })
        } catch (execError) {
          console.error('雷达图绘制执行错误:', execError)
        }
      })
    } catch (err) {
      console.error('雷达图绘制错误:', err)
    }
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

  // 渲染雷达图 - 美化版
  renderRadarChart: function(ctx, data, width, height) {
    try {
      const dimensions = data.indicator.length
      const values = data.series[0].data[0].value
      
      if (!values || values.length === 0) {
        console.error('雷达图数据为空')
        return
      }
      
      const centerX = width / 2
      const centerY = height / 2
      const radius = Math.min(width, height) * 0.32
      const angleStep = (Math.PI * 2) / dimensions
      
      // 清空画布
      ctx.clearRect(0, 0, width, height)
      
      // 绘制背景圆（最外层）
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
      ctx.setFillStyle('#f8f9ff')
      ctx.fill()
      
      // 绘制背景网格（5层同心圆）
      const levels = [0.2, 0.4, 0.6, 0.8, 1.0]
      levels.forEach((level, idx) => {
        ctx.beginPath()
        ctx.arc(centerX, centerY, radius * level, 0, 2 * Math.PI)
        if (idx === 4) {
          ctx.setStrokeStyle('#c5cae9')
          ctx.setLineWidth(2)
        } else {
          ctx.setStrokeStyle('#e8eaf6')
          ctx.setLineWidth(1)
        }
        ctx.stroke()
      })
      
      // 绘制轴线和标签
      for (let i = 0; i < dimensions; i++) {
        const angle = i * angleStep - Math.PI / 2
        const x = centerX + radius * Math.cos(angle)
        const y = centerY + radius * Math.sin(angle)
        
        // 轴线
        ctx.beginPath()
        ctx.moveTo(centerX, centerY)
        ctx.lineTo(x, y)
        ctx.setStrokeStyle('#c5cae9')
        ctx.setLineWidth(1)
        ctx.stroke()
        
        // 标签背景
        const labelText = data.indicator[i].name
        ctx.setFontSize(10)
        const textWidth = ctx.measureText ? ctx.measureText(labelText).width : 40
        
        // 根据位置调整标签位置
        let labelX, labelY
        const angleDeg = (angle * 180 / Math.PI)
        if (angleDeg >= -45 && angleDeg < 45) {
          // 右侧
          labelX = x + 8
          labelY = y + 4
        } else if (angleDeg >= 45 && angleDeg < 135) {
          // 下方
          labelX = x - textWidth / 2
          labelY = y + 16
        } else if (angleDeg >= -135 && angleDeg < -45) {
          // 上方
          labelX = x - textWidth / 2
          labelY = y - 6
        } else {
          // 左侧
          labelX = x - textWidth - 8
          labelY = y + 4
        }
        
        // 绘制标签
        ctx.setFillStyle('#5c6bc0')
        ctx.fillText(labelText, labelX, labelY)
      }
      
      // 绘制数据区域（渐变填充）
      // 先绘制半透明填充
      ctx.beginPath()
      for (let i = 0; i <= dimensions; i++) {
        const angle = i * angleStep - Math.PI / 2
        const value = (values[i % values.length] || 0) / 100
        const pointRadius = Math.max(value * radius, 8)  // 最小8像素
        const x = centerX + pointRadius * Math.cos(angle)
        const y = centerY + pointRadius * Math.sin(angle)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      
      // 渐变填充
      const gradient = ctx.createLinearGradient(centerX - radius, centerY - radius, centerX + radius, centerY + radius)
      gradient.addColorStop(0, 'rgba(92, 107, 192, 0.4)')
      gradient.addColorStop(1, 'rgba(63, 81, 181, 0.25)')
      ctx.setFillStyle(gradient)
      ctx.fill()
      
      // 边框
      ctx.beginPath()
      for (let i = 0; i <= dimensions; i++) {
        const angle = i * angleStep - Math.PI / 2
        const value = (values[i % values.length] || 0) / 100
        const pointRadius = Math.max(value * radius, 8)
        const x = centerX + pointRadius * Math.cos(angle)
        const y = centerY + pointRadius * Math.sin(angle)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.setStrokeStyle('#3f51b5')
      ctx.setLineWidth(2.5)
      ctx.stroke()
      
      // 绘制数据点
      for (let i = 0; i < dimensions; i++) {
        const angle = i * angleStep - Math.PI / 2
        const value = (values[i] || 0) / 100
        const pointRadius = Math.max(value * radius, 8)
        const x = centerX + pointRadius * Math.cos(angle)
        const y = centerY + pointRadius * Math.sin(angle)
        
        // 外圈
        ctx.beginPath()
        ctx.arc(x, y, 6, 0, 2 * Math.PI)
        ctx.setFillStyle('#fff')
        ctx.fill()
        ctx.setStrokeStyle('#3f51b5')
        ctx.setLineWidth(2)
        ctx.stroke()
        
        // 内圈（根据情绪强度变色）
        ctx.beginPath()
        ctx.arc(x, y, 3, 0, 2 * Math.PI)
        if (value >= 50) {
          ctx.setFillStyle('#f44336')  // 红色-强
        } else if (value >= 30) {
          ctx.setFillStyle('#ff9800')  // 橙色-中
        } else {
          ctx.setFillStyle('#4caf50')  // 绿色-弱
        }
        ctx.fill()
      }
      
      // 执行绘制
      ctx.draw(false, () => {
        console.log('雷达图绘制完成')
      })
    } catch (e) {
      console.error('渲染雷达图异常:', e)
    }
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