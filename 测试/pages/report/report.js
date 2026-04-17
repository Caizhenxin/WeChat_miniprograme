// pages/report/report.js

// 情绪分类（来自 emotion_tracker.py）
const POSITIVE_EMOTIONS = [
  '快乐', '满足', '平静', '自信', '感恩', '期待', '亲密', '舒畅', '欣喜', '欣慰', '自豪', '温暖'
]

const NEGATIVE_EMOTIONS = [
  '悲伤', '焦虑', '愤怒', '恐惧', '孤独', '失望', '迷茫', '疲惫', '沮丧', '难过', '烦躁', '紧张'
]

Page({
  data: {
    weekRange: '',
    totalCount: 0,
    positiveRatio: 0,
    avgIntensity: 0,
    emotionStats: [],
    assessmentClass: '',
    assessmentIcon: '',
    assessmentTitle: '',
    assessmentDesc: '',
    suggestions: [],
    totalCheckins: 0,
    weekCheckins: 0,
    treeLevel: '🌱',
    treeLevelTitle: '',
    treeProgress: 0,
    todayCheckedIn: false
  },

  onLoad() {
    this.generateReport()
  },

  onShow() {
    this.generateReport()
  },

  generateReport() {
    const diaries = wx.getStorageSync('localDiaries') || []
    const checkinDates = wx.getStorageSync('checkinDates') || []
    
    // 计算本周的日期范围
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay())
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    
    const weekRange = `${this.formatDate(weekStart)} - ${this.formatDate(weekEnd)}`
    
    // 筛选本周的日记
    const thisWeekDiaries = diaries.filter(d => {
      const date = new Date(d.createTime)
      return date >= weekStart && date <= weekEnd
    })
    
    const weekCheckins = checkinDates.filter(dateKey => {
      const date = new Date(`${dateKey}T00:00:00`)
      return date >= weekStart && date <= weekEnd
    }).length

    const totalCheckins = checkinDates.length
    const todayKey = this.getDateKey(now)
    const todayCheckedIn = checkinDates.includes(todayKey)
    const treeState = this.getTreeState(totalCheckins)

    if (thisWeekDiaries.length === 0) {
      this.setData({
        weekRange,
        totalCount: 0,
        positiveRatio: 0,
        avgIntensity: 0,
        emotionStats: [],
        assessmentClass: 'needing-attention',
        assessmentIcon: '📝',
        assessmentTitle: '还没有记录',
        assessmentDesc: '开始记录情绪，了解自己的内心变化',
        suggestions: ['今天开始记录你的第一篇日记吧'],
        weekCheckins,
        totalCheckins,
        todayCheckedIn,
        treeLevel: treeState.emoji,
        treeLevelTitle: treeState.title,
        treeProgress: treeState.progress
      })
      return
    }
    
    // 统计情绪
    const emotionCounts = {}
    let positiveCount = 0
    let negativeCount = 0
    let totalIntensity = 0
    
    thisWeekDiaries.forEach(diary => {
      const emotions = diary.actionData?.emotions || {}
      
      for (const [emotion, intensity] of Object.entries(emotions)) {
        if (!emotionCounts[emotion]) {
          emotionCounts[emotion] = 0
        }
        emotionCounts[emotion]++
        
        if (POSITIVE_EMOTIONS.includes(emotion)) {
          positiveCount++
        } else if (NEGATIVE_EMOTIONS.includes(emotion)) {
          negativeCount++
        }
        
        totalIntensity += intensity
      }
    })
    
    // 计算积极比例
    const totalEmotions = positiveCount + negativeCount
    const positiveRatio = totalEmotions > 0 ? Math.round(positiveCount / totalEmotions * 100) : 0
    
    // 计算平均强度
    const avgIntensity = thisWeekDiaries.length > 0 
      ? Math.round(totalIntensity / thisWeekDiaries.length) 
      : 0
    
    // 排序情绪统计
    const emotionStats = Object.entries(emotionCounts)
      .map(([name, count]) => ({ name, count, percent: Math.round(count / totalEmotions * 100) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
    
    // Fredrickson 3:1 评估
    let assessmentClass, assessmentIcon, assessmentTitle, assessmentDesc
    if (positiveRatio >= 75) {
      assessmentClass = 'flourishing'
      assessmentIcon = '🌟'
      assessmentTitle = '繁荣状态'
      assessmentDesc = '你的积极情绪比例很高！根据Fredrickson的3:1理论，这是心理健康的良好表现。'
    } else if (positiveRatio >= 50) {
      assessmentClass = 'approaching'
      assessmentIcon = '📈'
      assessmentTitle = '接近繁荣'
      assessmentDesc = '你的情绪比较平衡。建议增加一些积极体验。'
    } else {
      assessmentClass = 'needing-attention'
      assessmentIcon = '💪'
      assessmentTitle = '需要关注'
      assessmentDesc = '建议尝试"三件好事"练习，训练大脑关注积极面。'
    }
    
    // 生成建议
    const suggestions = []
    if (positiveRatio < 50) {
      suggestions.push('每天记录"三件好事"，训练关注积极面')
      suggestions.push('尝试正念呼吸，每天3分钟')
    } else if (positiveRatio < 75) {
      suggestions.push('继续保持情绪记录的习惯')
      suggestions.push('可以尝试优势日记，发现自己的长处')
    } else {
      suggestions.push('你的情绪管理很棒！')
      suggestions.push('考虑写下感恩日记，强化积极体验')
    }
    suggestions.push('多和人交流，建立支持性关系')
    
    this.setData({
      weekRange,
      totalCount: thisWeekDiaries.length,
      positiveRatio,
      avgIntensity,
      emotionStats,
      assessmentClass,
      assessmentIcon,
      assessmentTitle,
      assessmentDesc,
      suggestions,
      weekCheckins,
      totalCheckins,
      todayCheckedIn,
      treeLevel: treeState.emoji,
      treeLevelTitle: treeState.title,
      treeProgress: treeState.progress
    })
  },

  getDateKey(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  getTreeState(totalCheckins) {
    const levelGoal = 30
    const progress = Math.min(100, Math.round(totalCheckins / levelGoal * 100))

    if (totalCheckins >= 24) {
      return { emoji: '🌳', title: '繁茂大树', progress }
    }
    if (totalCheckins >= 16) {
      return { emoji: '🌲', title: '成长中的树', progress }
    }
    if (totalCheckins >= 8) {
      return { emoji: '🪴', title: '稳定生长', progress }
    }
    if (totalCheckins >= 1) {
      return { emoji: '🌱', title: '刚刚发芽', progress }
    }
    return { emoji: '🌰', title: '等待第一滴水', progress: 0 }
  },

  formatDate(date) {
    const month = date.getMonth() + 1
    const day = date.getDate()
    return `${month}月${day}日`
  },

  goToDiary() {
    wx.navigateTo({
      url: '/pages/diary/diary'
    })
  }
})