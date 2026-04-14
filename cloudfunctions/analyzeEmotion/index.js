// 云函数入口文件
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 创建 DeepSeek 模型实例
const model = cloud.extend.AI.createModel("deepseek");

exports.main = async (event, context) => {
  // 1. 记录开始和接收到的参数
  console.log('=== 云函数 analyzeEmotion 开始执行 ===');
  console.log('接收到前端参数:', event);

  const userContent = event.userInput;

  // 2. 校验输入
  if (!userContent || typeof userContent !== 'string') {
    console.error('错误：输入内容无效', userContent);
    return {
      code: -1,
      msg: '输入内容无效'
    };
  }

  // 3. 设定系统提示词
  const systemPrompt = `你是一位专业的心理学助手。你的任务是根据用户输入的文本，分析其情绪状态。
请严格按照以下 JSON 格式返回结果，不要包含任何其他解释或标记：
{
  "primary_emotion": "主要情绪，如：快乐、悲伤、愤怒、焦虑、平静",
  "intensity": "情绪强度，值为 1 到 5 的整数，5 表示非常强烈",
  "analysis": "用一句话简要分析用户可能的心理状态，并提供一个小建议。"
}`;

  try {
    // 4. 调用大模型（关键步骤）
    console.log('准备调用 AI 模型，用户输入:', userContent);
    
    const res = await model.generateText({
      data: {
        model: "deepseek-r1",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `请分析这段文本的情绪：${userContent}` }
        ],
      },
    });

    // 5. 检查 AI 返回结果
    console.log('AI 模型返回原始数据:', JSON.stringify(res));

    if (!res || !res.result) {
      console.error('错误：AI 模型返回数据异常', res);
      return {
        code: -2,
        msg: 'AI 模型返回数据异常'
      };
    }

    // 6. 解析 AI 返回的文本
    const aiResponseText = res.result;
    console.log('AI 返回文本:', aiResponseText);
    
    // 尝试提取 JSON（处理可能包含的 markdown 标记）
    let jsonString = aiResponseText;
    const jsonMatch = aiResponseText.match(/```json\n([\s\S]*?)\n```/) || 
                      aiResponseText.match(/{[\s\S]*}/);
    if (jsonMatch) {
      jsonString = jsonMatch[1] || jsonMatch[0];
    }
    
    const analysisResult = JSON.parse(jsonString);
    console.log('解析后的分析结果:', analysisResult);

    // 7. 返回成功结果
    return {
      code: 0,
      data: analysisResult
    };

  } catch (err) {
    // 8. 捕获所有错误并打印详细堆栈
    console.error('云函数执行出错：', err);
    console.error('错误堆栈：', err.stack);
    
    return {
      code: -3,
      msg: err.message || '云函数内部错误'
    };
  }
};