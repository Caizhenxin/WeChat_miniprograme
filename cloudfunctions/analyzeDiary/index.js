// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// ============================================================
// 情绪词库（来自 skill/references/emotion_vocabulary.md）
// ============================================================
const EMOTION_KEYWORDS = {
  // 积极情绪
  '快乐': ['开心', '快乐', '幸福', '高兴', '兴奋', '欢快', '欣喜', '欢喜', '喜悦', '乐', '笑容', '好玩'],
  '满足': ['满足', '满意', '充实', '完整', '足够了', '知足', '欣慰', '富足'],
  '平静': ['平静', '宁静', '安宁', '安心', '从容', '恬淡', '释然', '豁然', '放松', '舒适', '自在', '悠闲'],
  '自信': ['自信', '有信心', '相信', '底气', '把握', '确定', '肯定', '自豪', '骄傲', '得意'],
  '感恩': ['感恩', '感谢', '感激', '谢谢', '福气', '幸运', '好意', '温馨', '温暖', '感动'],
  '期待': ['期待', '希望', '盼望', '憧憬', '渴望', '向往', '梦想', '愿景', '理想'],
  '亲密': ['亲密', '亲切', '爱', '喜欢', '想念', '思念', '依恋', '牵挂', '甜蜜', '美满'],
  '平静2': ['舒畅', '畅快', '酣畅', '痛快', '放松', '解脱', '轻盈', '轻快'],
  
  // 消极情绪
  '悲伤': ['难过', '伤心', '悲伤', '失落', '沮丧', '忧伤', '哀伤', '心痛', '痛苦', '哭', '泪水', '委屈', '伤心', '郁闷', '压抑', '沉重'],
  '焦虑': ['焦虑', '担忧', '担心', '着急', '慌张', '紧张', '不安', '坐立不安', '心慌', '发慌', '六神无主', '心神不宁'],
  '愤怒': ['生气', '愤怒', '恼火', '不满', '烦躁', '烦躁', '火大', '气愤', '讨厌', '厌烦', '恶心', '反感', '恨', '讨厌'],
  '恐惧': ['害怕', '恐惧', '怕', '畏缩', '退缩', '胆怯', '怯懦', '怕死', '惊恐', '慌张', '发憷'],
  '孤独': ['孤独', '寂寞', '孤单', '落寞', '无助', '无依', '独立', '独处', '冷清', '空旷'],
  '失望': ['失望', '绝望', '沮丧', '灰心', '泄气', '气馁', '没戏', '完了', '无望', '放弃'],
  '迷茫': ['迷茫', '茫然', '困惑', '糊涂', '不知所措', '不明', '不知所措', '晕', '凌乱', '乱'],
  '疲惫': ['疲惫', '疲倦', '累', '疲劳', '乏力', '无力', '虚弱', '倦怠', '困', '瞌睡', '没精神'],
  
  // 复杂情绪
  '复杂': ['百感交集', '又惊又喜', '喜忧参半', '苦乐参半', '五味杂陈', '说不清', '道不明', '矛盾', '纠结', '冲突']
}

// 强度词库（修饰情绪强度）
const INTENSITY_MODIFIERS = {
  '非常': 1.5, '特别': 1.5, '极其': 1.8, '格外': 1.4, '十分': 1.4,
  '很': 1.2, '比较': 1.0, '有点': 0.7, '有些': 0.7, '稍微': 0.5, '略微': 0.5,
  '极': 1.8, '超': 1.6, '太': 1.5, '好': 1.2,
  '轻度': 0.5, '中度': 0.7, '重度': 1.2, '严重': 1.5
}

// ============================================================
// 微行动库（来自 skill/references/exercises.md）
// ============================================================
const MICRO_ACTIONS = {
  '三件好事': {
    name: '三件好事',
    duration: 5,
    steps: [
      '今晚睡前，花5分钟写下今天发生的3件好事',
      '对每件好事，写下：为什么发生？你的感受？',
      '好事不分大小——一杯热水、陌生人的微笑都算'
    ],
    tip: '坚持一周后，大脑会自动关注积极面'
  },
  '正念呼吸': {
    name: '正念呼吸',
    duration: 3,
    steps: [
      '找一个安静处舒服坐好',
      '闭上眼睛，专注呼吸',
      '如果走神了，温柔带回',
      '持续3分钟即可'
    ],
    tip: '每天随时可用，特别适合焦虑时'
  },
  '积极重构': {
    name: '积极重构',
    duration: 5,
    steps: [
      '写下让你烦恼的事',
      '写下你当时的想法',
      '问自己：这个想法100%准确吗？',
      '换一个角度看，会怎样？'
    ],
    tip: '不是盲目乐观，是更准确的解释'
  },
  '优势日记': {
    name: '优势日记',
    duration: 3,
    steps: [
      '今天什么时候你做得不错？',
      '你用了什么优点/能力？',
      '记录下来'
    ],
    tip: '增强自信，发现自己的好'
  },
  '感恩写': {
    name: '感恩记录',
    duration: 3,
    steps: [
      '想一个想感谢的人',
      '写下他为你做了什么',
      '写下你的感受'
    ],
    tip: '不需要发出去，写下来就有用'
  },
  '身体扫描': {
    name: '身体扫描',
    duration: 3,
    steps: [
      '从脚到头扫描身体',
      '注意哪里紧绷/不适',
      '对不适部位说：我注意到了你'
    ],
    tip: '情绪往往藏在身体里'
  },
  '散步': {
    name: '短暂散步',
    duration: 5,
    steps: [
      '站起来出门散步',
      '注意观察周围事物',
      '走慢一点'
    ],
    tip: '改变身体姿态改变心情'
  },
  '写下来': {
    name: '情绪书写',
    duration: 5,
    steps: [
      '把当下的感受写下来',
      '不用评价，只是描述',
      '写完可以撕掉'
    ],
    tip: '写出来就不堵在心里'
  }
}

// ============================================================
// PERMA 评估（来自 skill/references/perma_assessment.md）
// ============================================================
function calculatePERMA(scores) {
  // 基于情绪分数估算PERMA五个维度
  // 这是简化的评估，实际可以使用专门的PERMA量表
  
  const positiveEmotions = (scores['快乐'] || 0) + (scores['满足'] || 0) + (scores['平静'] || 0) + (scores['自信'] || 0)
  const engagement = (scores['期待'] || 0) + (scores['满足'] || 0) * 0.5
  const relationships = (scores['亲密'] || 0) + (scores['感恩'] || 0) + (scores['孤独'] || 0) 
  const meaning = (scores['期待'] || 0) + (scores['满足'] || 0) * 0.5
  const accomplishment = (scores['满足'] || 0) + (scores['自信'] || 0) + (scores['期待'] || 0) * 0.3

  return {
    positiveEmotion: Math.min(100, positiveEmotions / 2),
    engagement: Math.min(100, engagement),
    relationships: Math.min(100, relationships / 2),
    meaning: Math.min(100, meaning),
    accomplishment: Math.min(100, accomplishment / 2)
  }
}

// ============================================================
// 云函数主入口
// ============================================================
exports.main = async (event, context) => {
  const { content } = event
  const wxContext = cloud.getWXContext()

  // 情绪维度定义
  const emotionDimensions = [
    '快乐', '悲伤', '愤怒', '恐惧', '焦虑', 
    '平静', '期待', '失望', '满足', '孤独', '亲密', '迷茫', '疲惫'
  ]

  try {
    // 1. 分析情绪（使用增强词库）
    const analysisResult = await analyzeEmotions(content)
    
    // 2. 生成雷达图数据
    const radarData = generateRadarData(analysisResult.scores)
    
    // 3. 生成咨询流派回应和微行动
    const counselingResponse = generateCounselingResponse(
      analysisResult.dominantEmotion,
      content
    )
    
    // 4. PERMA分析
    const permaAnalysis = calculatePERMA(analysisResult.scores)
    
    return {
      success: true,
      data: {
        radarData,
        emotions: analysisResult.scores,
        dominantEmotion: analysisResult.dominantEmotion,
        counseling: counselingResponse,
        perma: permaAnalysis,
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

// ============================================================
// 情绪分析函数（增强版）
// ============================================================
async function analyzeEmotions(content) {
  const scores = {}
  let dominantEmotion = '平静'
  let maxScore = 0
  
  // 计算每个情绪维度的分数
  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    let score = 0
    keywords.forEach(keyword => {
      const regex = new RegExp(keyword, 'gi')
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
  
  // 如果没有匹配到任何关键词，给默认分数
  if (maxScore === 0) {
    scores['平静'] = 60
    scores['满足'] = 40
    dominantEmotion = '平静'
  }
  
  return {
    scores,
    dominantEmotion,
    summary: content.substring(0, 100) + (content.length > 100 ? '...' : '')
  }
}

// ============================================================
// 生成雷达图数据
// ============================================================
function generateRadarData(scores) {
  const dimensions = Object.keys(scores)
  const values = Object.values(scores)
  
  return {
    dimensions: dimensions,
    values: values,
    maxValue: 100
  }
}

// ============================================================
// 生成咨询流派回应和微行动
// ============================================================
function generateCounselingResponse(emotion, content) {
  const counselingMap = {
    '快乐': {
      name: '积极心理学',
      desc: '关注优势与幸福感',
      response: (text) => `感受到你内心的喜悦！积极心理学认为，记录快乐时刻能增强幸福感。今天是什么让你感到开心呢？这份快乐值得被珍惜和放大。`,
      action: '三件好事'
    },
    '满足': {
      name: '积极心理学',
      desc: '关注优势与幸福感',
      response: (text) => `满足感来自你的努力和成长。你最近在什么方面付出了？这份满足是你应得的。`,
      action: '优势日记'
    },
    '悲伤': {
      name: '人本主义',
      desc: '无条件积极关注',
      response: (text) => `听到你感到有些低落。人本主义心理学相信每个人都有自我疗愈的能力。允许自己感受这份情绪，它也是你真实的一部分。`,
      action: '写下来'
    },
    '孤独': {
      name: '人际心理治疗',
      desc: '关注关系与连接',
      response: (text) => `孤独感提醒我们渴望连接。IPT关注人际关系：是否有你愿意靠近的人？或者，此刻的你更需要先陪伴自己？`,
      action: '感恩写'
    },
    '愤怒': {
      name: '认知行为疗法',
      desc: '识别触发情绪的想法',
      response: (text) => `愤怒是一种强烈的信号。CBT视角下，我们可以一起探索：是什么想法触发了这份情绪？它想告诉你什么？`,
      action: '积极重构'
    },
    '恐惧': {
      name: '精神分析',
      desc: '探索潜意识冲突',
      response: (text) => `恐惧往往指向我们内心深处在意的事物。精神分析认为，理解恐惧的来源，就能减轻它的力量。`,
      action: '身体扫描'
    },
    '焦虑': {
      name: '正念疗法',
      desc: '接纳当下，减少反刍',
      response: (text) => `焦虑常来自对未来的担忧。正念疗法邀请你：先把注意力带回到呼吸，回到此时此刻。你不需要立刻解决所有问题。`,
      action: '正念呼吸'
    },
    '平静': {
      name: '冥想与正念',
      desc: '培养内在平静',
      response: (text) => `平静是一种珍贵的内在资源。正念练习可以帮助你更长久地安住在这种状态中，感受此刻的安宁。`,
      action: '正念呼吸'
    },
    '期待': {
      name: '存在主义',
      desc: '探索意义与可能性',
      response: (text) => `期待是对未来的向往。存在主义心理学认为，正是这种向前的动力，赋予生活意义。你期待的事情对你来说很重要。`,
      action: '优势日记'
    },
    '失望': {
      name: '接纳承诺疗法',
      desc: '接纳现实，承诺行动',
      response: (text) => `失望来自期望与现实之间的差距。ACT邀请你：接纳这份失望，然后问自己，下一步我可以做什么？`,
      action: '积极重构'
    },
    '亲密': {
      name: '积极心理学',
      desc: '关注人际关系',
      response: (text) => `感受到你与人的连接。哈佛幸福研究发现，人际关系是幸福最强的预测因子。珍惜这份连接。`,
      action: '感恩写'
    },
    '迷茫': {
      name: '存在主义',
      desc: '探索意义与方向',
      response: (text) => `每个人都会迷茫。存在主义认为，这恰恰是探索人生意义的开始。你内心真正想要的是什么？`,
      action: '写下来'
    },
    '疲惫': {
      name: '自我照顾',
      desc: '身心恢复',
      response: (text) => `你累了。照顾好自己很重要。允许自己休息，这不是偷懒，是必要的自我照顾。`,
      action: '散步'
    },
    '复杂': {
      name: '叙事疗法',
      desc: '多元视角',
      response: (text) => `我感受到你复杂的情绪。叙事疗法相信，每种情绪都在诉说一些故事。有什么特别想聊的吗？`,
      action: '写下来'
    }
  }
  
  const counselingType = counselingMap[emotion] || counselingMap['平静']
  const action = MICRO_ACTIONS[counselingType.action] || MICRO_ACTIONS['正念呼吸']
  
  return {
    counselingType: counselingType.name,
    counselingDesc: counselingType.desc,
    counselingResponse: counselingType.response(content),
    action: {
      name: action.name,
      duration: action.duration,
      steps: action.steps,
      tip: action.tip
    }
  }
}