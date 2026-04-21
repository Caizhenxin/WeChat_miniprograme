const cloud = require('wx-server-sdk')
const https = require('https')
const { SCHOOL_META, buildSystemPrompt, buildUserPrompt } = require('./utils/prompt')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

console.log('🚀 [CLOUD] 云函数 analyzeDiary 已更新 v2.2 - 使用 SiliconFlow GLM-4.7 API')

// SiliconFlow API 配置 (Pro/zai-org/GLM-4.7)
const DEEPSEEK_CONFIG = {
  baseURL: 'https://api.siliconflow.cn',
  apiKey: 'sk-fpmylsbjumnjntoibjwuxvuhdqeowxvasencojuqhozamuem',
  model: 'Pro/zai-org/GLM-4.7'
}

const EMOTION_KEYWORDS = {
  '快乐': ['开心', '快乐', '幸福', '高兴', '欣喜', '喜悦', '笑', '欢乐', '愉快', '爽', '嗨', '兴奋', '激动', '欢乐', '甜美', '美好'],
  '悲伤': ['难过', '伤心', '悲伤', '失落', '沮丧', '压抑', '郁闷', '难受', '痛苦', '委屈', '哭', '泪水', '伤心', '悲哀', '心酸', '悲痛', '凄凉', '沮丧', '郁闷'],
  '愤怒': ['生气', '愤怒', '恼火', '烦躁', '气愤', '恼怒', '发火', '暴躁', '愤恨', '怨恨', '讨厌', '恨', '不爽', '火大', '抓狂'],
  '恐惧': ['害怕', '恐惧', '慌张', '胆怯', '惊恐', '慌张', '畏惧', '怕', '紧张', '后怕', '心慌'],
  '焦虑': ['焦虑', '担忧', '紧张', '不安', '心慌', '着急', '焦急', '忧虑', '发愁', '困扰', '烦恼', '闹心', '纠结'],
  '平静': ['平静', '安心', '从容', '放松', '释然', '宁静', '安静', '轻松', '舒适', '惬意', '坦然'],
  '期待': ['期待', '希望', '盼望', '憧憬', '向往', '渴望', '盼望', '希望', '期待', '兴奋'],
  '失望': ['失望', '绝望', '灰心', '泄气', '沮丧', '无奈', '无力', '没辙', '放弃', '心灰意冷'],
  '满足': ['满足', '满意', '充实', '知足', '感恩', '感激', '幸运', '福气', '幸福'],
  '孤独': ['孤独', '寂寞', '孤单', '无助', '无人', '没人', '独自', '冷清', '凄凉'],
  '亲密': ['亲密', '爱', '喜欢', '想念', '牵挂', '温暖', '温馨', '甜蜜', '幸福', '依恋'],
  '迷茫': ['迷茫', '困惑', '茫然', '不知所措', '无方向', '晕', '凌乱', '混乱', '纠结'],
  '疲惫': ['疲惫', '疲倦', '累', '乏力', '没精神', '困', '倦', '疲惫', '劳累', '辛苦', '疲惫不堪']
}

exports.main = async (event) => {
  const { content } = event || {}
  if (!content || !String(content).trim()) {
    return {
      success: false,
      error: 'content 不能为空'
    }
  }

  // 默认使用本地方案，更快响应
  const useAI = false  // 设为true启用AI
  
  if (!useAI || !DEEPSEEK_CONFIG.apiKey) {
    console.log('📝 使用本地分析方案')
    return {
      success: true,
      data: buildFallbackResult(String(content)),
      usingFallback: true,
      fallbackReason: useAI ? '未配置API' : '默认使用本地'
    }
  }

  try {
    console.log('🔄 开始调用 SiliconFlow API...')
    const aiResult = await analyzeByDeepSeek(String(content))
    console.log('✅ SiliconFlow API 调用成功')
    return {
      success: true,
      data: aiResult,
      usingFallback: false
    }
  } catch (error) {
    console.error('❌ API 调用失败，启用本地:', error.message)
    return {
      success: true,
      data: buildFallbackResult(String(content)),
      usingFallback: true,
      fallbackReason: error.message
    }
  }
}

async function analyzeByDeepSeek(content) {
  if (!DEEPSEEK_CONFIG.apiKey) {
    throw new Error('未配置 DeepSeek API Key')
  }

  // 先用本地方法识别情绪，获取上下文
  const preScores = analyzeByPatterns(content)
  const dominant = inferDominantEmotion(preScores)
  
  console.log('🔍 预识别主导情绪:', dominant)

  const payload = {
    model: DEEPSEEK_CONFIG.model,
    temperature: 0.7,
    max_tokens: 2000,
    messages: [
      {
        role: 'system',
        content: buildDeepSeekSystemPrompt(dominant, preScores)
      },
      {
        role: 'user',
        content: buildDeepSeekUserPrompt(content, dominant, preScores)
      }
    ]
  }

  const url = `${DEEPSEEK_CONFIG.baseURL}/v1/messages`
  let response
  try {
    response = await postJson(url, payload, {
      Authorization: `Bearer ${DEEPSEEK_CONFIG.apiKey}`,
      'Content-Type': 'application/json'
    }, 8000)  // 8秒超时
  } catch (err) {
    // 超时或网络错误直接抛异常，由外层catch降级处理
    throw new Error(`AI请求失败: ${err.message}`)
  }

  // SiliconFlow 响应格式兼容OpenAI
  let rawContent = ''
  if (response?.choices?.[0]?.message?.content) {
    rawContent = response.choices[0].message.content
  } else if (response?.choices?.[0]?.delta?.content) {
    rawContent = response.choices[0].delta.content
  } else if (response?.output?.choices?.[0]?.message?.content) {
    rawContent = response.output.choices[0].message.content
  } else if (typeof response === 'string') {
    rawContent = response
  } else {
    console.log('⚠️ 响应结构:', JSON.stringify(response).slice(0, 500))
    rawContent = JSON.stringify(response)
  }
  console.log('📥 AI原始返回:', rawContent.slice(0, 800))
  
  const parsed = safeParseJSON(rawContent)
  if (!parsed) {
    throw new Error('AI返回格式无法解析为JSON')
  }

  // 使用AI返回的情绪分数（如果有效），否则用本地的
  const aiScores = parsed.emotionScores || {}
  const hasValidScores = Object.values(aiScores).some(v => v > 0)
  const normalizedScores = hasValidScores ? normalizeEmotionScores(aiScores) : preScores
  
  const finalDominant = parsed.dominantEmotion || dominant
  const normalizedSchoolResponses = normalizeSchoolResponses(parsed.schoolResponses, finalDominant, content)

  return {
    scores: normalizedScores,
    emotions: normalizedScores,
    dominantEmotion: finalDominant,
    summary: parsed.summary || content.slice(0, 90),
    schoolResponses: normalizedSchoolResponses
  }
}

// 构建 DeepSeek 系统提示词 - 根据情绪上下文定制
function buildDeepSeekSystemPrompt(dominantEmotion, scores) {
  const emotionDescriptions = {
    '悲伤': '用户当前情绪偏向悲伤/失落，请用理解、安慰的语气，给出温暖的回应',
    '愤怒': '用户当前情绪偏向愤怒/不满，请用平和、理性的语气，帮助用户冷静分析',
    '焦虑': '用户当前情绪偏向焦虑/担忧，请用稳定、镇定的语气，帮助用户缓解压力',
    '恐惧': '用户当前情绪偏向恐惧/害怕，请用安全、保护的语气，帮助用户建立安全感',
    '孤独': '用户当前情绪偏向孤独/寂寞，请用陪伴、温暖的语气，强调用户的价值',
    '疲惫': '用户当前情绪偏向疲惫/劳累，请用关怀、体贴的语气，建议用户休息',
    '迷茫': '用户当前情绪偏向迷茫/困惑，请用启发、支持的语气，帮助用户找到方向',
    '失望': '用户当前情绪偏向失望/挫败，请用鼓励、积极的语气，帮助用户重建信心',
    '快乐': '用户当前情绪偏向快乐/愉悦，请用分享、祝福的语气，强化积极情绪',
    '满足': '用户当前情绪偏向满足/幸福，请用感恩、珍惜的语气，帮助用户巩固美好',
    '平静': '用户当前情绪偏向平静/安宁，请用欣赏、稳定的语气，珍惜这份宁静',
    '期待': '用户当前情绪偏向期待/希望，请用鼓励、支持的语气，帮助用户规划行动',
    '亲密': '用户当前情绪偏向亲密/爱意，请用温暖、珍惜的语气，强化人际关系'
  }
  
  const emotionDesc = emotionDescriptions[dominantEmotion] || '用户正在表达情绪，请用理解、专业的语气回应'

  return [
    '你是一位专业的心理支持助手，面向普通用户，不提供医疗诊断。',
    `【当前情绪背景】${emotionDesc}`,
    '你需要基于用户的日记内容，从4个心理学流派（CBT、ACT、人本主义、叙事疗法）给出差异化的专业回应。',
    '【关键要求】每个流派的回应必须根据用户当前的情绪状态进行差异化定制：',
    '- CBT：针对"悲伤/焦虑/愤怒"时，强调识别负面思维模式；针对"快乐/满足"时，强调放大积极思维',
    '- ACT：针对负面情绪，强调接纳情绪、价值行动；针对积极情绪，强调延续美好、创造更多价值',
    '- 人本主义：始终强调无条件积极关注，但负面情绪时强调"被理解"，正面情绪时强调"你的价值"',
    '- 叙事疗法：负面情绪时把问题外化、找例外经验；正面情绪时帮助用户书写积极故事',
    '【输出格式】必须是严格JSON：',
    JSON.stringify({
      summary: "string",
      emotionScores: {"快乐":0-100,"悲伤":0-100,"愤怒":0-100,"恐惧":0-100,"焦虑":0-100,"平静":0-100,"期待":0-100,"失望":0-100,"满足":0-100,"孤独":0-100,"亲密":0-100,"迷茫":0-100,"疲惫":0-100},
      dominantEmotion: "string",
      schoolResponses: [
        {schoolKey: "cbt|act|humanistic|narrative", schoolName: "string", schoolTag: "string", response: "80-150字，根据情绪差异化", action: {name: "string", duration: 1-10, steps: ["string","string","string"], tip: "string"}}
      ]
    }),
    '【重要】微行动必须可立即执行，时长5分钟内完成。'
  ].join('\n')
}

// 构建 DeepSeek 用户提示词
function buildDeepSeekUserPrompt(content, dominantEmotion, scores) {
  const scoreStr = Object.entries(scores)
    .filter(([k, v]) => v > 0)
    .map(([k, v]) => `${k}:${v}`)
    .join(', ')
  
  return [
    `请分析这段日记并输出JSON。`,
    `当前情绪识别结果：${dominantEmotion} (${scoreStr || '待识别'})`,
    `请根据上述情绪背景，为每个流派生成差异化、针对性的回应。`,
    `日记内容：` + content
  ].join('\n\n')
}

function normalizeEmotionScores(input) {
  const scores = {}
  const dimensions = Object.keys(EMOTION_KEYWORDS)
  dimensions.forEach((name) => {
    const raw = Number(input && input[name])
    const score = Number.isFinite(raw) ? raw : 0
    scores[name] = Math.max(0, Math.min(100, Math.round(score)))
  })

  if (!Object.values(scores).some(v => v > 0)) {
    scores['平静'] = 60
    scores['满足'] = 40
  }

  return scores
}

function normalizeSchoolResponses(input) {
  const mapByKey = {}
  ;(input || []).forEach(item => {
    if (item && item.schoolKey) {
      mapByKey[item.schoolKey] = item
    }
  })

  return SCHOOL_META.map(meta => {
    const source = mapByKey[meta.key] || {}
    const steps = Array.isArray(source?.action?.steps) && source.action.steps.length
      ? source.action.steps.slice(0, 3)
      : getDefaultAction(meta.key).steps

    const action = {
      name: source?.action?.name || getDefaultAction(meta.key).name,
      duration: Number(source?.action?.duration) || getDefaultAction(meta.key).duration,
      steps,
      tip: source?.action?.tip || getDefaultAction(meta.key).tip
    }

    return {
      schoolKey: meta.key,
      schoolName: source.schoolName || meta.schoolName,
      schoolTag: source.schoolTag || meta.schoolTag,
      response: source.response || getDefaultResponse(meta.key),
      action
    }
  })
}

function getDefaultResponse(key) {
  const map = {
    cbt: '你很努力在应对当下。我们可以一起看看：哪些想法在放大你的压力？把它们写下来，再找一个更平衡、更贴近事实的解释。',
    act: '你现在的情绪很真实，不必急着把它赶走。先允许它在场，同时问自己：今天我愿意为重要的人和事迈出哪一步？',
    humanistic: '谢谢你愿意表达这些感受。无论你正在经历什么，你都值得被理解和温柔对待。请先给自己一点空间和善意。',
    narrative: '问题是问题，你是你。把困扰命名出来，看看它何时最强、何时最弱，你会重新看到自己不被问题定义的部分。'
  }
  return map[key] || map.humanistic
}

function getDefaultAction(key) {
  const actions = {
    cbt: {
      name: '想法证据卡',
      duration: 5,
      steps: ['写下此刻最困扰你的想法', '列出支持和反驳它的证据各2条', '写一个更平衡的替代想法'],
      tip: '目标不是乐观，而是更贴近事实'
    },
    act: {
      name: '价值行动一分钟',
      duration: 5,
      steps: ['给当前情绪命名并说“我允许它存在”', '写下你最看重的一个价值', '做一个1分钟相关行动并记录感受'],
      tip: '情绪可以在场，行动也可以继续'
    },
    humanistic: {
      name: '自我共情便签',
      duration: 4,
      steps: ['写一句“我现在确实很不容易”', '写一句“我仍然值得被善待”', '给自己一个小小照顾动作'],
      tip: '先被理解，再谈改变'
    },
    narrative: {
      name: '问题外化练习',
      duration: 5,
      steps: ['给问题起一个外号', '描述它何时最影响你', '写下你成功抵抗它的一次经历'],
      tip: '你不是问题本身'
    }
  }
  return actions[key] || actions.humanistic
}

function inferDominantEmotion(scores) {
  let max = -1
  let dominantEmotion = '平静'
  Object.keys(scores).forEach(key => {
    if (scores[key] > max) {
      max = scores[key]
      dominantEmotion = key
    }
  })
  return dominantEmotion
}

function buildFallbackResult(content) {
  console.log('🔧 [DEBUG] buildFallbackResult 被调用，原始内容:', content)
  
  const scores = {}
  
  // 第一步：智能模式识别（先运行，因为更准确）
  const patternScores = analyzeByPatterns(content)
  Object.assign(scores, patternScores)
  console.log('🔧 [DEBUG] 模式识别后的 scores:', JSON.stringify(scores))
  
  // 第二步：关键词匹配（累加到模式结果上）
  Object.keys(EMOTION_KEYWORDS).forEach(name => {
    const keywords = EMOTION_KEYWORDS[name]
    let score = 0
    keywords.forEach(word => {
      const regex = new RegExp(word, 'gi')
      const matches = content.match(regex)
      if (matches) {
        console.log(`🔧 [DEBUG] 关键词匹配: "${word}" -> "${name}" +${matches.length * 8}`)
        score += matches.length * 8
      }
    })
    if (score > 0) {
      const existingScore = scores[name] || 0
      scores[name] = Math.min(100, existingScore + score)
      console.log(`🔧 [DEBUG] ${name} 累加: ${existingScore} + ${score} = ${scores[name]}`)
    }
  })

  console.log('🔧 [DEBUG] 最终 scores:', JSON.stringify(scores))

  // 确保所有13个情绪维度都有值
  const allEmotions = ['快乐', '悲伤', '愤怒', '恐惧', '焦虑', '平静', '期待', '失望', '满足', '孤独', '亲密', '迷茫', '疲惫']
  allEmotions.forEach(emotion => {
    if (scores[emotion] === undefined) {
      scores[emotion] = 5  // 未识别的情绪给一个较低的默认值
    }
  })
  
  console.log('🔧 [DEBUG] 补全后的 scores:', JSON.stringify(scores))

  const dominant = inferDominantEmotion(scores)
  console.log('🔧 [DEBUG] 推断的主导情绪:', dominant)

  // 根据主导情绪生成差异化回应
  const schoolResponses = generateDifferentiatedResponses(dominant, scores, content)

  return {
    scores,
    emotions: scores,
    dominantEmotion: dominant,
    summary: content.slice(0, 90),
    schoolResponses
  }
}

// 智能模式识别 - 根据文本模式推断情绪（已优化分数逻辑）
function analyzeByPatterns(content) {
  const scores = {}
  const lowerContent = content.toLowerCase()
  
  // 工作相关负面事件 - 权重较高
  if (/被老板|被领导|被主管|被上级|工作被骂|被批评|被指责|被怪罪|加班/.test(lowerContent)) {
    addScore(scores, '悲伤', 40)
    addScore(scores, '愤怒', 35)
    addScore(scores, '失望', 25)
    addScore(scores, '疲惫', 20)
  }
  
  // 心情描述 - 明确的心情表达，权重最高
  if (/心情差|心情不好|心情糟糕|心情郁闷|心情烦|心情低落|开心不起来|高兴不起来|笑不出来/.test(lowerContent)) {
    addScore(scores, '悲伤', 55)
    addScore(scores, '焦虑', 25)
  }
  
  if (/心情好|心情不错|心情愉快|心情舒畅|心花怒放|乐开花/.test(lowerContent)) {
    addScore(scores, '快乐', 60)
    addScore(scores, '满足', 30)
  }
  
  // 压力相关
  if (/压力大|焦虑|烦|担心|紧张|不安|着急|发愁|烦心/.test(lowerContent)) {
    addScore(scores, '焦虑', 45)
  }
  
  // 失落相关
  if (/失望|绝望|沮丧|受挫|失败|没希望|放弃|心灰意冷/.test(lowerContent)) {
    addScore(scores, '失望', 45)
    addScore(scores, '悲伤', 30)
  }
  
  // 累相关
  if (/好累|太累|疲惫|疲倦|困|没精力|不想动|身心俱疲|累死了/.test(lowerContent)) {
    addScore(scores, '疲惫', 55)
  }
  
  // 孤独相关 - 优化：区分"一个人"和"孤独"
  // "一个人"可能是中性描述，"孤独"才是情绪
  if (/孤独感|感到孤独|觉得孤独|好孤独|很孤独|孤独一人|独自一人|孤零零/.test(lowerContent)) {
    addScore(scores, '孤独', 55)
  } else if (/没人陪|没人在身边|无人陪伴|寂寞|冷清|孤单/.test(lowerContent)) {
    addScore(scores, '孤独', 45)
  }
  
  // 愤怒相关
  if (/生气|愤怒|恼火|气愤|讨厌|恨|不爽|火大|抓狂|气死了/.test(lowerContent)) {
    addScore(scores, '愤怒', 55)
  }
  
  // 恐惧相关
  if (/害怕|恐惧|担心|后怕|慌|畏惧|吓人|可怕/.test(lowerContent)) {
    addScore(scores, '恐惧', 45)
  }
  
  // 正面情绪
  if (/开心|高兴|快乐|幸福|满足|满意|舒服|轻松|惬意|愉快|爽|兴奋|激动/.test(lowerContent)) {
    addScore(scores, '快乐', 45)
    addScore(scores, '满足', 25)
  }
  
  // 期待相关
  if (/期待|希望|盼望|憧憬|向往|渴望/.test(lowerContent)) {
    addScore(scores, '期待', 45)
  }
  
  // 迷茫相关
  if (/迷茫|困惑|茫然|不知所措|无方向|没方向|晕|凌乱/.test(lowerContent)) {
    addScore(scores, '迷茫', 45)
  }
  
  // 亲密相关
  if (/爱|喜欢|想念|牵挂|温暖|温馨|甜蜜|幸福|感动/.test(lowerContent)) {
    addScore(scores, '亲密', 45)
    addScore(scores, '快乐', 20)
  }
  
  console.log('🔧 [DEBUG] 模式识别结果:', JSON.stringify(scores))
  return scores
}

// 辅助函数：安全添加分数
function addScore(scores, emotion, points) {
  const current = scores[emotion] || 0
  scores[emotion] = Math.min(100, current + points)
}

// 根据情绪生成差异化回应的核心函数
function generateDifferentiatedResponses(dominantEmotion, scores, content) {
  // 情绪到回应的映射
  const emotionContext = getEmotionContext(dominantEmotion, scores)
  
  return SCHOOL_META.map(meta => {
    const customized = customizeResponseForSchool(meta.key, emotionContext, content)
    return {
      schoolKey: meta.key,
      schoolName: meta.schoolName,
      schoolTag: meta.schoolTag,
      response: customized.response,
      action: customized.action
    }
  })
}

// 获取情绪上下文
function getEmotionContext(dominantEmotion, scores) {
  const isPositive = ['快乐', '平静', '满足', '期待', '亲密'].includes(dominantEmotion)
  const isNegative = ['悲伤', '愤怒', '恐惧', '焦虑', '失望', '孤独', '迷茫', '疲惫'].includes(dominantEmotion)
  
  let emotionDescription = ''
  let suggestedAction = ''
  
  switch (dominantEmotion) {
    case '快乐':
    case '满足':
      emotionDescription = '你正感受到愉悦和满足'
      suggestedAction = '巩固这种积极情绪，分享这份快乐'
      break
    case '悲伤':
      emotionDescription = '你正经历失落和难过'
      suggestedAction = '先允许自己感受悲伤，然后寻找小小的安慰'
      break
    case '愤怒':
      emotionDescription = '你感到愤怒和不满'
      suggestedAction = '识别触发事件，尝试理性表达'
      break
    case '焦虑':
      emotionDescription = '你感到担忧和不安'
      suggestedAction = '把注意力带回当下可以做的小事'
      break
    case '恐惧':
      emotionDescription = '你感到害怕或担忧'
      suggestedAction = '确认最坏情况发生的可能性，准备应对'
      break
    case '失望':
      emotionDescription = '你感到失望和挫败'
      suggestedAction = '重新审视期望，调整目标'
      break
    case '孤独':
      emotionDescription = '你感到孤独和缺失连接'
      suggestedAction = '主动联系一个重要的人'
      break
    case '迷茫':
      emotionDescription = '你感到困惑和方向缺失'
      suggestedAction = '列出最近让你感到充实的一件事'
      break
    case '疲惫':
      emotionDescription = '你感到疲倦和精力不足'
      suggestedAction = '给自己一个短暂的休息'
      break
    case '期待':
      emotionDescription = '你充满希望和期待'
      suggestedAction = '为期待的目标迈出一小步'
      break
    case '亲密':
      emotionDescription = '你感到被爱和连接'
      suggestedAction = '珍惜这份连接，表达感激'
      break
    case '平静':
      emotionDescription = '你感到内心平静'
      suggestedAction = '享受这份宁静，感受当下'
      break
    default:
      emotionDescription = '你在经历一些情绪波动'
      suggestedAction = '尝试觉察此刻的感受'
  }
  
  return {
    dominantEmotion,
    isPositive,
    isNegative,
    emotionDescription,
    suggestedAction,
    scores
  }
}

// 根据流派定制回应
function customizeResponseForSchool(schoolKey, context, content) {
  const { emotionDescription, suggestedAction, isPositive, isNegative, dominantEmotion } = context
  
  const responses = {
    cbt: {
      response: isPositive 
        ? `${emotionDescription}。从认知行为角度看，这种积极情绪值得放大。试着记录下是什么想法带来了这份好心情，这可以帮助你在低落时更容易找回这种感觉。`
        : `${emotionDescription}。从认知行为角度看，我们可以一起看看：是什么想法导致了这种感受？这个想法是否完全准确？试着写下这个想法，找出至少一个支持它的证据和一个反驳它的证据。`,
      action: {
        name: '想法记录卡',
        duration: 5,
        steps: [
          '写下此刻最困扰或最愉快的想法',
          '列出支持这个想法的证据',
          '列出反驳这个想法的证据',
          '写一个更平衡的思考'
        ],
        tip: '不是要否定感受，而是更全面地看待情况'
      }
    },
    act: {
      response: isPositive
        ? `${emotionDescription}。接纳承诺疗法(ACT)建议你：充分体验这份积极感受，同时思考：这与我最看重什么价值一致？也许你可以为重要的人做一件小事。`
        : `${emotionDescription}。ACT建议你：不必急着赶走这种情绪，先允许它存在。把注意力慢慢带回当下，问自己：今天我愿意为我在乎的人和事迈出哪一小步？`,
      action: {
        name: '价值行动',
        duration: 5,
        steps: [
          '深呼吸三次，把注意力带回当下',
          '问自己：此刻我可以选择做什么？',
          '选择一个最小的一步行动',
          '现在就去执行并观察感受'
        ],
        tip: '行动产生动力，不是等动力来了再行动'
      }
    },
    humanistic: {
      response: isPositive
        ? `${emotionDescription}。人本主义视角：感谢你愿意分享这份喜悦。你本身就值得拥有美好感受。请给自己一个肯定：这说明你有能力创造积极体验。`
        : `${emotionDescription}。人本主义视角：无论现在感受多糟糕，你都值得被理解和温柔以待。请先对自己说："我现在确实不容易，但我仍然值得被善待。"`,
      action: {
        name: '自我肯定',
        duration: 4,
        steps: [
          '对自己说：我现在感受到的是正常的',
          '给自己一个拥抱或拍拍肩膀',
          '写一句对自己的鼓励话',
          '想象好朋友会对你说什么'
        ],
        tip: '先被自己理解，改变才有可能发生'
      }
    },
    narrative: {
      response: isPositive
        ? `${emotionDescription}。叙事疗法视角：如果把这段美好体验写进你的生命故事，你会用什么标题？你希望未来继续书写什么样的故事？`
        : `${emotionDescription}。叙事疗法视角：把这个问题想成一个外在的角色。如果给它起个名字（比如"压力怪"），它什么时候最强？什么时候变弱？你什么时候曾经打败过它？`,
      action: {
        name: '故事重写',
        duration: 5,
        steps: [
          '给当前困扰起一个有趣的名字',
          '描述它最常出现的场景',
          '回忆一次你成功应对它的经历',
          '写下一句话作为你的"成功宣言"'
        ],
        tip: '你是自己生命故事的作者'
      }
    }
  }
  
  return responses[schoolKey] || responses.humanistic
}

// 强制返回新格式的调试函数
function debugForceNewFormat() {
  console.log('🔧 [DEBUG] 正在使用新版云函数代码!')
}

function safeParseJSON(raw) {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch (error) {
    const matched = String(raw).match(/\{[\s\S]*\}/)
    if (!matched) return null
    try {
      return JSON.parse(matched[0])
    } catch (e) {
      return null
    }
  }
}

function postJson(url, data, headers, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      timeout: timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }, (res) => {
      let body = ''
      res.on('data', chunk => {
        body += chunk
      })
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode}: ${body}`))
        }
        try {
          resolve(JSON.parse(body))
        } catch (error) {
          reject(error)
        }
      })
    })

    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('请求超时'))
    })
    req.write(JSON.stringify(data))
    req.end()
  })
}
