import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { webFetchTool } from "../../src/tools/web-fetch.js";
import { webSearchTool } from "../../src/tools/web-search.js";

declare const global: typeof globalThis & {
  fetch: unknown;
};

describe("Phase 2 web_fetch tool", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetches HTML, converts to markdown, and caches", async () => {
    const html = "<html><body><h1>Title</h1><p>Para</p></body></html>";
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: {
        get: () => null,
      },
      text: async () => html,
    });
    (global as any).fetch = fetchMock;

    const url = "https://example.com";
    const prompt = "summarize";

    const first = await webFetchTool.execute({ url, prompt } as never);
    expect(String(first)).toContain("URL: https://example.com");
    expect(String(first)).toContain("Prompt: summarize");

    const second = await webFetchTool.execute({ url, prompt } as never);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });
});

describe("Phase 2 web_search tool", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("prefers Brave Search API when configured", async () => {
    process.env.BRAVE_API_KEY = "test-key";
    process.env.SERPER_API_KEY = "";
    process.env.SEARXNG_URL = "";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        web: {
          results: [
            { title: "Result 1", url: "https://r1", description: "desc1" },
            { title: "Result 2", url: "https://r2", description: "desc2" },
          ],
        },
      }),
    });
    (global as any).fetch = fetchMock;

    const result = await webSearchTool.execute({ query: "test" } as never);
    expect(String(result)).toContain("Source: Brave Search API");
    expect(String(result)).toContain("[Result 1](https://r1)");
  });

  it("falls back to Serper when Brave is unavailable", async () => {
    process.env.BRAVE_API_KEY = "";
    process.env.SERPER_API_KEY = "serper-key";
    process.env.SEARXNG_URL = "";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        organic: [
          { title: "S1", link: "https://s1", snippet: "s1" },
          { title: "S2", link: "https://s2", snippet: "s2" },
        ],
      }),
    });
    (global as any).fetch = fetchMock;

    const result = await webSearchTool.execute({ query: "test" } as never);
    expect(String(result)).toContain("Source: Serper API");
    expect(String(result)).toContain("[S1](https://s1)");
  });

  it("falls back to SearXNG when others unavailable", async () => {
    process.env.BRAVE_API_KEY = "";
    process.env.SERPER_API_KEY = "";
    process.env.SEARXNG_URL = "https://searx.local";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ title: "X", url: "https://x", content: "cx" }],
      }),
    });
    (global as any).fetch = fetchMock;

    const result = await webSearchTool.execute({ query: "test" } as never);
    expect(String(result)).toContain("Source: SearXNG");
    expect(String(result)).toContain("[X](https://x)");
  });

  it("returns message when no providers configured", async () => {
    process.env.BRAVE_API_KEY = "";
    process.env.SERPER_API_KEY = "";
    process.env.SEARXNG_URL = "";

    (global as any).fetch = vi.fn();

    const result = await webSearchTool.execute({ query: "test" } as never);
    expect(String(result)).toContain("No search provider available");
  });
});

