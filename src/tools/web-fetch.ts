import TurndownService from "turndown";
import { createTool } from "curio-agent-sdk";
import { z } from "zod";

const FETCH_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 5;
const MAX_MARKDOWN_SIZE = 50 * 1024;
const CACHE_TTL_MS = 15 * 60 * 1000;

interface CacheEntry {
  createdAt: number;
  value: string;
}

const cache = new Map<string, CacheEntry>();
const turndown = new TurndownService();

function truncateLarge(content: string): string {
  if (content.length <= MAX_MARKDOWN_SIZE) {
    return content;
  }
  return `${content.slice(0, MAX_MARKDOWN_SIZE)}\n\n[truncated - content exceeded 50KB]`;
}

async function fetchWithRedirects(url: string): Promise<{ markdown: string; hostChanged: boolean }> {
  let currentUrl = url;
  let redirects = 0;
  const originalHost = new URL(url).host;
  let hostChanged = false;

  while (redirects <= MAX_REDIRECTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          throw new Error("Redirect response missing location header.");
        }
        const nextUrl = new URL(location, currentUrl).toString();
        if (new URL(nextUrl).host !== originalHost) {
          hostChanged = true;
        }
        redirects += 1;
        currentUrl = nextUrl;
        continue;
      }

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const html = await response.text();
      return { markdown: turndown.turndown(html), hostChanged };
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(`Too many redirects (>${MAX_REDIRECTS}).`);
}

export const webFetchTool = createTool({
  name: "web_fetch",
  description: "Fetch a URL and return markdown content with redirect awareness and caching.",
  parameters: z.object({
    url: z.string().url().describe("URL to fetch"),
    prompt: z.string().describe("What to extract from the page"),
  }),
  execute: async ({ url, prompt }) => {
    const cacheKey = `${url}::${prompt}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt <= CACHE_TTL_MS) {
      return cached.value;
    }

    try {
      const { markdown, hostChanged } = await fetchWithRedirects(url);
      const result = [
        `URL: ${url}`,
        `Prompt: ${prompt}`,
        hostChanged ? "Redirect note: host changed during redirect chain." : "Redirect note: no host change.",
        "",
        truncateLarge(markdown),
      ].join("\n");
      cache.set(cacheKey, { createdAt: Date.now(), value: result });
      return result;
    } catch (error) {
      return `Failed to fetch URL: ${(error as Error).message}`;
    }
  },
});
