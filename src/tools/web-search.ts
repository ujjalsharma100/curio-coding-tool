import { createTool } from "curio-agent-sdk";
import { z } from "zod";

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

function formatResults(results: SearchResult[]): string {
  if (results.length === 0) {
    return "No search results found.";
  }
  return results
    .slice(0, 10)
    .map((item, index) => `${index + 1}. [${item.title}](${item.url})\n   ${item.snippet}`)
    .join("\n");
}

async function searchBrave(query: string): Promise<SearchResult[] | null> {
  const key = process.env.BRAVE_API_KEY;
  if (!key) return null;
  const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": key,
    },
  });
  if (!response.ok) return null;
  const json = (await response.json()) as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
  };
  return (
    json.web?.results?.map((item) => ({
      title: item.title ?? item.url ?? "Untitled",
      url: item.url ?? "",
      snippet: item.description ?? "",
    })) ?? []
  );
}

async function searchSerper(query: string): Promise<SearchResult[] | null> {
  const key = process.env.SERPER_API_KEY;
  if (!key) return null;
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": key,
    },
    body: JSON.stringify({ q: query }),
  });
  if (!response.ok) return null;
  const json = (await response.json()) as {
    organic?: Array<{ title?: string; link?: string; snippet?: string }>;
  };
  return (
    json.organic?.map((item) => ({
      title: item.title ?? item.link ?? "Untitled",
      url: item.link ?? "",
      snippet: item.snippet ?? "",
    })) ?? []
  );
}

async function searchSearxng(query: string): Promise<SearchResult[] | null> {
  const endpoint = process.env.SEARXNG_URL;
  if (!endpoint) return null;
  const response = await fetch(
    `${endpoint.replace(/\/$/, "")}/search?q=${encodeURIComponent(query)}&format=json`,
  );
  if (!response.ok) return null;
  const json = (await response.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };
  return (
    json.results?.map((item) => ({
      title: item.title ?? item.url ?? "Untitled",
      url: item.url ?? "",
      snippet: item.content ?? "",
    })) ?? []
  );
}

export const webSearchTool = createTool({
  name: "web_search",
  description: "Search the web using Brave, Serper, or SearXNG.",
  parameters: z.object({
    query: z.string().describe("Search query"),
  }),
  execute: async ({ query }) => {
    const brave = await searchBrave(query);
    if (brave && brave.length > 0) {
      return `Source: Brave Search API\n${formatResults(brave)}`;
    }

    const serper = await searchSerper(query);
    if (serper && serper.length > 0) {
      return `Source: Serper API\n${formatResults(serper)}`;
    }

    const searxng = await searchSearxng(query);
    if (searxng && searxng.length > 0) {
      return `Source: SearXNG\n${formatResults(searxng)}`;
    }

    return "No search provider available. Set BRAVE_API_KEY, SERPER_API_KEY, or SEARXNG_URL.";
  },
});
