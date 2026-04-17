const SCHOOL_META = [
	{
		key: 'cbt',
		schoolName: '认知行为疗法（CBT）',
		schoolTag: '识别认知偏差',
		styleGuide: '请指出可能的自动化想法（灾难化、非黑即白、贴标签等），并给出一个更平衡的替代想法。'
	},
	{
		key: 'act',
		schoolName: '接纳承诺疗法（ACT）',
		schoolTag: '接纳并行动',
		styleGuide: '请体现接纳情绪、认知解离和价值行动，不否认痛苦，也不放弃行动。'
	},
	{
		key: 'humanistic',
		schoolName: '人本主义',
		schoolTag: '无条件积极关注',
		styleGuide: '请使用温和、理解、接纳的语气，优先让用户感到被看见，再给建议。'
	},
	{
		key: 'narrative',
		schoolName: '叙事疗法',
		schoolTag: '问题外化',
		styleGuide: '请把问题和人分离，避免把用户定义为“有问题的人”，引导重写故事。'
	}
]

function buildSystemPrompt() {
	return [
		'你是一位心理支持型助手，面向普通用户，不提供医疗诊断。',
		'你要基于用户的日记内容，分别从4个流派给出简洁回应，并提供可执行的微行动。',
		'输出必须是严格JSON，不要输出多余文字。',
		'JSON结构：',
		'{',
		'  "summary": "string",',
		'  "emotionScores": {"快乐":0-100,"悲伤":0-100,"愤怒":0-100,"恐惧":0-100,"焦虑":0-100,"平静":0-100,"期待":0-100,"失望":0-100,"满足":0-100,"孤独":0-100,"亲密":0-100,"迷茫":0-100,"疲惫":0-100},',
		'  "dominantEmotion": "string",',
		'  "schoolResponses": [',
		'    {',
		'      "schoolKey": "cbt|act|humanistic|narrative",',
		'      "schoolName": "string",',
		'      "schoolTag": "string",',
		'      "response": "80-140字",',
		'      "action": {"name":"string","duration":1-10,"steps":["string","string","string"],"tip":"string"}',
		'    }',
		'  ]',
		'}',
		'要求：',
		'1) 语气温柔具体，避免空泛说教。',
		'2) 不做精神疾病诊断，不给药物建议。',
		'3) 微行动可在5分钟内开始。',
		'4) 每个流派回应必须体现该流派特点。'
	].join('\n')
}

function buildUserPrompt(content) {
	const schoolRules = SCHOOL_META.map(item => {
		return `- ${item.key}(${item.schoolName}): ${item.styleGuide}`
	}).join('\n')

	return [
		'请分析这段日记并按要求输出JSON。',
		'四个流派的风格要求：',
		schoolRules,
		'日记原文：',
		content
	].join('\n\n')
}

module.exports = {
	SCHOOL_META,
	buildSystemPrompt,
	buildUserPrompt
}
