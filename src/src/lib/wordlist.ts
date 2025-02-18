let localCache: string[] = [];

export async function fetchBip39Wordlist(): Promise<string[]> {
  if (localCache.length > 0) {
    return localCache;
  }
  try {
    const response = await fetch("bip39-english-2048.txt");
    if (!response.ok) {
      throw new Error("Failed to load local bip39 file");
    }
    const text = await response.text();
    localCache = text
      .split("\n")
      .map((w) => w.trim())
      .filter((w) => w);
    return localCache;
  } catch (err) {
    localCache = [];
    return localCache;
  }
}
