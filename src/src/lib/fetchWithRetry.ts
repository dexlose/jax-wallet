const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000;

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = MAX_RETRIES
): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        if (attempt < retries) {
          const delay = RETRY_DELAY_BASE * 2 ** attempt;
          await new Promise((res) => setTimeout(res, delay));
          continue;
        } else {
          throw new Error("Too Many Requests (429): " + url);
        }
      }
      if (response.status === 404) {
        return {};
      }
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        if (attempt < retries) {
          const delay = RETRY_DELAY_BASE * 2 ** attempt;
          await new Promise((res) => setTimeout(res, delay));
          continue;
        } else {
          return {};
        }
      }
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} for url: ${url}`);
      }
      return await response.json();
    } catch (error) {
      if (attempt === retries) {
        console.error("[fetchWithRetry] Gave up after", attempt, "attempts:", error);
        return {};
      }
    }
  }
}
