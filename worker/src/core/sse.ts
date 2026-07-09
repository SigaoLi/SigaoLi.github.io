// SSE 中继:上游 OpenAI 流式分块 → 前端简化事件流。
// 前端只需处理两种事件:data: {"delta":"文本"} 与 data: {"done":true,"provider":"..."}。
// 推理模型的 reasoning_content 分块在此丢弃,不下发给访客。

export function relayStream(upstream: ReadableStream<Uint8Array>, providerName: string): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  const emit = (controller: TransformStreamDefaultController<Uint8Array>, payload: unknown) =>
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

  const handleLine = (line: string, controller: TransformStreamDefaultController<Uint8Array>) => {
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim();
    if (data === '[DONE]') {
      emit(controller, { done: true, provider: providerName });
      return;
    }
    try {
      const chunk = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) emit(controller, { delta });
    } catch {
      // 半行不会到这里(buffer 按 \n 切),真解析失败的行直接忽略
    }
  };

  const transform = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        handleLine(line, controller);
      }
    },
    flush(controller) {
      if (buffer.trim()) handleLine(buffer.trim(), controller);
    },
  });

  return upstream.pipeThrough(transform);
}
