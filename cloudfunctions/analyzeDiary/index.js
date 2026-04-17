const cloud = require('wx-server-sdk')
const https = require('https')
const { SCHOOL_META, buildSystemPrompt, buildUserPrompt } = require('./utils/prompt')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 使用云函数环境变量读取API Key，避免明文泄露。
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || ''
const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
const MODEL_NAME = 'qwen-plus'

const EMOTION_KEYWORDS = {
  '快乐': ['开心', '快乐', '幸福', '高兴', '欣喜', '喜悦', '笑'],
  '悲伤': ['难过', '伤心', '悲伤', '失落', '沮丧', '压抑'],
  '愤怒': ['生气', '愤怒', '恼火', '烦躁', '气愤'],
  '恐惧': ['害怕', '恐惧', '慌张', '胆怯'],
  '焦虑': ['焦虑', '担忧', '紧张', '不安', '心慌'],
  '平静': ['平静', '安心', '从容', '放松', '释然'],
  '期待': ['期待', '希望', '盼望', '憧憬'],
  '失望': ['失望', '绝望', '灰心', '泄气'],
  '满足': ['满足', '满意', '充实', '知足'],
  '孤独': ['孤独', '寂寞', '孤单', '无助'],
  '亲密': ['亲密', '爱', '喜欢', '想念', '牵挂'],
  '迷茫': ['迷茫', '困惑', '茫然', '不知所措'],
  '疲惫': ['疲惫', '疲倦', '累', '乏力', '没精神']
}

exports.main = async (event) => {
  const { content } = event || {}
  if (!content || !String(content).trim()) {
    return {
      success: false,
      error: 'content 不能为空'
    }
  }

  try {
    const aiResult = await analyzeByTongyi(String(content))
    return {
      success: true,
      data: aiResult
    }
  } catch (error) {
    console.error('通义分析失败，启用兜底:', error)
    return {
      success: true,
      data: buildFallbackResult(String(content))
    }
  }
}

async function analyzeByTongyi(content) {
  if (!DASHSCOPE_API_KEY) {
    throw new Error('未配置 DASHSCOPE_API_KEY 环境变量')
  }

  const payload = {
    model: MODEL_NAME,
    temperature: 0.6,
    messages: [
      {
        role: 'system',
        content: buildSystemPrompt()
      },
      {
        role: 'user',
        content: buildUserPrompt(content)
      }
    ]
  }

  const response = await postJson(DASHSCOPE_URL, payload, {
    Authorization: `Bearer ${DASHSCOPE_API_KEY}`
  })

  const rawContent = response?.choices?.[0]?.message?.content || ''
  const parsed = safeParseJSON(rawContent)
  if (!parsed) {
    throw new Error('AI返回格式无法解析为JSON')
  }

  const normalizedScores = normalizeEmotionScores(parsed.emotionScores)
  const dominantEmotion = parsed.dominantEmotion || inferDominantEmotion(normalizedScores)
  const normalizedSchoolResponses = normalizeSchoolResponses(parsed.schoolResponses)

  return {
    scores: normalizedScores,
    emotions: normalizedScores,
    dominantEmotion,
    summary: parsed.summary || content.slice(0, 90),
    schoolResponses: normalizedSchoolResponses
  }
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
  const scores = {}
  Object.keys(EMOTION_KEYWORDS).forEach(name => {
    const keywords = EMOTION_KEYWORDS[name]
    let score = 0
    keywords.forEach(word => {
      const regex = new RegExp(word, 'gi')
      const matches = content.match(regex)
      if (matches) score += matches.length * 16
    })
    scores[name] = Math.min(100, score)
  })

  if (!Object.values(scores).some(v => v > 0)) {
    scores['平静'] = 60
    scores['满足'] = 40
  }

  return {
    scores,
    emotions: scores,
    dominantEmotion: inferDominantEmotion(scores),
    summary: content.slice(0, 90),
    schoolResponses: normalizeSchoolResponses([])
  }
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

function postJson(url, data, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
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
    req.write(JSON.stringify(data))
    req.end()
  })
}
