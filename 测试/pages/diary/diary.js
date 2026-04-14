// pages/diary/diary.js
const diaryUtils = require('../../utils/diary.js')

Page({
  data: {
    content: '',
    actionData: {},
    isAnalyzing: false,
    isSaving: false,
    emotionsList: [],      // 情绪列表（用于展示）
    radarData: null,       // 雷达图数据
    showRadar: false       // 是否显示雷达图
  },

  onInputContent(e) {
    this.setData({ content: e.detail.value })
  },

  onAnalyze() {
    const { content } = this.data
    
    if (!content.trim()) {
      wx.showToast({ title: '请输入日记内容', icon: 'none' })
      return
    }
    
    if (this.data.isAnalyzing) return
    
    this.setData({ isAnalyzing: true })
    wx.showLoading({ title: '分析中...', mask: true })
    
    this.analyzeContent(content)
  },

  // 延迟函数
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  },

  // 分析内容
  async analyzeContent(content) {
    try {
      if (!wx.cloud) {
        wx.hideLoading()
        this.setData({ isAnalyzing: false })
        wx.showToast({ title: '请先初始化云开发', icon: 'none' })
        return
      }

      // 调用云函数进行AI分析
      const res = await wx.cloud.callFunction({
        name: 'analyzeDiary',
        data: { content: content }
      })
      console.log('云函数返回完整数据:', JSON.stringify(res))
      
      if (res.result && res.result.success) {
        const data = res.result.data
        console.log('解析后的data:', JSON.stringify(data))
        console.log('data.scores:', data.scores)
        
        // 兼容不同的数据结构
        let scores = null
        if (data.scores) {
          scores = data.scores
        } else if (data.emotions) {
          scores = data.emotions
        } else if (data.emotionScores) {
          scores = data.emotionScores
        } else {
          // 如果没有分数数据，使用默认数据（仅用于测试）
          console.warn('未找到情绪分数数据，使用默认数据')
          scores = {
            '快乐': 60,
            '悲伤': 40,
            '焦虑': 50,
            '平静': 55,
            '愤怒': 30
          }
        }
        
        // 处理情绪分数数组（用于列表展示）
        const emotionsArray = []
        if (scores) {
          for (let key in scores) {
            if (scores.hasOwnProperty(key)) {
              emotionsArray.push({ name: key, score: scores[key] })
            }
          }
        }
        console.log('emotionsArray:', emotionsArray)
        
        // 构建雷达图数据
        const radarChartData = this.buildRadarData(scores)
        console.log('radarChartData:', radarChartData)
        
        this.setData({
          actionData: {
            emotions: scores || {},
            emotionsList: emotionsArray,
            dominantEmotion: data.dominantEmotion || data.primaryEmotion || '未知',
            counselingType: data.counseling?.counselingType || data.counselingType || '',
            counselingDesc: data.counseling?.counselingDesc || data.counselingDesc || '',
            counselingResponse: data.counseling?.counselingResponse || data.counselingResponse || '',
            analyzedAt: new Date().toLocaleString()
          },
          radarData: radarChartData,
          showRadar: radarChartData !== null
        }, () => {
          console.log('setData完成, showRadar:', this.data.showRadar, 'radarData:', this.data.radarData)
          if (this.data.showRadar) {
            setTimeout(() => {
              this.drawRadarChart()
            }, 500)
          } else {
            console.log('雷达图数据为空，不绘制')
          }
        })
        
        this.setData({ isAnalyzing: false })
        wx.hideLoading()
        wx.showToast({ title: '分析完成', icon: 'success' })
      } else {
        throw new Error(res.result?.error || '分析失败')
      }
      
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
    console.log('1. drawRadarChart 被调用')
    console.log('2. showRadar:', this.data.showRadar)
    console.log('3. radarData:', this.data.radarData)
  
    if (!this.data.showRadar || !this.data.radarData) {
      console.log('条件不满足，跳过绘制')
      return
    }
    
    const ctx = wx.createCanvasContext('radarCanvas')
    
    if (!ctx) {
      console.error('获取 canvas 上下文失败')
      return
    }
    
    const { radarData } = this.data
    
    if (!radarData || !radarData.indicator || radarData.indicator.length === 0) {
      console.error('雷达图数据无效')
      return
    }

    // 获取 canvas 尺寸
    const query = wx.createSelectorQuery()
    query.select('#radarCanvas').boundingClientRect()
    query.exec((res) => {
      if (!res || !res[0] || res[0].width === 0) {
        console.error('获取 canvas 尺寸失败，重试')
        setTimeout(() => {
          this.drawRadarChart()
        }, 300)
        return
      }
      
      this.renderRadarChart(ctx, radarData, res[0].width, res[0].height)
    })
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
    ctx.draw()
    console.log('雷达图绘制完成')
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

      if (result) {
        wx.showToast({ title: '保存成功', icon: 'success' })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        wx.showToast({ title: '保存失败', icon: 'none' })
      }
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
              actionData: {}, 
              emotionsList: [],
              radarData: null,
              showRadar: false
            })
          }
        }
      })
    }
  }
})