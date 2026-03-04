import { marked } from "marked";
import TerminalRenderer from "marked-terminal";

/**
 * Configure a singleton marked instance for terminal markdown rendering.
 *
 * We intentionally keep this renderer synchronous so it can be used
 * comfortably during streaming: callers can re-render the full accumulated
 * markdown buffer on each text delta.
 */
const renderer = new TerminalRenderer({
  // Reasonable defaults that map to the requirements in Phase 3.1:
  reflowText: true,
  // Show the language name for fenced code blocks.
  code: (code: string, language: string | undefined) => {
    const langLabel = language ? language : "";
    const header = langLabel ? `\u001b[90m[${langLabel}]\u001b[39m\n` : "";
    // Delegate to the default code renderer for actual formatting, using a
    // narrowed view of the marked-terminal prototype rather than `any`.
    const proto = (TerminalRenderer as unknown as {
      prototype: { code: (code: string, language?: string) => string };
    }).prototype;
    const body = proto.code.call(renderer, code, language);
    return `${header}${body}`;
  },
});

marked.setOptions({
  // marked-terminal will handle translating markdown tokens into ANSI output.
  renderer,
  mangle: false,
  headerIds: false,
});

/**
 * Render arbitrary markdown text into an ANSI-colored string suitable for
 * direct printing in a terminal or within an Ink `<Text>` component.
 *
 * This function is cheap enough to call frequently, so the interactive UI
 * can simply accumulate the assistant's markdown and re-render it on each
 * `text_delta` event for smooth streaming.
 */
export function renderMarkdownToAnsi(markdown: string): string {
  if (!markdown.trim()) {
    return "";
  }

  return marked.parse(markdown) as string;
}

