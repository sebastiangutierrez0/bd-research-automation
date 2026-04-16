/**
 * Reads a fetch Response body as text/event-stream and invokes onEvent for each SSE message.
 */
export async function consumeSseStream(
  response: Response,
  onEvent: (event: string, data: unknown) => void
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      let eventType = "message";
      const dataLines: string[] = [];
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trimStart());
        }
      }
      const dataStr = dataLines.join("\n");
      if (dataStr) {
        try {
          onEvent(eventType, JSON.parse(dataStr) as unknown);
        } catch {
          onEvent(eventType, dataStr);
        }
      }
    }
  }
}
