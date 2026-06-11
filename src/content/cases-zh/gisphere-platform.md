---
title: "GISphere 数据平台"
tagline: "从自动化管线到 BI 仪表盘与团队 KPI——为一个全球志愿者组织打造的端到端数据产品。"
year: "2025–2026"
role: "lead"
org: "GISphere"
tags: ["geo", "biz"]
repoUrl: "https://github.com/SigaoLi/GISPHERE_GOOGLE_SHEET"
featured: true
order: 3
metrics:
  - { label: "ETL 管线减少的任务耗时", value: "80%" }
  - { label: "50+ 篇已发布博客的累计阅读量", value: "50k+" }
  - { label: "仪表盘中的可视化维度", value: "10+" }
---

## 挑战

GISphere 为全球受众整理 GIS 研究生项目和就业市场信息，完全由志愿者运营。整个运作建立在电子表格之上：手动录入数据、手动发布微信公众号、对团队正在记录的就业市场缺乏全局视野，也无法判断团队自身的健康状况。

作为 GISource 负责人，我主导了数据基础设施的建设——三个系统共同构成一个产品。

## 方法

**数据采集与发布自动化。** 一条 Python 管线将 Google Sheets 同步至 MySQL，通过 80/10/10 优先级算法筛选内容，自动检测新院校，校验必填字段，生成适配微信的发布内容并发送通知——具备 Gmail→QQ 邮箱自动降级与磁盘故障日志机制。采用模块化的 8 组件架构实现跨平台构建。

**市场分析仪表盘。** 一个 Streamlit + Plotly 仪表盘读取合并后的 MySQL 与 Google Sheets 数据，通过 10+ 个可视化维度呈现全球 GIS 学术就业市场——时间序列、热力图、地图、Sankey 流向图、雷达图——并支持交互式多窗口切片。

**团队 KPI 系统。** 第三层通过复合键（URL + 截止日期）将人工标注的表格数据与数据库匹配，以合理的规则处理模糊截止日期（如"即将截止"→30 天）来计算前置时间指标，并呈现成员贡献排名、每日趋势和地理覆盖情况。

## 影响

基于 Azure 的 ETL 管线由四人团队采用敏捷方法构建，将日常任务耗时削减了 80%。编辑产出达到 50+ 篇已发布博客，累计阅读量超过 50k。比各个部分更重要的是，整体展现了产品思维：一个数据模型同时服务于运营、分析和管理——对于一个靠志愿者工时运转的组织而言，这就是苦差与使命之间的区别。

**技术栈：** Python · MySQL · Google Sheets/Docs API · Streamlit · Plotly · Pandas · Azure · APScheduler
