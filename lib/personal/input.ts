export async function readInput(request: Request) {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw Error("invalid_content_type");
  if (Number(request.headers.get("content-length") ?? 0) > 32000)
    throw Error("too_large");
  if (!request.body) throw Error("empty_body");
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let text = "",
    bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 32000) {
        await reader.cancel();
        throw Error("too_large");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  if (text.length > 16000) throw Error("too_large");
  return JSON.parse(text) as unknown;
}
