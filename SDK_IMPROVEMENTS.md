# SDK Improvements Needed for Curio Code

> Items that the Curio Agent SDK (TypeScript) should add or improve to better support building the Curio Code CLI tool.
> These are NOT blockers — the coding tool can work around all of them — but adding them to the SDK would reduce application-layer complexity and benefit all SDK consumers.

---

## Priority 1 — High Impact, Referenced in Plan but Missing

### 1.1 Google/Gemini LLM Provider

**Status**: Not implemented.
**Impact**: The coding tool plan targets Google Gemini (2.5 Pro, Flash) as a supported provider. Currently only Anthropic, OpenAI, Groq, and Ollama providers exist.

**Recommendation**:
- Add `GeminiProvider` implementing the `LLMProvider` interface
- Support both `GOOGLE_API_KEY` and `GEMINI_API_KEY` environment variables
- Models: `gemini-2.5-pro`, `gemini-2.5-flash`, etc.
- Support streaming, tool calling, and vision/multimodal inputs

### 1.2 PlanState / Plan Mode Support

**Status**: Not implemented. The plan references `PlanState` but it does not exist in the SDK.
**Impact**: Plan mode is a key differentiating feature (Claude Code has it). Without SDK support, the coding tool must implement plan state tracking, tool restriction during plan mode, and plan file management entirely in the application layer.

**Recommendation**:
- Add `PlanState` to `AgentState` — a structured state extension that tracks:
  - `isPlanMode: boolean`
  - `planFilePath: string | null`
  - `planContent: string | null`
  - `planStatus: 'drafting' | 'awaiting_approval' | 'approved' | 'rejected'`
- Add `StateExtension` for plan mode that can restrict tool access when in plan mode (read-only tools only)
- Add `EnterPlanMode` and `ExitPlanMode` as SDK-provided tools or hooks

### 1.3 TodoManager / Task Tracking

**Status**: Not implemented. The plan references `TodoManager` and `Todo` but neither exists in the SDK.
**Impact**: Task tracking is a power feature. Without SDK support, the coding tool must implement task CRUD, dependency tracking, and state management from scratch.

**Recommendation**:
- Add `Todo` model: `{ id, subject, description, status, owner, blockedBy, blocks, metadata }`
- Add `TodoManager` as a `StateExtension`: `create()`, `update()`, `delete()`, `list()`, `get()`
- Add `TaskCreate`, `TaskUpdate`, `TaskList`, `TaskGet` as SDK-provided tools
- Task status workflow: `pending` → `in_progress` → `completed` (plus `deleted`)

### 1.4 StructuredOutput / JSON Mode

**Status**: Not implemented. The plan references `StructuredOutput` but it doesn't exist.
**Impact**: Low urgency for the coding tool (it primarily produces text), but useful for programmatic tool outputs and response parsing.

**Recommendation**:
- Add `StructuredOutput<T>` wrapper that:
  - Sets `responseFormat: { type: "json_object" }` on the LLM request
  - Validates the response against a Zod schema
  - Returns typed `T` instead of raw string
- Support for `agent.run<T>(input, { schema: z.object({...}) })`

---

## Priority 2 — Missing Providers Mentioned in Plan

### 2.1 Additional LLM Providers

The coding tool plan lists these providers that don't exist in the SDK:

| Provider | Env Variable | Notes |
|----------|-------------|-------|
| Google/Gemini | `GOOGLE_API_KEY` / `GEMINI_API_KEY` | Most critical missing provider |
| OpenRouter | `OPENROUTER_API_KEY` | Popular aggregator; OpenAI-compatible API |
| AWS Bedrock | AWS credentials | Enterprise Anthropic/Claude access |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` | Enterprise OpenAI access |
| Mistral | `MISTRAL_API_KEY` | Mistral Large/Medium |
| DeepSeek | `DEEPSEEK_API_KEY` | DeepSeek Coder; OpenAI-compatible API |
| Together AI | `TOGETHER_API_KEY` | Open source models; OpenAI-compatible API |

**Recommendation**: Since OpenRouter, DeepSeek, Together AI, and Mistral all use OpenAI-compatible APIs, the SDK could support a `GenericOpenAIProvider` that takes a custom `baseURL`. This would cover most of these with minimal effort. Only Gemini and Bedrock need dedicated providers.

### 2.2 Custom/Generic OpenAI-Compatible Provider

**Status**: Not implemented as a first-class feature.
**Impact**: Many providers (OpenRouter, Together AI, DeepSeek, vLLM, LM Studio, etc.) expose OpenAI-compatible APIs. A single generic provider would cover them all.

**Recommendation**:
- Add `GenericOpenAIProvider` (or a `baseUrl` option on `OpenAIProvider`)
- Accept: `{ baseUrl, apiKey, defaultModel }` configuration
- Model string format: `custom:model-name` or `openai-compat:model-name`

---

## Priority 3 — Improvements for Better DX

### 3.1 Agent Cancellation / Abort Support

**Status**: `agent.astream()` yields events but there's no documented way to cancel a running agent mid-stream (e.g., when user presses Ctrl+C during generation).
**Impact**: Critical for CLI tools — users must be able to interrupt long-running agent turns.

**Recommendation**:
- Accept an `AbortSignal` in `RunOptions`
- Propagate cancellation to LLM provider calls and tool executions
- Yield a `{ type: "cancelled" }` stream event on abort
- Example: `agent.astream(input, { signal: controller.signal })`

### 3.2 Stream Event: Permission Request

**Status**: The `StreamEvent` union doesn't include permission-related events. When the permission policy requires human input during streaming, there's no way for the UI to know a permission prompt is pending.
**Impact**: The CLI needs to show a confirmation UI when a tool requires permission. Without a stream event, the UI can't react to this.

**Recommendation**:
- Add `{ type: "permission_request"; toolName: string; args: Record<string, unknown>; description: string }` to `StreamEvent`
- Add `{ type: "permission_result"; toolName: string; allowed: boolean }` to `StreamEvent`
- Or expose the `HumanInputHandler` integration point more clearly for streaming contexts

### 3.3 Agent State Snapshots for Resume

**Status**: `checkpointFromState()` and `stateFromCheckpoint()` exist but the serialization of complex tool results (images, binary data) may need attention.
**Impact**: Session resume (`--continue`, `--resume`) requires reliable state serialization.

**Recommendation**:
- Add integration tests for checkpoint round-trip with diverse content types
- Document the checkpoint format and any limitations
- Consider adding a `CompactCheckpoint` format that omits large tool results to save disk space

### 3.4 Token Counting Accuracy

**Status**: `countStringTokens()` and `countMessageTokens()` exist in the SDK but accuracy may vary across providers.
**Impact**: Context window management depends on accurate token counting. The `ContextManager` uses these counts to decide when to truncate.

**Recommendation**:
- Ensure token counting works for Anthropic's tokenizer (cl100k is OpenAI's)
- Add provider-specific token counting or at least document accuracy expectations
- Consider using `tiktoken` for OpenAI models and Anthropic's tokenizer for Claude models

### 3.5 Built-in Tool: File Edit (String Replacement)

**Status**: The SDK has `fileReadTool` and `fileWriteTool` but no `fileEditTool` (exact string replacement). The coding tool needs this as a core tool.
**Impact**: Low — the coding tool will implement its own `file-edit` tool anyway. But since exact-string-replacement editing is universally useful, it could be an SDK built-in.

**Recommendation**:
- Add `createFileEditTool()` to SDK built-in tools
- Parameters: `{ file_path, old_string, new_string, replace_all }`
- Uniqueness validation, indentation preservation, diff output

### 3.6 Built-in Tool: Glob (File Pattern Matching)

**Status**: Not in SDK built-in tools.
**Impact**: Same as file-edit — the coding tool will implement it, but it's universally useful.

**Recommendation**:
- Add `createGlobTool()` with `fast-glob` or native glob support
- Parameters: `{ pattern, path?, ignore? }`
- Respect `.gitignore` by default

### 3.7 Built-in Tool: Grep (Content Search)

**Status**: Not in SDK built-in tools.
**Impact**: Same as above.

**Recommendation**:
- Add `createGrepTool()` that wraps ripgrep (child process) or falls back to JS regex
- Parameters: `{ pattern, path?, glob?, type?, output_mode, context_lines }`

---

## Priority 4 — Nice to Have

### 4.1 AgentCLI Enhancements

The existing `AgentCLI` in the SDK is a functional REPL but minimal compared to what Curio Code needs. Rather than enhancing the SDK's CLI, the coding tool will likely build its own UI layer with Ink. The SDK's `AgentCLI` is still useful as a reference and for simpler agents.

### 4.2 Middleware: Request/Response Logging with Redaction

**Status**: `LoggingMiddleware` exists but it's unclear if it redacts API keys from logged request headers.
**Recommendation**: Ensure API keys and sensitive headers are always redacted in logs.

### 4.3 Event Bus: Typed Event Subscriptions

**Status**: `EventBus` accepts string event names. Could benefit from stronger typing.
**Recommendation**: Use template literal types or enum-based event names for type safety.

### 4.4 Provider Health Checks

**Status**: No built-in way to test if a provider's API key is valid before making the first request.
**Recommendation**: Add `provider.healthCheck()` that makes a minimal API call to verify credentials.

---

## Summary Table

| Item | Priority | Effort | Blocking? |
|------|----------|--------|-----------|
| Google/Gemini Provider | P1 | Medium | No — can use other providers |
| PlanState | P1 | Medium | No — coding tool implements it |
| TodoManager | P1 | Medium | No — coding tool implements it |
| StructuredOutput | P1 | Low | No — rarely needed for CLI |
| Generic OpenAI-Compatible Provider | P2 | Low | No — limits provider support |
| Additional Providers (Bedrock, Azure, etc.) | P2 | Medium each | No |
| Agent Cancellation (AbortSignal) | P3 | Medium | No — but important for UX |
| Permission Stream Events | P3 | Low | No — workaround via hooks |
| File Edit Tool | P3 | Low | No — coding tool builds its own |
| Glob Tool | P3 | Low | No — coding tool builds its own |
| Grep Tool | P3 | Low | No — coding tool builds its own |
| Token Counting Accuracy | P3 | Medium | No — but affects context management |
| Provider Health Checks | P4 | Low | No |

**None of these are blockers.** The SDK is ready for the coding tool to begin implementation. These improvements would reduce application-layer code and benefit all SDK consumers over time.
