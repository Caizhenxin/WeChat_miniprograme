// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 引入AI能力（使用腾讯混元或OpenAI）
// 这里以腾讯混元为例

exports.main = async (event, context) => {
  const { content } = event
  const wxContext = cloud.getWXContext()

  // 情绪维度定义
  const emotionDimensions = [
    '快乐', '悲伤', '愤怒', '恐惧', '焦虑', 
    '平静', '期待', '失望', '满足', '孤独'
  ]

  try {
    // 1. 调用AI分析情绪
    const analysisResult = await analyzeEmotions(content)
    
    // 2. 生成雷达图数据（各维度分数0-100）
    const radarData = generateRadarData(analysisResult.scores)
    
    // 3. 根据主导情绪匹配咨询流派和回应
    const counselingResponse = generateCounselingResponse(
      analysisResult.dominantEmotion,
      content
    )
    
    return {
      success: true,
      data: {
        radarData,           // 雷达图数据
        emotions: analysisResult.scores,  // 各情绪分数
        dominantEmotion: analysisResult.dominantEmotion,
        counseling: counselingResponse,
        summary: analysisResult.summary
      }
    }
    
  } catch (error) {
    console.error(error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 模拟AI分析（实际使用时替换为真实AI API调用）
async function analyzeEmotions(content) {
  // 这里可以调用：
  // 1. 腾讯混元大模型
  // 2. OpenAI GPT API
  // 3. 百度文心一言
  // 4. 阿里通义千问
  
  // 以下是模拟数据（实际开发时替换为真实API）
  // 基于关键词简单模拟
  const emotionKeywords = {
    '快乐': ['开心', '快乐', '幸福', '高兴', '兴奋'],
    '悲伤': ['难过', '伤心', '悲伤', '失落', '沮丧'],
    '愤怒': ['生气', '愤怒', '恼火', '不满', '烦躁'],
    '恐惧': ['害怕', '恐惧', '紧张', '担心', '不安'],
    '焦虑': ['焦虑', '压力', '担忧', '着急', '慌张'],
    '平静': ['平静', '安宁', '放松', '舒适', '自在'],
    '期待': ['期待', '希望', '憧憬', '盼望', '渴望'],
    '失望': ['失望', '失落', '沮丧', '灰心', '遗憾'],
    '满足': ['满足', '充实', '成就', '自豪', '欣慰'],
    '孤独': ['孤独', '寂寞', '孤单', '落寞', '无助']
  }
  
  const scores = {}
  let dominantEmotion = '平静'
  let maxScore = 0
  
  for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
    let score = 0
    keywords.forEach(keyword => {
      const regex = new RegExp(keyword, 'g')
      const matches = content.match(regex)
      if (matches) score += matches.length * 10
    })
    // 限制最高分100
    score = Math.min(100, score)
    scores[emotion] = score
    
    if (score > maxScore) {
      maxScore = score
      dominantEmotion = emotion
    }
  }
  
  // 如果没有匹配到任何关键词，给一个默认的"平静"分数
  if (maxScore === 0) {
    scores['平静'] = 70
    dominantEmotion = '平静'
  }
  
  return {
    scores,
    dominantEmotion,
    summary: content.substring(0, 100) + (content.length > 100 ? '...' : '')
  }
}

// 生成雷达图数据
function generateRadarData(scores) {
  // 雷达图需要的格式：各维度的值和最大值
  const dimensions = Object.keys(scores)
  const values = Object.values(scores)
  
  return {
    dimensions: dimensions,
    values: values,
    maxValue: 100
  }
}

// 匹配咨询流派并生成回应
function generateCounselingResponse(emotion, content) {
  // 流派与情绪的对应关系
  const counselingMap = {
    '快乐': {
      name: '积极心理学',
      desc: '关注优势与幸福感',
      response: (text) => `感受到你内心的喜悦！积极心理学认为，记录快乐时刻能增强幸福感。今天是什么让你感到开心呢？这份快乐值得被珍惜和放大。`
    },
    '悲伤': {
      name: '人本主义',
      desc: '无条件积极关注',
      response: (text) => `听到你感到有些低落。人本主义心理学相信每个人都有自我疗愈的能力。允许自己感受这份情绪，它也是你真实的一部分。`
    },
    '愤怒': {
      name: '认知行为疗法',
      desc: '识别触发情绪的想法',
      response: (text) => `愤怒是一种强烈的信号。CBT视角下，我们可以一起探索：是什么想法触发了这份情绪？它想告诉你什么？`
    },
    '恐惧': {
      name: '精神分析',
      desc: '探索潜意识冲突',
      response: (text) => `恐惧往往指向我们内心深处在意的事物。精神分析认为，理解恐惧的来源，就能减轻它的力量。`
    },
    '焦虑': {
      name: '正念疗法',
      desc: '接纳当下，减少反刍',
      response: (text) => `焦虑常来自对未来的担忧。正念疗法邀请你：先把注意力带回呼吸，回到此时此刻。你不需要立刻解决所有问题。`
    },
    '平静': {
      name: '冥想与正念',
      desc: '培养内在平静',
      response: (text) => `平静是一种珍贵的内在资源。正念练习可以帮助你更长久地安住在这种状态中，感受此刻的安宁。`
    },
    '期待': {
      name: '存在主义',
      desc: '探索意义与可能性',
      response: (text) => `期待是对未来的向往。存在主义心理学认为，正是这种向前的动力，赋予生活意义。你期待的事情对你来说很重要。`
    },
    '失望': {
      name: '接纳承诺疗法',
      desc: '接纳现实，承诺行动',
      response: (text) => `失望来自期望与现实之间的差距。ACT邀请你：接纳这份失望，然后问自己，下一步我可以做什么？`
    },
    '满足': {
      name: '自我决定理论',
      desc: '满足基本心理需求',
      response: (text) => `满足感通常来自自主、胜任和归属需求的满足。你最近是否在某个方面感受到了成长或连接？`
    },
    '孤独': {
      name: '人际心理治疗',
      desc: '关注关系与连接',
      response: (text) => `孤独感提醒我们渴望连接。IPT关注人际关系：是否有你愿意靠近的人？或者，此刻的你更需要先陪伴自己？`
    }
  }
  
  const counselingType = counselingMap[emotion] || counselingMap['平静']
  
  return {
    counselingType: counselingType.name,
    counselingDesc: counselingType.desc,
    counselingResponse: counselingType.response(content)
  }
}