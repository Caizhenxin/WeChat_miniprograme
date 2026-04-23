// pages/diary/diary.js
const diaryUtils = require('../../utils/diary.js')

// 混元模型调用配置
const EMOTION_PROMPT = `你是一位专业的心理咨询师，请分析以下日记文本的情绪状态，返回JSON格式结果：
{
  "scores": {
    "快乐": 0-100,
    "悲伤": 0-100,
    "愤怒": 0-100,
    "恐惧": 0-100,
    "焦虑": 0-100,
    "平静": 0-100,
    "期待": 0-100,
    "失望": 0-100,
    "满足": 0-100,
    "孤独": 0-100,
    "亲密": 0-100,
    "迷茫": 0-100,
    "疲惫": 0-100
  },
  "dominantEmotion": "最突出的1-2个情绪",
  "summary": "50字以内的情绪总结"
}`;

Page({
  data: {
    content: '',
    actionData: {
      emotions: {},
      emotionsList: [],
      dominantEmotion: '',
      analyzedAt: '',
      schoolResponses: [],
      selectedSchoolIndex: 0,
      selectedAction: null
    },
    isAnalyzing: false,
    isSaving: false,
    emotionsList: [],
    radarData: null,
    showRadar: false,
    radarRetryCount: 0
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

  // 分析内容
  async analyzeContent(content) {
    const that = this;
    
    try {
      // 调用混元模型
      const result = await that.callHunyuanModel(content);
      
      // 解析返回的JSON
      let emotionData;
      try {
        // 清理可能的markdown标记
        const cleanResult = result.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        emotionData = JSON.parse(cleanResult);
      } catch (parseError) {
        console.error('JSON解析失败:', parseError);
        emotionData = {
          scores: {
            '快乐': 60, '悲伤': 40, '焦虑': 50, '平静': 55, '愤怒': 30
          },
          dominantEmotion: '平静',
          summary: '情绪状态平稳'
        };
      }
      
      const scores = emotionData.scores || {};
      
      // 处理情绪分数数组
      const emotionsArray = [];
      for (let key in scores) {
        if (scores.hasOwnProperty(key)) {
          emotionsArray.push({ name: key, score: scores[key] });
        }
      }
      
      // 构建雷达图数据
      const radarChartData = that.buildRadarData(scores);
      
      that.setData({
        actionData: {
          emotions: scores,
          emotionsList: emotionsArray,
          dominantEmotion: emotionData.dominantEmotion || '未知',
          analyzedAt: new Date().toLocaleString(),
          schoolResponses: that.buildSchoolResponses(emotionData, content),
          selectedSchoolIndex: 0,
          selectedAction: null
        },
        radarData: radarChartData,
        showRadar: radarChartData !== null,
        isAnalyzing: false
      }, () => {
        if (that.data.showRadar) {
          setTimeout(() => {
            that.drawRadarChart();
          }, 500);
        }
      });
      
      wx.hideLoading();
      wx.showToast({ title: 'AI分析完成', icon: 'success' });
      
    } catch (error) {
      console.error('AI分析失败:', error);
      wx.hideLoading();
      that.setData({ isAnalyzing: false });
      wx.showToast({ title: '分析失败，请重试', icon: 'none' });
    }
  },

  async callHunyuanModel(content) {
    console.log('🔵 开始调用混元API，内容长度:', content.length);
    
    try {
      const model = wx.cloud.extend.AI.createModel("hunyuan-exp");
      console.log('🔵 模型创建成功');
      
      const result = await model.generateText({
        model: "hunyuan-2.0-instruct-20251111",
        messages: [
          { role: "system", content: EMOTION_PROMPT },
          { role: "user", content: content }
        ]
      });
      
      console.log('🟢 API调用成功:', result);
      console.log('🟢 返回内容:', result.choices[0].message.content);
      
      return result.choices[0].message.content;
    } catch (error) {
      console.error('🔴 API调用失败:', error);
      throw error;
    }
  },

  // 构建流派回应
  buildSchoolResponses(data, content) {
    const shortText = (content || '').slice(0, 36);
    const dominantEmotion = data.dominantEmotion || '情绪';
    
    return [
      {
        schoolKey: 'cbt',
        schoolName: '认知行为疗法（CBT）',
        schoolTag: '思维纠偏镜',
        response: `我注意到你在“${shortText}”中可能产生了一些自动化思维。我们可以做一次证据检验：有没有反例说明实际情况并不像你担心的那么糟？`,
        action: {
          name: '三栏笔记法',
          duration: 4,
          steps: [
            '写下发生的情况',
            '写下你的自动思维',
            '写下更平衡的理性回应'
          ],
          tip: '目标是更准确地看待自己，而非自我否定'
        }
      },
      {
        schoolKey: 'act',
        schoolName: '接纳承诺疗法（ACT）',
        schoolTag: '情绪容纳器',
        response: `你感受到了${dominantEmotion}，这很正常。请先允许这种情绪存在，然后把注意力慢慢带回你真正在意的事情上。`,
        action: {
          name: '情绪接纳练习',
          duration: 5,
          steps: [
            '深呼吸3次',
            '承认“我现在感到' + dominantEmotion + '”',
            '问自己“此刻什么对我最重要”'
          ],
          tip: '接纳不是放弃，而是停止内耗'
        }
      },
      {
        schoolKey: 'humanistic',
        schoolName: '人本主义',
        schoolTag: '优势探测器',
        response: `你在不舒服时还愿意记录和反思，这说明你在认真对待自己的生活。请先肯定自己的努力。`,
        action: {
          name: '优势发现',
          duration: 3,
          steps: [
            '写下今天做对的一件事',
            '写下自己拥有的一个优点',
            '对自己说一句鼓励的话'
          ],
          tip: '先看见自己的价值，行动会更稳定'
        }
      },
      {
        schoolKey: 'narrative',
        schoolName: '叙事疗法',
        schoolTag: '问题外化者',
        response: `问题是问题，你是你。可以把${dominantEmotion}命名为一个角色，观察它何时出现、何时变弱。`,
        action: {
          name: '问题外化',
          duration: 3,
          steps: [
            '给困扰起一个名字',
            '描述它最常出现的时机',
            '写一条应对策略'
          ],
          tip: '你在观察问题时，就在夺回主动权'
        }
      }
    ];
  },

  // 构建雷达图数据
  buildRadarData(scores) {
    if (!scores) return null;
    
    const emotionOrder = ['快乐', '悲伤', '愤怒', '恐惧', '焦虑', '平静', '期待', '失望', '满足', '孤独', '亲密', '迷茫', '疲惫'];
    const dimensions = [];
    const values = [];
    
    emotionOrder.forEach(key => {
      if (scores.hasOwnProperty(key) && scores[key] > 0) {
        dimensions.push(key);
        values.push(scores[key] || 1);
      }
    });
    
    if (dimensions.length === 0) return null;
    
    return {
      indicator: dimensions.map(dim => ({ name: dim, max: 100 })),
      series: [{
        name: '情绪维度',
        type: 'radar',
        data: [{ value: values, name: '当前情绪' }]
      }]
    };
  },

  // 绘制雷达图
  drawRadarChart: function() {
    if (!this.data.showRadar || !this.data.radarData) {
      return;
    }
    
    const query = wx.createSelectorQuery();
    query.select('#radarCanvas').boundingClientRect();
    query.exec((res) => {
      if (!res || !res[0] || res[0].width === 0) {
        const retry = (this.data.radarRetryCount || 0) + 1;
        if (retry <= 3) {
          this.setData({ radarRetryCount: retry });
          setTimeout(() => this.drawRadarChart(), 300);
        }
        return;
      }
      
      const ctx = wx.createCanvasContext('radarCanvas', this);
      if (ctx) {
        this.renderRadarChart(ctx, this.data.radarData, res[0].width, res[0].height);
        this.setData({ radarRetryCount: 0 });
      }
    });
  },

  // 渲染雷达图
  renderRadarChart: function(ctx, data, width, height) {
    const dimensions = data.indicator.length;
    const values = data.series[0].data[0].value;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.32;
    const angleStep = (Math.PI * 2) / dimensions;
    
    ctx.clearRect(0, 0, width, height);
    
    // 绘制背景网格
    const levels = [0.2, 0.4, 0.6, 0.8, 1.0];
    levels.forEach((level, idx) => {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * level, 0, 2 * Math.PI);
      ctx.setStrokeStyle(idx === 4 ? '#c5cae9' : '#e8eaf6');
      ctx.setLineWidth(idx === 4 ? 2 : 1);
      ctx.stroke();
    });
    
    // 绘制轴线和标签
    for (let i = 0; i < dimensions; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.setStrokeStyle('#c5cae9');
      ctx.stroke();
      
      ctx.setFontSize(10);
      ctx.setFillStyle('#5c6bc0');
      ctx.fillText(data.indicator[i].name, x + (x > centerX ? 5 : -25), y + (y > centerY ? -5 : 15));
    }
    
    // 绘制数据区域
    ctx.beginPath();
    for (let i = 0; i <= dimensions; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const value = (values[i % values.length] || 0) / 100;
      const x = centerX + radius * value * Math.cos(angle);
      const y = centerY + radius * value * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.setFillStyle('rgba(92, 107, 192, 0.3)');
    ctx.fill();
    ctx.setStrokeStyle('#3f51b5');
    ctx.setLineWidth(2);
    ctx.stroke();
    
    // 绘制数据点
    for (let i = 0; i < dimensions; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const value = (values[i] || 0) / 100;
      const x = centerX + radius * value * Math.cos(angle);
      const y = centerY + radius * value * Math.sin(angle);
      
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.setFillStyle('#fff');
      ctx.fill();
      ctx.setStrokeStyle('#3f51b5');
      ctx.setLineWidth(2);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.setFillStyle(value >= 0.5 ? '#f44336' : (value >= 0.3 ? '#ff9800' : '#4caf50'));
      ctx.fill();
    }
    
    ctx.draw();
  },

  onSelectSchool(e) {
    const index = Number(e.currentTarget.dataset.index);
    const schoolResponses = this.data.actionData.schoolResponses || [];
    const selected = schoolResponses[index];
    if (!selected) return;
    this.setData({
      'actionData.selectedSchoolIndex': index,
      'actionData.selectedAction': selected.action || null
    });
    wx.showToast({ title: `已选择${selected.schoolName}`, icon: 'none' });
  },

  async onSave() {
    const { content, actionData, isSaving } = this.data;
    
    if (!content.trim()) {
      wx.showToast({ title: '请先输入日记内容', icon: 'none' });
      return;
    }
    
    if (isSaving) return;

    this.setData({ isSaving: true });
    wx.showLoading({ title: '保存中...', mask: true });

    try {
      const result = await diaryUtils.saveDiary(content, '', actionData);
      wx.hideLoading();
      this.setData({ isSaving: false });

      if (result) {
        wx.showToast({ title: '保存成功', icon: 'success' });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
    } catch (error) {
      wx.hideLoading();
      this.setData({ isSaving: false });
      wx.showToast({ title: '保存失败', icon: 'none' });
      console.error('保存失败:', error);
    }
  },

  onClearContent() {
    const { content } = this.data;
    
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
                selectedSchoolIndex: 0,
                selectedAction: null
              },
              radarData: null,
              showRadar: false
            });
          }
        }
      });
    }
  }
})