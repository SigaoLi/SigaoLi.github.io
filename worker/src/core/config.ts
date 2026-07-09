// 费用护栏(PRD §22.4「费用四件套」的请求侧三件;第四件 = 各提供商后台的额度硬顶)。

export const LIMITS = {
  /** 单会话轮数上限(按 user 消息数计,超出要求访客刷新重开) */
  maxTurns: 12,
  /** 单条用户消息长度上限(字符) */
  maxUserChars: 2000,
  /** 传给模型的历史总长上限(字符,超出从最旧开始丢弃) */
  maxHistoryChars: 16000,
  /** 单次回复 max_tokens;注意:推理模型(deepseek-v4 系/gpt-5-mini)须 ≥1000,否则空回复(实测坑) */
  maxTokens: 1200,
  /** 上游建立连接+返回响应头的超时;超时视同该提供商失败,回退链切下一家(拿到流后即解除,不限制流本身时长) */
  upstreamConnectMs: 30_000,
};

/** 知识包 isolate 内存缓存时长 */
export const KNOWLEDGE_TTL_MS = 10 * 60 * 1000;
