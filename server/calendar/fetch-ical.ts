import 'server-only';

export function validateSourceUrl(value: string): string {
  try {
    if (value.length > 4096) throw new Error();
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'www.airbnb.com' || url.username || url.password
      || (url.port && url.port !== '443') || url.hash || !/^\/calendar\/ical\/\d+\.ics$/.test(url.pathname)) throw new Error();
    return url.toString();
  } catch { throw new Error('invalid_calendar_url'); }
}

export async function fetchIcal(value: string, fetcher: typeof fetch = fetch): Promise<string> {
  const url = validateSourceUrl(value);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetcher(url, { redirect: 'error', cache: 'no-store', signal: controller.signal });
    if (!response.ok || response.redirected) throw new Error('calendar_http_error');
    if (Number(response.headers.get('content-length')) > 1_048_576) {
      await response.body?.cancel(); throw new Error('ical_too_large');
    }
    if (!response.body) throw new Error('invalid_ics');
    reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let bytes = 0, result = '';
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (controller.signal.aborted) throw new Error('calendar_timeout');
      if (done) break;
      bytes += chunk.byteLength;
      if (bytes > 1_048_576) throw new Error('ical_too_large');
      result += decoder.decode(chunk, { stream: true });
    }
    return result + decoder.decode();
  } catch (error) {
    if (controller.signal.aborted) throw new Error('calendar_timeout');
    const code = error instanceof Error ? error.message : '';
    throw new Error(['ical_too_large', 'calendar_http_error', 'invalid_ics'].includes(code) ? code : 'calendar_fetch_failed');
  } finally {
    clearTimeout(timer);
    if (reader) { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  }
}
