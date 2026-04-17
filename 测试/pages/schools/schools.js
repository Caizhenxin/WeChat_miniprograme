Page({
  data: {
    schools: [
      {
        key: 'cbt',
        name: '认知行为疗法（CBT）',
        shortTag: '抓认知偏差',
        description: '关注情绪背后的自动化想法，练习从“灾难化、非黑即白、自我否定”中走出来。',
        highlight: '关键词：证据检验、替代想法、行为实验',
        suitable: '适合反复焦虑、自我批评强、脑内小剧场停不下来时'
      },
      {
        key: 'act',
        name: '接纳承诺疗法（ACT）',
        shortTag: '接纳并行动',
        description: '不与情绪硬碰硬，允许它存在，同时把行动对齐你真正重视的价值。',
        highlight: '关键词：接纳、解离、价值、承诺行动',
        suitable: '适合情绪波动大但不想被情绪绑架时'
      },
      {
        key: 'humanistic',
        name: '人本主义',
        shortTag: '无条件积极关注',
        description: '强调你作为一个人的价值，不急着纠正你，而是先理解你、看见你。',
        highlight: '关键词：真诚、共情、接纳、自我成长',
        suitable: '适合在脆弱期需要被理解、被支持时'
      },
      {
        key: 'narrative',
        name: '叙事疗法',
        shortTag: '问题外化',
        description: '把“人”和“问题”分开，不把困难定义成你的身份，重写自己的生命故事。',
        highlight: '关键词：问题外化、独特结果、重写故事',
        suitable: '适合长期自责、被过去标签困住时'
      }
    ]
  },

  goToDiary() {
    wx.navigateTo({
      url: '/pages/diary/diary'
    })
  }
})
