---
title: "GISphere LLM 分析"
tagline: "一个多模态 LLM 系统，能读懂网页、PDF 和截图，将全球 GIS 学术机会结构化。"
year: "2026"
role: "lead"
org: "GISphere (GIS-Info)"
tags: ["ai", "geo"]
repoUrl: "https://github.com/GIS-Info/GISPHERE_LLM_Analysis"
featured: true
order: 2
metrics:
  - { label: "统一输入源类型数", value: "5" }
  - { label: "分阶段 LLM 分析流水线", value: "3" }
  - { label: "失效 API key 最短自动冷却时间（分钟）", value: "30" }
---

## 挑战

GISphere 的志愿者需要追踪各种学术机会——博士招生、教职空缺、资助申请——它们散落在大学网页、PDF 传单、微信截图和共享表格里。把这些混乱信息变成干净、结构化的数据库，意味着每周要花数小时人工阅读和复制粘贴，数据质量完全取决于录入者是谁。

作为主设计师和开发者，我的目标是让这条流水线能读懂志愿者扔给它的任何东西。

## 方案

**万物皆可读。** 系统能摄入五种来源——网页、PDF、截图、本地 Excel 和 Google Sheets。网页提取用 Playwright 做动态渲染，配合 trafilatura 提取干净文本；文档则依次经过 PyMuPDF → pdfplumber → Tesseract OCR → 视觉语言模型这一链条处理，哪怕是一张扫描版传单，最终也能变成结构化文本。

**三阶段分析。** 提取出的内容会经过一个分阶段的 LLM 流水线：先识别出机会本身，再将其归类到 GIS 各子学科（自然地理、人文地理、城市、GIS、RS、GNSS），最后将结构化信息——截止日期、资助情况、联系方式——直接填入团队表格。

**为不可靠的基础设施而设计。** 模型链网关能在 GPT、Gemini 和 Claude 之间自动降级切换；返回 401/403 的 API key 会进入 30 分钟的断路器冷却期；部分成功的行会保留已完成字段，而不是整行失败；批处理任务能从断点处恢复运行。数据入库前，还会通过 DuckDuckGo/Bing 进行搜索验证，交叉核对信息。

## 影响

该项目以 MIT 许可证在 GIS-Info 组织下发布，用一条有人监督的流水线取代了最枯燥的志愿者工作——人不再负责转录，而是负责核验。它是更宏大的 GISphere 数据平台的智能层，也是一个生产级 LLM 工程的实践样本：将优雅降级、多模态回退和故障隔离作为第一等的设计需求。

**技术栈：** Python · 多模型网关（GPT / Gemini / Claude） · Playwright · trafilatura · PyMuPDF · Tesseract OCR · VLM · Google Sheets API
