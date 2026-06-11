// Tier-2 project index (PRD §9.3) — one-line entries linking to GitHub.
export type Tag = 'geo' | 'biz' | 'ai' | 'finance';

export const tagMeta: Record<Tag, { name: string; color: string }> = {
  geo: { name: 'Geo', color: 'var(--dot-geo)' },
  biz: { name: 'Biz', color: 'var(--dot-biz)' },
  ai: { name: 'AI', color: 'var(--dot-ai)' },
  finance: { name: 'Fin', color: 'var(--accent)' },
};

export const projects: { name: string; nameZh: string; desc: string; descZh: string; tags: Tag[]; url: string }[] = [
  {
    name: 'Forest Fire Monitoring',
    nameZh: '森林火灾监测',
    desc: 'CNN detecting forest fires from satellite imagery',
    descZh: '基于卫星影像的 CNN 森林火灾检测',
    tags: ['ai', 'geo'],
    url: 'https://github.com/SigaoLi/UT_DL_Forest_Fire_Monitoring',
  },
  {
    name: 'Portfolio Strategy Optimization',
    nameZh: '投资组合策略优化',
    desc: 'Transformers + genetic algorithms for portfolio construction',
    descZh: 'Transformer + 遗传算法的组合构建',
    tags: ['ai', 'finance'],
    url: 'https://github.com/SigaoLi/UT_AI_Portfolio_Strategy_Optimization',
  },
  {
    name: 'Real-Time Fraud Detection',
    nameZh: '实时欺诈检测',
    desc: 'Streaming credit-card fraud prediction with Spark + Kafka',
    descZh: 'Spark + Kafka 流式信用卡欺诈预测',
    tags: ['biz', 'finance'],
    url: 'https://github.com/SigaoLi/UW_BD_Credit_Card_Fraud_Detection',
  },
  {
    name: 'Truck Demand Forecasting',
    nameZh: '卡车需求预测',
    desc: 'Clustering, PCA and model iteration for assembly demand',
    descZh: '聚类、PCA 与多轮模型迭代的装配需求预测',
    tags: ['biz'],
    url: 'https://github.com/SigaoLi/UT_ML_Demand_Forecasting_for_Truck_Assembly',
  },
  {
    name: 'PureGym Social Analytics',
    nameZh: 'PureGym 社媒分析',
    desc: 'BERT sentiment + topic modelling on gym reviews',
    descZh: 'BERT 情感分析 + 健身房评论主题建模',
    tags: ['biz', 'geo'],
    url: 'https://github.com/SigaoLi/UB_SM_PUREGYM',
  },
  {
    name: 'Stock Price Prediction',
    nameZh: '股价预测',
    desc: 'ARIMA / LSTM / Mixture-of-Experts on AAPL',
    descZh: 'ARIMA / LSTM / 混合专家模型预测苹果股价',
    tags: ['finance'],
    url: 'https://github.com/SigaoLi/UB_DA_Stock_Price_Prediction',
  },
];
