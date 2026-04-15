# WeChat Mini Program - 微光日记 (Glimmer Journal)

## 🔑 Key Commands
- **Install deps**: `npm install` (in root)
- **Build**: Use WeChat DevTools (no npm build script)
- **Dev server**: WeChat DevTools auto-reloads on file save
- **Deploy**: Via WeChat DevTools upload → submit for review

## 📁 Project Structure
- `测试/` - Miniprogram source (app.js, pages/, components/)
- `云函数/` - Backend cloud functions (analyzeDiary, etc.)
- `miniprogram_npm/` - Built npm dependencies (vant-weapp, echarts-for-weixin)
- `node_modules/` - Root dependencies (wx-server-sdk, etc.)

## 🧠 Core Architecture
1. **Entry Point**: Home page (`测试/pages/index/index`) - Warm welcome interface with app introduction
2. **Input Layer**: User enters text diary entry (on diary page)
3. **Multi-Perspective Engine**: Cloud function analyzes text via AI, returns:
   - Emotion scores (10 dimensions: happy, sad, angry, etc.)
   - Dominant emotion
   - AI-generated counseling response from matched psychology school
   - Summary text
4. **Selection Layer**: User chooses preferred psychological perspective
5. **Action Layer**: Generates 5-minute micro-action task
6. **Visualization**: Radar chart shows emotion distribution across dimensions

## ☁️ Cloud Function Details
- `analyzeDiary`: Main entry point
  - Calls `analyzeEmotions()` (keyword-based simulation - replace with real AI API)
  - Generates radar data format for ECharts
  - Maps emotion to psychology school & response
- **Real AI Integration**: Replace `analyzeEmotions()` with:
  - Tencent Hunyuan / OpenAI / Wenxin / Tongyi Qianwei API
  - Return structured emotion scores + summary

## 📱 Miniprogram Specifics
- **Framework**: WeChat Miniprogram (WXML/WXSS/JS)
- **UI Library**: Vant Weapp (in `miniprogram_npm/vant-weapp`)
- **Charts**: ECharts for Weixin (`echarts-for-weixin`)
- **Cloud DB**: `wx.cloud.database()` for diary storage
- **Storage**: `wx.getStorageSync()` for user settings
- **Canvas**: Radar chart uses wx.createCanvasContext()

## 🧩 Important Files
- `测试/app.js` - App lifecycle, cloud init
- `测试/pages/index/index` - **Home page**: Welcome interface with feature highlights and start button
- `测试/pages/diary/diary.js` - Main page: input, analysis, saving, chart rendering
- `测试/utils/diary.js` - Data models & cloud storage helpers
- `云函数/analyzeDiary/index.js` - Backend emotion analysis & response generation
- `project.config.json` - Miniprogram config (npm handling, appid)

## ⚠️ Gotchas
- **NPM handling**: `packNpmManually: true` + `packNpmRelationList` in project.config
- **Cloud env**: Requires valid WeChat Cloud environment ID in app.js
- **Real AI needed**: Current emotion analysis is keyword simulation
- **No tests**: Project lacks test setup - manual verification only
- **WeChat DevTools**: Required for development & deployment

## 🔧 Psychology Schools Implemented
- CBT (认知行为疗法) - 思维纠偏
- ACT (接纳承诺疗法) - 接纳现实，承诺行动  
- 积极心理学 - 关注优势与幸福感
- 叙事疗法 - 问题外化
- Plus additional schools in cloud function: 人本主义, 精神分析, 正念疗法, etc.

## 📱 User Flow
1. **Home Page**: View warm welcome & feature overview → Tap "开始记录" (Start Recording)
2. **Diary Page**: Input text diary entry → Tap "分析" (Analyze)
3. **Analysis Results**: View multi-perspective responses + radar chart → Select preferred perspective
4. **Action Display**: View 5-minute micro-action → Tap "保存" (Save)
5. **Save & Exit**: Diary saved to cloud → Return to home page