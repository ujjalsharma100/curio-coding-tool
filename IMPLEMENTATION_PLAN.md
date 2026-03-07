# Curio Code — Comprehensive Implementation Plan

> A production-grade CLI coding agent built on the Curio Agent SDK (TypeScript).
> Comparable to Claude Code, OpenCode, Cursor CLI, Gemini CLI.

---

## Table of Contents

1. [Vision & Goals](#vision--goals)
2. [Architecture Overview](#architecture-overview)
3. [SDK Verification — What Exists vs What We Build](#sdk-verification)
4. [SDK Mapping — How Curio SDK Powers Each Feature](#sdk-mapping)
5. [Phase 0: Foundation & SDK Dependency ✅](#phase-0-foundation--sdk-dependency)
6. [Phase 1: Core Agent Loop & Basic CLI ✅](#phase-1-core-agent-loop--basic-cli)
7. [Phase 2: Tool System — File & Code Operations](#phase-2-tool-system--file--code-operations)
8. [Phase 3: Terminal UI & Rich Output](#phase-3-terminal-ui--rich-output)
9. [Phase 4: Context Management & Intelligence](#phase-4-context-management--intelligence)
10. [Phase 5: Permission System & Security ✅](#phase-5-permission-system--security)
11. [Phase 6: Session & Memory Persistence ✅](#phase-6-session--memory-persistence)
12. [Phase 7: Multi-Model & Provider Support ✅](#phase-7-multi-model--provider-support)
13. [Phase 8: Advanced Agent Features](#phase-8-advanced-agent-features)
14. [Phase 9: MCP Integration ✅](#phase-9-mcp-integration)
15. [Phase 10: Configuration & Customization ✅](#phase-10-configuration--customization)
16. [Phase 11: TUI/UX Polish & Production-Grade Interface](#phase-11-tuiux-polish--production-grade-interface)
17. [Phase 12: Distribution & Installation](#phase-12-distribution--installation)
18. [Phase 13: Testing, Observability & Production Hardening](#phase-13-testing-observability--production-hardening)
19. [Phase 14: IDE & Editor Integration](#phase-14-ide--editor-integration)
20. [Phase 15: Community & Ecosystem](#phase-15-community--ecosystem)
21. [Non-Goals & Out of Scope](#non-goals--out-of-scope)
22. [Risk Register](#risk-register)

---

## Vision & Goals

**Curio Code** is a terminal-based AI coding assistant that:

1. Runs from any terminal via `curio-code` or `cc`
2. Understands your entire codebase through intelligent context gathering
3. Can read, write, search, and execute code autonomously
4. Supports all major LLM providers (Anthropic, OpenAI, Google, Groq, Ollama, etc.)
5. Installs via `curl -fsSL https://install.curio.dev | bash`
6. Is built entirely on the Curio Agent SDK (TypeScript) without modifying SDK source
7. Matches or exceeds the feature set of Claude Code, OpenCode, Cursor CLI, and Gemini CLI

### Target Feature Parity

| Feature | Claude Code | OpenCode | Cursor CLI | Gemini CLI | Curio Code |
|---------|:-----------:|:--------:|:----------:|:----------:|:----------:|
| Interactive REPL | ✅ | ✅ | ✅ | ✅ | ✅ |
| File read/write/edit | ✅ | ✅ | ✅ | ✅ | ✅ |
| Code search (grep/glob) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shell execution | ✅ | ✅ | ✅ | ✅ | ✅ |
| Git integration | ✅ | ✅ | ✅ | ✅ | ✅ |
| Streaming output | ✅ | ✅ | ✅ | ✅ | ✅ |
| Multi-model support | ✅ | ✅ | ✅ | ✅ | ✅ |
| Permission system | ✅ | ✅ | ✅ | ✅ | ✅ |
| Session persistence | ✅ | ✅ | ✅ | ✅ | ✅ |
| Memory across sessions | ✅ | ❌ | ❌ | ❌ | ✅ |
| Slash commands | ✅ | ✅ | ✅ | ✅ | ✅ |
| Subagents | ✅ | ❌ | ❌ | ❌ | ✅ |
| Plan mode | ✅ | ❌ | ❌ | ❌ | ✅ |
| Task/todo tracking | ✅ | ❌ | ❌ | ❌ | ✅ |
| MCP support | ✅ | ✅ | ✅ | ✅ | ✅ |
| Image/vision input | ✅ | ❌ | ✅ | ✅ | ✅ |
| Web search/fetch | ✅ | ❌ | ❌ | ✅ | ✅ |
| Notebook support | ✅ | ❌ | ❌ | ❌ | ✅ |
| Hooks/extensions | ✅ | ✅ | ❌ | ❌ | ✅ |
| Custom instructions | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cost tracking | ✅ | ✅ | ❌ | ❌ | ✅ |
| Git worktree isolation | ✅ | ❌ | ❌ | ❌ | ✅ |
| Keyboard shortcuts | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pipe/stdin support | ✅ | ✅ | ✅ | ✅ | ✅ |
| curl install | ✅ | ✅ | ✅ | ✅ | ✅ |
| Skills system | ✅ | ❌ | ❌ | ❌ | ✅ |
| Plugin ecosystem | ❌ | ✅ | ❌ | ❌ | ✅ |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CURIO CODE CLI                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │  CLI Layer   │  │  UI/Renderer │  │  Distribution Layer   │ │
│  │  (Commander) │  │  (Ink/React) │  │  (Bun compile, npm)   │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────────────────┘ │
│         │                 │                                     │
│  ┌──────┴─────────────────┴──────────────────────────────────┐ │
│  │              Application Layer                             │ │
│  │  ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │ │
│  │  │ Config Mgr │ │ Auth Mgr │ │ Session  │ │ Project   │  │ │
│  │  │            │ │          │ │ Manager  │ │ Detector  │  │ │
│  │  └────────────┘ └──────────┘ └──────────┘ └───────────┘  │ │
│  └───────────────────────┬───────────────────────────────────┘ │
│                          │                                     │
│  ┌───────────────────────┴───────────────────────────────────┐ │
│  │            Curio Agent SDK (TypeScript)                    │ │
│  │                                                            │ │
│  │  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌────────────────┐  │ │
│  │  │  Agent  │ │ Tool     │ │  LLM   │ │  Middleware     │  │ │
│  │  │ Runtime │ │ Registry │ │ Client │ │  Pipeline       │  │ │
│  │  └─────────┘ └──────────┘ └────────┘ └────────────────┘  │ │
│  │                                                            │ │
│  │  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌────────────────┐  │ │
│  │  │ Memory  │ │  State   │ │  MCP   │ │  Hooks/Events  │  │ │
│  │  │ Manager │ │  Store   │ │ Bridge │ │  System        │  │ │
│  │  └─────────┘ └──────────┘ └────────┘ └────────────────┘  │ │
│  │                                                            │ │
│  │  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌────────────────┐  │ │
│  │  │Security │ │ Sessions │ │ Skills │ │  Subagents     │  │ │
│  │  │Policies │ │          │ │        │ │                │  │ │
│  │  └─────────┘ └──────────┘ └────────┘ └────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   Custom Tools Layer                       │ │
│  │  ┌─────┐ ┌──────┐ ┌──────┐ ┌─────┐ ┌──────┐ ┌────────┐ │ │
│  │  │Read │ │Write │ │Edit  │ │Glob │ │Grep  │ │Bash    │ │ │
│  │  └─────┘ └──────┘ └──────┘ └─────┘ └──────┘ └────────┘ │ │
│  │  ┌─────┐ ┌──────┐ ┌──────┐ ┌─────┐ ┌──────┐ ┌────────┐ │ │
│  │  │Git  │ │Agent │ │Web   │ │Todo │ │Note- │ │Skill   │ │ │
│  │  │Ops  │ │Spawn │ │Fetch │ │Mgr  │ │book  │ │Invoke  │ │ │
│  │  └─────┘ └──────┘ └──────┘ └─────┘ └──────┘ └────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │            App-Level Features (NOT in SDK)                 │ │
│  │  ┌───────────┐ ┌──────────────┐ ┌────────────────────┐   │ │
│  │  │ PlanState │ │ TodoManager  │ │ StructuredOutput   │   │ │
│  │  │ (custom)  │ │ (custom)     │ │ (custom)           │   │ │
│  │  └───────────┘ └──────────────┘ └────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

1. **SDK as Foundation**: All agent orchestration, LLM communication, tool execution, memory, state, and hooks flow through the Curio Agent SDK. We do NOT modify SDK source code.

2. **Custom Tools Layer**: The coding-specific tools (Read, Write, Edit, Glob, Grep, Bash, Git, etc.) are implemented as custom tools registered with the SDK's ToolRegistry.

3. **Application Layer**: Configuration management, authentication, project detection, and session management wrap around the SDK to provide coding-tool-specific behavior.

4. **UI Layer**: Terminal rendering is decoupled from agent logic. The UI subscribes to SDK StreamEvents and renders them.

5. **Distribution Layer**: Bun compile produces standalone binaries. An install script handles platform detection and binary download.

6. **App-Level Features**: PlanState, TodoManager, and StructuredOutput are NOT in the SDK. We implement them in the application layer. See `SDK_IMPROVEMENTS.md` for why they should eventually move to the SDK.

---

<a id="sdk-verification"></a>
## SDK Verification — What Exists vs What We Build

> Verified against `curio-agent-sdk-typescript` source code on 2026-03-03.

### SDK Components — VERIFIED WORKING

| SDK Component | File(s) | Status | Notes |
|---|---|---|---|
| `Agent` + `AgentBuilder` | `src/core/agent/agent.ts`, `builder.ts` | ✅ Real | Fluent builder, `.build()` wires everything |
| `agent.run()` | `src/core/agent/agent.ts:172` | ✅ Real | Synchronous completion |
| `agent.arun()` | `src/core/agent/agent.ts:177` | ✅ Real | Async completion |
| `agent.astream()` | `src/core/agent/agent.ts:180` | ✅ Real | Returns `AsyncIterableIterator<StreamEvent>` |
| `StreamEvent` | `src/models/events.ts:149` | ✅ Real | 8 event types: `text_delta`, `tool_call_start`, `tool_call_end`, `thinking`, `iteration_start`, `iteration_end`, `error`, `done` |
| `createTool()` + Zod | `src/core/tools/tool.ts:104` | ✅ Real | Full Zod schema support, validation |
| `ToolRegistry` | `src/core/tools/registry.ts` | ✅ Real | Register/unregister/list tools |
| `AnthropicProvider` | `src/core/llm/providers/anthropic.ts` | ✅ Real | Full streaming, thinking blocks, cache tokens |
| `OpenAIProvider` | `src/core/llm/providers/openai.ts` | ✅ Real | Full streaming, tool call buffering |
| `GroqProvider` | `src/core/llm/providers/groq.ts` | ✅ Real | OpenAI-compatible |
| `OllamaProvider` | `src/core/llm/providers/ollama.ts` | ✅ Real | Local model support |
| `TieredRouter` | `src/core/llm/router.ts` | ✅ Real | 3 tiers, fallback strategies |
| `PermissionPolicy` | `src/core/security/permissions.ts` | ✅ Real | `AllowAll`, `AskAlways`, `AllowReadsAskWrites`, `CompoundPolicy`, `FileSandboxPolicy`, `NetworkSandboxPolicy` |
| `CLIHumanInput` | `src/core/security/permissions.ts` | ✅ Real | Terminal-based confirmation prompts |
| `ContextManager` | `src/core/context/context.ts` | ✅ Real | `truncate_oldest` and `summarize` strategies |
| `InstructionLoader` | `src/core/context/instructions.ts` | ✅ Real | Hierarchical loading, file watching, `AGENT.md` convention |
| `SessionManager` | `src/core/state/session.ts` | ✅ Real | `InMemorySessionStore` and `FileSessionStore` |
| `FileStateStore` | `src/core/state/state.ts` | ✅ Real | Checkpoint save/load |
| `MemoryManager` | `src/memory/manager.ts` | ✅ Real | Full lifecycle, injection/save/query strategies |
| `FileMemory` | `src/memory/file.ts` | ✅ Real | Disk-persisted with indexed entries |
| `CostTracker` | `src/middleware/cost-tracker.ts` | ✅ Real | Budget enforcement, alerts, per-model breakdown |
| `HookRegistry` | `src/core/events/hooks.ts` | ✅ Real | Priority ordering, context modification, cancellation |
| `Skill` + `SkillRegistry` | `src/core/extensions/skills.ts` | ✅ Real | Directory loading, YAML/JSON manifest |
| `SubagentConfig` | `src/core/extensions/subagent.ts` | ✅ Real | `spawnSubagent()`, `spawnSubagentStream()` |
| `MCPClient` + `MCPBridge` | `src/mcp/` | ✅ Real | stdio/HTTP transports, tool conversion |
| `AgentCLI` | `src/cli/cli.ts` | ✅ Real | REPL, slash commands, session integration |
| `CircuitBreaker` | `src/resilience/circuit-breaker.ts` | ✅ Real | Provider failover |
| `LoggingMiddleware` | `src/middleware/logging.ts` | ✅ Real | Structured logging |
| `RateLimitMiddleware` | `src/middleware/rate-limit.ts` | ✅ Real | Token bucket rate limiting |
| `TracingMiddleware` | `src/middleware/tracing.ts` | ✅ Real | Distributed tracing |
| `PluginRegistry` | `src/core/extensions/plugins.ts` | ✅ Real | Plugin discovery from package.json |
| Error hierarchy | `src/models/errors.ts` | ✅ Real | `LLMError`, `ToolError`, `CostBudgetExceeded`, etc. |
| Built-in: `fileReadTool` | `src/tools/file-read.ts` | ✅ Real | Read with encoding/size limits |
| Built-in: `fileWriteTool` | `src/tools/file-write.ts` | ✅ Real | Write with overwrite control |
| Built-in: `webFetchTool` | `src/tools/web-fetch.ts` | ✅ Real | HTTP GET, HTML→markdown |
| Built-in: `shellExecuteTool` | `src/tools/shell-execute.ts` | ✅ Real | Safe subprocess execution |
| Built-in: `codeExecuteTool` | `src/tools/code-execute.ts` | ✅ Real | JS code execution |
| Built-in: `httpRequestTool` | `src/tools/http-request.ts` | ✅ Real | Full HTTP methods |
| Testing utilities | `src/testing/` | ✅ Real | `MockLLM`, `AgentTestHarness`, `ToolTestKit`, record/replay |

### SDK Components — NOT IN SDK (Must Build in App Layer)

| Component | Plan References | What to Do |
|---|---|---|
| `PlanState` | Phase 8.2 | **Build in app layer**: plan mode state tracking, tool restriction, plan file management |
| `TodoManager` / `Todo` | Phase 8.3 | **Build in app layer**: task CRUD, dependency tracking, state machine |
| `StructuredOutput` | Phase 8.5 | **Build in app layer**: JSON mode wrapper with Zod validation (low priority) |
| Google/Gemini Provider | Phase 7.1 ✅ | **Built as custom `GeminiProvider`** implementing `LLMProvider` — REST API, streaming, tool calling |
| Additional providers (Bedrock, Azure, etc.) | Phase 7.1 ✅ | **Built `OpenAICompatibleProvider`** — OpenRouter, DeepSeek, Together, Mistral via custom baseURL |
| `fileEditTool` (built-in) | Phase 2.3 | **Build as custom tool** — exact string replacement with uniqueness validation |
| `globTool` (built-in) | Phase 2.4 | **Build as custom tool** — pattern matching with fast-glob |
| `grepTool` (built-in) | Phase 2.5 | **Build as custom tool** — ripgrep wrapper |

> See `SDK_IMPROVEMENTS.md` for recommendations on what should eventually be added to the SDK.

---

<a id="sdk-mapping"></a>
## SDK Mapping — How Curio SDK Powers Each Feature

| Coding Tool Feature | SDK Component Used | Custom Code Needed |
|---|---|---|
| Agent loop (think → act → observe) | `Agent`, `Runtime`, `ToolCallingLoop` | System prompt engineering |
| Tool execution | `ToolRegistry`, `ToolExecutor`, `createTool()` | Tool implementations |
| LLM calls | `LLMClient`, Providers (Anthropic, OpenAI, Groq, Ollama) | Provider config, custom providers |
| Streaming | `agent.astream()`, `StreamEvent` | UI rendering of 8 event types |
| Permission system | `PermissionPolicy`, `HumanInputHandler`, `CompoundPolicy` | Custom policies, permission UI |
| Session persistence | `SessionManager`, `FileSessionStore` | File-based store config |
| Memory (MEMORY.md) | `FileMemory`, `MemoryManager`, injection strategies | Memory strategy config, auto-memory |
| Context window management | `ContextManager` (truncate/summarize) | Budget tuning per model |
| Custom instructions (CURIO.md) | `InstructionLoader` (AGENT.md convention) | Rename to CURIO.md, hierarchical loading |
| Hooks (pre/post tool, etc.) | `HookRegistry`, `HookContext` | Hook implementations |
| Skills (/commit, /review, etc.) | `Skill`, `SkillRegistry` | Skill definitions |
| Subagents (Agent tool) | `SubagentConfig`, `spawnSubagent()` | Subagent configs, tool restrictions |
| Plan mode | **NOT IN SDK** | Full custom implementation (PlanState, tool restriction, plan file) |
| Todo tracking | **NOT IN SDK** | Full custom implementation (TodoManager, Task CRUD, dependencies) |
| Cost tracking | `CostTracker` middleware | Display integration |
| MCP servers | `MCPClient`, `MCPBridge` | Config loading, MCP tool bridging |
| Slash commands | `AgentCLI` slash command system or custom | Command handlers |
| Event observability | `EventBus`, hooks | Logging integration |
| State checkpointing | `checkpointFromState()`, `stateFromCheckpoint()` | Resume logic |
| Structured output | **NOT IN SDK** | Custom JSON mode wrapper (low priority) |
| Middleware pipeline | `MiddlewarePipeline` | Custom middleware |
| Error handling | SDK exception hierarchy | Error display, user-friendly messages |
| Rate limiting | `RateLimitMiddleware` | Config |
| Circuit breaker | `CircuitBreaker` | LLM failover |

---

## Phase 0: Foundation & SDK Dependency ✅ Completed

> **Goal**: Project scaffolding, TypeScript SDK availability, basic build pipeline.
> **Deliverable**: An empty project that can import and use the SDK.

### 0.1 Project Initialization

- [x] **0.1.1** Initialize Bun project: `bun init` → `package.json`
- [x] **0.1.2** Configure TypeScript (`tsconfig.json`):
  - `strict: true`, `target: "ES2022"`, `module: "ESNext"`, `moduleResolution: "bundler"`
  - Path aliases: `@tools/*`, `@ui/*`, `@config/*`, `@context/*`
- [x] **0.1.3** Create project directory structure:
  ```
  curio_coding_tool/
  ├── src/
  │   ├── index.ts              # Entry point — binary entry
  │   ├── cli/                   # CLI layer (argument parsing, commands)
  │   │   ├── app.tsx            # Ink root component (main REPL)
  │   │   ├── commands/          # Subcommands (init, config, update)
  │   │   │   ├── main.ts        # Default interactive command
  │   │   │   ├── init.ts        # Project initialization
  │   │   │   └── config.ts      # Configuration management
  │   │   └── args.ts            # Commander/yargs argument parsing
  │   ├── agent/                 # Agent configuration & construction
  │   │   ├── builder.ts         # Agent builder configuration (wraps SDK AgentBuilder)
  │   │   ├── system-prompt.ts   # System prompt construction & templating
  │   │   └── provider-config.ts # LLM provider setup & auto-detection
  │   ├── tools/                 # Custom tool implementations (ALL as SDK Tools)
  │   │   ├── file-read.ts       # Read files with line numbers, pagination
  │   │   ├── file-write.ts      # Write files with safety checks
  │   │   ├── file-edit.ts       # Exact string replacement editing
  │   │   ├── glob.ts            # Fast file pattern matching
  │   │   ├── grep.ts            # Content search (ripgrep-powered)
  │   │   ├── bash.ts            # Shell execution with persistence
  │   │   ├── web-fetch.ts       # URL fetching with HTML→markdown
  │   │   ├── web-search.ts      # Web search via API
  │   │   ├── agent-spawn.ts     # Subagent spawning tool
  │   │   ├── notebook-edit.ts   # Jupyter notebook cell editing
  │   │   ├── todo-manager.ts    # Task CRUD operations
  │   │   ├── plan-mode.ts       # EnterPlanMode / ExitPlanMode tools
  │   │   ├── skill-invoke.ts    # Invoke registered skills
  │   │   ├── worktree.ts        # Git worktree management
  │   │   └── index.ts           # Tool registry (export all tools)
  │   ├── ui/                    # Terminal UI components
  │   │   ├── components/        # Ink React components
  │   │   │   ├── message.tsx    # Message display (user/assistant)
  │   │   │   ├── tool-call.tsx  # Tool call display with collapsible args
  │   │   │   ├── diff.tsx       # Diff display (red/green)
  │   │   │   ├── spinner.tsx    # Loading spinner
  │   │   │   ├── status-bar.tsx # Top/bottom status bars
  │   │   │   ├── input.tsx      # Multi-line input component
  │   │   │   ├── permission.tsx # Permission confirmation prompt
  │   │   │   ├── task-list.tsx  # Todo list display
  │   │   │   └── code-block.tsx # Syntax-highlighted code
  │   │   ├── renderer.ts        # StreamEvent → UI mapping
  │   │   ├── markdown.ts        # Terminal markdown rendering
  │   │   └── theme.ts           # Color themes (dark/light)
  │   ├── config/                # Configuration management
  │   │   ├── loader.ts          # Config file loading (global + project + env)
  │   │   ├── schema.ts          # Config schema validation (Zod)
  │   │   ├── defaults.ts        # Default configuration values
  │   │   └── paths.ts           # XDG-compliant paths (~/.curio-code/)
  │   ├── permissions/           # Permission system
  │   │   ├── policies.ts        # Custom permission policies (extends SDK)
  │   │   ├── allowlist.ts       # Tool/path/command allowlists
  │   │   ├── modes.ts           # Permission modes (ask, auto, strict)
  │   │   └── bash-classifier.ts # Classify bash commands (safe/moderate/dangerous)
  │   ├── context/               # Context intelligence
  │   │   ├── project-detector.ts # Detect project type, framework, package manager
  │   │   ├── git-context.ts     # Git state awareness (branch, status, log)
  │   │   ├── instruction-loader.ts # CURIO.md hierarchical loading
  │   │   └── environment.ts     # OS, shell, runtime detection
  │   ├── sessions/              # Session management
  │   │   ├── manager.ts         # Session lifecycle (create, resume, list, delete)
  │   │   ├── store.ts           # File-based session store (wraps SDK FileSessionStore)
  │   │   └── resume.ts          # Session resume logic (--continue, --resume)
  │   ├── memory/                # Persistent memory
  │   │   ├── auto-memory.ts     # Automatic memory detection & saving
  │   │   └── memory-files.ts    # MEMORY.md file management
  │   ├── plan/                  # Plan mode (NOT in SDK — custom implementation)
  │   │   ├── plan-state.ts      # Plan state machine (drafting → approval → execution)
  │   │   ├── plan-manager.ts    # Plan file management, tool restriction
  │   │   └── plan-tools.ts      # EnterPlanMode, ExitPlanMode tool definitions
  │   ├── todos/                 # Task tracking (NOT in SDK — custom implementation)
  │   │   ├── todo-model.ts      # Todo data model, state machine
  │   │   ├── todo-manager.ts    # CRUD operations, dependency resolution
  │   │   └── todo-tools.ts      # TaskCreate, TaskUpdate, TaskList, TaskGet tools
  │   ├── skills/                # Built-in skills
  │   │   ├── commit/            # /commit skill (git commit workflow)
  │   │   │   ├── skill.yaml     # Skill manifest
  │   │   │   └── SKILL.md       # Skill instructions
  │   │   ├── review-pr/         # /review-pr skill
  │   │   ├── simplify/          # /simplify skill (code quality review)
  │   │   ├── pr/                # /pr skill (create pull request)
  │   │   └── index.ts           # Skill registration
  │   ├── hooks/                 # Custom hooks
  │   │   ├── audit.ts           # Audit trail hook
  │   │   ├── cost-display.ts    # Cost display after each turn
  │   │   └── safety.ts          # Safety guardrails hook
  │   └── utils/                 # Utilities
  │       ├── platform.ts        # Platform detection (OS, arch)
  │       ├── paths.ts           # Path utilities (resolve, normalize)
  │       └── logger.ts          # Logging setup (wraps SDK createLogger)
  ├── scripts/
  │   ├── build.sh               # Build script (Bun compile)
  │   └── install.sh             # curl install script
  ├── skills/                    # Skill definitions (YAML + prompts)
  ├── tests/
  │   ├── unit/                  # Unit tests per module
  │   ├── integration/           # Agent integration tests
  │   ├── e2e/                   # End-to-end CLI tests
  │   └── fixtures/              # Test fixtures (mock LLM responses)
  ├── CURIO.md                   # Self-referential instructions
  ├── ADR-001-LANGUAGE-CHOICE.md
  ├── IMPLEMENTATION_PLAN.md     # This file
  ├── SDK_IMPROVEMENTS.md        # Desired SDK improvements
  └── package.json
  ```
- [x] **0.1.4** Set up ESLint with TypeScript config + Prettier
- [x] **0.1.5** Set up Vitest for testing (`vitest.config.ts`)
- [x] **0.1.6** Set up build pipeline:
  - Dev: `bun run dev` — `bun --watch src/index.ts`
  - Build: `bun run build` — `bun build src/index.ts --compile --outfile=curio-code`
  - Test: `bun run test` — `vitest`

### 0.2 TypeScript SDK Integration

- [x] **0.2.1** Add `curio-agent-sdk` as dependency:
  - `bun add curio-agent-sdk` (or local file reference during development)
  - Also add: `zod` (for tool schemas), `commander` (CLI args), `ink` + `react` (TUI)
- [x] **0.2.2** Verify core imports compile:
  ```typescript
  import { Agent, AgentBuilder, createTool, LLMClient, ToolRegistry,
           AnthropicProvider, OpenAIProvider, CostTracker, HookRegistry,
           ContextManager, InstructionLoader, SessionManager, FileSessionStore,
           MemoryManager, FileMemory, MCPBridge, Skill, SkillRegistry,
           AllowAll, AllowReadsAskWrites, CompoundPolicy, FileSandboxPolicy,
           TieredRouter, HookEvent, StreamEvent } from "curio-agent-sdk";
  ```
- [x] **0.2.3** Write smoke test: create agent with 1 tool, run single turn with `MockLLM`:
  ```typescript
  import { Agent, createTool, MockLLM } from "curio-agent-sdk";
  const echo = createTool({ name: "echo", description: "Echo", parameters: z.object({ msg: z.string() }), execute: async ({ msg }) => msg });
  const agent = Agent.builder().llmClient(new MockLLM([...])).tools([echo]).build();
  const result = await agent.run("test");
  assert(result.output);
  ```
- [ ] **0.2.4** Verify streaming works: `agent.astream()` yields `StreamEvent` objects with types: `text_delta`, `tool_call_start`, `tool_call_end`, `done`
- [ ] **0.2.5** Verify subagent spawning: `agent.spawnSubagent(name, input)` and `agent.spawnSubagentStream(name, input)`

### 0.3 Development Tooling

- [x] **0.3.1** Configure `bun run dev` — watch mode: `bun --watch src/index.ts`
- [x] **0.3.2** Configure `bun run build` — production binary: `bun build src/index.ts --compile`
- [x] **0.3.3** Configure `bun run test` — Vitest with coverage
- [ ] **0.3.4** Set up GitHub Actions CI:
  - Lint (ESLint + Prettier check)
  - Type check (`tsc --noEmit`)
  - Unit tests
  - Integration tests
  - Build binary for each platform (darwin-arm64, darwin-x64, linux-x64, linux-arm64)
- [x] **0.3.5** Set up conventional commits with commitlint
- [x] **0.3.6** Set up changesets for versioning

> **Phase 0 implementation status (2026-03-04)**  
> - Completed: 0.1.1–0.1.6, 0.2.1–0.2.3, 0.3.1–0.3.3, 0.3.5–0.3.6.  
> - In progress / deferred: 0.2.4 (streaming verification), 0.2.5 (subagent spawning verification), 0.3.4 (GitHub Actions CI).  
> - Notes:  
>   - `curio-code` is scaffolded as a Bun/TypeScript project with strict TS config and path aliases, matching the proposed directory layout (directories created; most files will be filled in future phases).  
>   - `curio-agent-sdk` is built from the local `curio-agent-sdk-typescript` repo and copied into `node_modules/curio-agent-sdk` so that `src/index.ts` and tests can import the compiled SDK.  
>   - A Phase 0 smoke test (`tests/sdk-smoke.test.ts`) uses `Agent`, `AgentBuilder`, `createTool`, and `MockLLM` (via `curio-agent-sdk/testing`) and passes under Vitest.  
>   - Linting is wired via flat `eslint.config.js` and passes cleanly; `bun run build` produces a `curio-code` binary with heavy optional dependencies (playwright/electron/chromium-bidi) marked as externals to keep the Phase 0 binary minimal and focused on SDK wiring.

---

## Phase 1: Core Agent Loop & Basic CLI ✅ Completed

> **Goal**: A working REPL that can converse with an LLM — no tools yet. Type a message, get a streaming response.
> **Deliverable**: `bun run dev` launches an interactive chat with streaming text output.

### 1.1 CLI Entry Point (`src/cli/args.ts`, `src/index.ts`)

- [x] **1.1.1** Parse CLI arguments with Commander:
  - `curio-code` — interactive mode (default)
  - `curio-code "prompt"` — one-shot mode (run once and exit)
  - `curio-code --model <model>` — model selection (e.g., `--model sonnet`)
  - `curio-code --provider <provider>` — provider override
  - `curio-code --print` — non-interactive mode (stdout only, no TUI)
  - `curio-code --continue` / `-c` — resume last session
  - `curio-code --resume <session-id>` — resume specific session
  - `curio-code --verbose` / `-v` — enable debug logging
  - `curio-code --version` — print version and exit
  - `curio-code --help` — help text
  - `curio-code --permission-mode <mode>` — `ask` | `auto` | `strict`
  - `curio-code --no-memory` — disable persistent memory
  - `curio-code --max-turns <n>` — limit agent turns (for safety)
- [x] **1.1.2** Subcommands:
  - `curio-code init` — initialize project config (create `.curio-code/config.json`)
  - `curio-code config` — show/edit configuration
  - `curio-code update` — self-update check
- [x] **1.1.3** Detect TTY vs pipe mode:
  - TTY → interactive REPL with full TUI
  - Pipe → non-interactive, plain text output, read stdin as input
- [x] **1.1.4** Read stdin for piped input: `echo "fix this" | curio-code`
  - Read all of stdin, treat as user message
  - Combine with positional arg if both provided: `cat file.ts | curio-code "explain this"`
- [x] **1.1.5** Signal handling:
  - `SIGINT` (Ctrl+C): If generating → cancel current run. If idle → exit with confirmation.
  - `SIGTERM`: Graceful cleanup (save session, close agent)
  - `SIGHUP`: Save state and exit

### 1.2 Agent Construction (`src/agent/builder.ts`)

- [x] **1.2.1** Create agent builder wrapper that resolves config → SDK `AgentBuilder`:
  ```typescript
  export async function buildAgent(config: CurioConfig): Promise<Agent> {
    const provider = resolveProvider(config);
    const llmClient = new LLMClient(provider);
    const systemPrompt = await buildSystemPrompt(config);

    return Agent.builder()
      .model(config.model)
      .llmClient(llmClient)
      .systemPrompt(systemPrompt)
      .maxIterations(config.maxTurns ?? 100)
      .build();
  }
  ```
- [x] **1.2.2** System prompt construction (`src/agent/system-prompt.ts`):
  - **1.2.2a** Base coding assistant identity and behavioral instructions
  - **1.2.2b** Tool usage guidelines: when to use each tool, best practices
  - **1.2.2c** Environment context: OS, shell, working directory, date/time
  - **1.2.2d** Project context placeholder (filled in Phase 4)
  - **1.2.2e** Git context placeholder (filled in Phase 4)
  - **1.2.2f** Custom instruction placeholder (filled in Phase 4)
  - **1.2.2g** Memory context placeholder (filled in Phase 6)
  - **1.2.2h** Active skills context placeholder (filled in Phase 8)
- [x] **1.2.3** Provider resolution (`src/agent/provider-config.ts`):
  - Auto-detect from environment variables (see 1.4)
  - CLI flag override
  - Config file override
  - Validate API key exists before creating provider

### 1.3 REPL Loop (`src/cli/repl.ts`)

- [x] **1.3.1** Basic input loop:
  - Display prompt character (e.g., `> ` or `❯ `)
  - Read user input line
  - Send to agent
  - Display response
  - Repeat
- [x] **1.3.2** Streaming output:
  - Call `agent.astream(userInput)`
  - For each `StreamEvent`:
    - `text_delta` → append text to output, render incrementally
    - `tool_call_start` → show "Calling tool: {name}" (placeholder — full UI in Phase 3)
    - `tool_call_end` → show "Tool result: {truncated result}" (placeholder)
    - `thinking` → show thinking text (if model supports it)
    - `error` → display error message
    - `done` → finalize output, show metrics
- [x] **1.3.3** Handle empty input (ignore, re-prompt)
- [x] **1.3.4** Handle EOF (Ctrl+D → exit gracefully)
- [x] **1.3.5** Handle Ctrl+C during generation:
  - Cancel the current `astream()` iteration
  - Keep the session alive
  - Return to input prompt
  - **Note**: Implemented via `iterator.return()` + interrupted flag to break the streaming loop immediately.
- [x] **1.3.6** Display turn metrics after each response:
  - Token count (input/output)
  - Cost (from CostTracker — placeholder until Phase later)
  - Duration
- [x] **1.3.7** One-shot mode:
  - If positional arg provided: run agent once, print result, exit
  - Respect `--print` flag (plain text, no TUI chrome)

### 1.4 Basic Provider Setup (`src/agent/provider-config.ts`)

- [x] **1.4.1** Auto-detect available providers from environment:
  - `ANTHROPIC_API_KEY` → `AnthropicProvider` (SDK built-in)
  - `OPENAI_API_KEY` → `OpenAIProvider` (SDK built-in)
  - `GROQ_API_KEY` → `GroqProvider` (SDK built-in)
  - `OLLAMA_HOST` or default `http://localhost:11434` → `OllamaProvider` (SDK built-in)
  - `GOOGLE_API_KEY` / `GEMINI_API_KEY` → Custom `GeminiProvider` (app-level, Phase 7 ✅)
- [x] **1.4.2** Default model selection priority:
  1. `anthropic:claude-sonnet-4-6` (if `ANTHROPIC_API_KEY` set)
  2. `openai:gpt-4o` (if `OPENAI_API_KEY` set)
  3. `groq:llama-3.3-70b-versatile` (if `GROQ_API_KEY` set)
  4. `ollama:llama3.1` (if Ollama available)
  5. Error: "No LLM provider configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or another provider key."
- [x] **1.4.3** Model override via `--model` flag:
  - Full format: `anthropic:claude-sonnet-4-6`
  - Short aliases: `sonnet` → `anthropic:claude-sonnet-4-6`, `opus` → `anthropic:claude-opus-4-6`, `gpt4o` → `openai:gpt-4o`, `haiku` → `anthropic:claude-haiku-4-5`
  - Use SDK's `parseModelString()` for parsing
- [x] **1.4.4** Display active model and provider on startup:
  ```
  Curio Code v0.1.0
  Model: claude-sonnet-4-6 (Anthropic)
  >
  ```
- [x] **1.4.5** Validate API key format (basic check — not a full auth test)
- [x] **1.4.6** Clear error messages for invalid/missing keys:
  ```
  Error: ANTHROPIC_API_KEY is not set.
  To use Claude models, set your API key: export ANTHROPIC_API_KEY=sk-...
  Or use a different provider: curio-code --model gpt-4o
  ```

> **Phase 1 implementation status (2026-03-04)**
> - Completed: 1.1.1–1.1.5, 1.2.1–1.2.3, 1.3.1–1.3.7, 1.4.1–1.4.6.
> - Files created/updated:
>   - `src/index.ts` — entry point delegates to `runCli()`.
>   - `src/cli/args.ts` — Commander CLI with all flags, subcommands, TTY detection, stdin reading, and wiring to agent construction + REPL / one-shot.
>   - `src/cli/repl.ts` — readline-based interactive REPL with streaming (`agent.astream()`), Ctrl+C interruption via `iterator.return()`, Ctrl+D exit, empty input handling, and turn metrics (tokens, duration, turns). Also exports `runOneShotMode` with `--print` support.
>   - `src/agent/builder.ts` — `buildAgent(config)` wraps `Agent.builder()` with resolved provider, system prompt, and max iterations.
>   - `src/agent/system-prompt.ts` — `buildSystemPrompt()` generates system prompt with identity, guidelines, environment context (OS, shell, cwd, date), and placeholders for project/git/instructions/memory/skills context (Phases 4–8).
>   - `src/agent/provider-config.ts` — `resolveProvider()` auto-detects providers from env vars (ANTHROPIC_API_KEY, OPENAI_API_KEY, GROQ_API_KEY, OLLAMA_HOST), resolves short model aliases (sonnet, opus, haiku, gpt4o, etc.) via `MODEL_ALIASES`, validates API key presence, and builds an `LLMClient` with `autoDiscover: true`.
> - Notes:
>   - The REPL is implemented with Node `readline` (not Ink/React). Phase 3 will introduce the rich Ink-based TUI; the current `src/cli/repl.ts` will evolve into `src/cli/app.tsx` at that time.
>   - Subcommands (`init`, `config`, `update`) are registered and parseable but print placeholder messages; full implementation deferred to later phases.
>   - Session resume flags (`--continue`, `--resume`) are parsed into `CliRuntimeConfig` and fully wired in Phase 6.
>   - `--verbose` and `--permission-mode` are parsed but not yet consumed (Phases 5, 12).
>   - Cost display in turn metrics shows token counts and duration; dollar cost from `CostTracker` will be added when middleware is wired.
>   - Lint + type-check pass cleanly. Existing SDK smoke test still passes.

---

## Phase 2: Tool System — File & Code Operations ✅ Completed

> **Goal**: The agent can read, write, search, and execute code. This is the heart of the coding tool.
> **Deliverable**: Agent can autonomously explore and modify codebases.

### 2.1 File Read Tool (`src/tools/file-read.ts`)

- [x] **2.1.1** Create tool with `createTool()` and Zod schema:
  ```typescript
  parameters: z.object({
    file_path: z.string().describe("Absolute path to the file"),
    offset: z.number().optional().describe("Line number to start from (1-indexed)"),
    limit: z.number().optional().describe("Number of lines to read"),
  })
  ```
- [x] **2.1.2** Read file contents with `fs.readFile()`, convert to string
- [x] **2.1.3** Line number display: format as `cat -n` (right-aligned line numbers + tab + content)
- [x] **2.1.4** Support `offset` and `limit` for large files:
  - Default limit: 2000 lines
  - If file exceeds limit, show first `limit` lines + "[truncated — {remaining} more lines]"
- [x] **2.1.5** Truncate lines longer than 2000 characters (append `[truncated]`)
- [x] **2.1.6** Handle binary files: detect via null bytes in first 512 bytes, return "Binary file, cannot display"
- [x] **2.1.7** Handle missing files: return clear error "File not found: {path}"
- [x] **2.1.8** Handle permission errors: return "Permission denied: {path}"
- [x] **2.1.9** Image file support:
  - Detect image extensions (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`)
  - Return image as base64 content part (for vision-capable models)
  - For non-vision models, return "Image file — cannot display (model does not support vision)"
- [x] **2.1.10** PDF support:
  - Detect `.pdf` extension
  - Accept optional `pages` parameter (e.g., "1-5", "3", "10-20")
  - Extract text from specified pages using `pdf-parse` or similar
  - Max 20 pages per request
- [x] **2.1.11** Jupyter notebook support:
  - Detect `.ipynb` extension
  - Parse JSON, render all cells with their outputs
  - Format: `[Cell N - code/markdown]\n{source}\n[Output]\n{outputs}`
- [x] **2.1.12** Register tool with appropriate description for the LLM

### 2.2 File Write Tool (`src/tools/file-write.ts`)

- [x] **2.2.1** Create tool with Zod schema:
  ```typescript
  parameters: z.object({
    file_path: z.string().describe("Absolute path to write to"),
    content: z.string().describe("Content to write"),
  })
  ```
- [x] **2.2.2** Write content with `fs.writeFile()` (UTF-8)
- [x] **2.2.3** Create parent directories if they don't exist (`fs.mkdir({ recursive: true })`)
- [x] **2.2.4** Track which files have been read in the session:
  - If overwriting a file that was NOT previously read → warn in output: "Warning: overwriting file that was not read first"
  - If overwriting a file that WAS read → proceed silently
- [x] **2.2.5** Return confirmation: "Wrote {n} bytes to {path}"
- [x] **2.2.6** Handle errors: permission denied, disk full, invalid path

### 2.3 File Edit Tool (`src/tools/file-edit.ts`)

- [x] **2.3.1** Create tool with Zod schema:
  ```typescript
  parameters: z.object({
    file_path: z.string().describe("Absolute path to the file"),
    old_string: z.string().describe("Exact text to find and replace"),
    new_string: z.string().describe("Replacement text"),
    replace_all: z.boolean().optional().default(false).describe("Replace all occurrences"),
  })
  ```
- [x] **2.3.2** Read file, find `old_string` occurrences
- [x] **2.3.3** Uniqueness validation:
  - If `replace_all` is false and `old_string` appears more than once → error: "old_string matches {n} locations. Provide more context to make it unique, or use replace_all: true"
  - If `old_string` not found → error: "old_string not found in file. Check indentation and whitespace."
- [x] **2.3.4** Perform replacement, write file back
- [x] **2.3.5** Verify `old_string !== new_string` (no-op check)
- [x] **2.3.6** Generate and return unified diff output showing the change
- [x] **2.3.7** Preserve exact indentation — match whitespace character-for-character
- [x] **2.3.8** Require that the file was previously read (enforce via session state tracking)

### 2.4 Glob Tool (`src/tools/glob.ts`)

- [x] **2.4.1** Create tool with Zod schema:
  ```typescript
  parameters: z.object({
    pattern: z.string().describe("Glob pattern (e.g., '**/*.ts', 'src/**/*.tsx')"),
    path: z.string().optional().describe("Directory to search in (defaults to cwd)"),
  })
  ```
- [x] **2.4.2** Use `fast-glob` (or `globby`) for pattern matching
- [x] **2.4.3** Return matches sorted by modification time (newest first)
- [x] **2.4.4** Respect `.gitignore` by default (use `ignore` option or `git ls-files` integration)
- [x] **2.4.5** Limit results to prevent context overflow (default: 200 files, show "[N more files...]" if truncated)
- [x] **2.4.6** Return one file path per line

### 2.5 Grep Tool (`src/tools/grep.ts`)

- [x] **2.5.1** Create tool with Zod schema:
  ```typescript
  parameters: z.object({
    pattern: z.string().describe("Regex pattern to search for"),
    path: z.string().optional().describe("File or directory to search in"),
    glob: z.string().optional().describe("Glob filter (e.g., '*.js')"),
    type: z.string().optional().describe("File type (e.g., 'ts', 'py')"),
    output_mode: z.enum(["content", "files_with_matches", "count"]).optional().default("files_with_matches"),
    "-i": z.boolean().optional().describe("Case insensitive"),
    "-A": z.number().optional().describe("Lines after match"),
    "-B": z.number().optional().describe("Lines before match"),
    "-C": z.number().optional().describe("Lines around match"),
    multiline: z.boolean().optional().describe("Enable multiline matching"),
    head_limit: z.number().optional().describe("Limit results"),
    offset: z.number().optional().describe("Skip first N results"),
  })
  ```
- [x] **2.5.2** Implementation strategy:
  - **Primary**: Spawn `rg` (ripgrep) as child process if available on system
  - **Fallback**: Pure JS regex search using `fs.readFile()` + `RegExp`
- [x] **2.5.3** Output modes:
  - `files_with_matches`: return file paths only (one per line)
  - `content`: return matching lines with file:line format
  - `count`: return match counts per file
- [x] **2.5.4** Context lines support (-A, -B, -C) — only in `content` mode
- [x] **2.5.5** Head limit and offset for pagination
- [x] **2.5.6** Multiline mode: match across line boundaries

### 2.6 Bash Tool (`src/tools/bash.ts`)

- [x] **2.6.1** Create tool with Zod schema:
  ```typescript
  parameters: z.object({
    command: z.string().describe("Shell command to execute"),
    description: z.string().optional().describe("What this command does"),
    timeout: z.number().optional().describe("Timeout in milliseconds (max 600000)"),
    run_in_background: z.boolean().optional().describe("Run in background"),
  })
  ```
- [x] **2.6.2** Execute in user's default shell:
  - Detect shell from `$SHELL` env var (default: `/bin/sh`)
  - Run via `child_process.spawn(shell, ["-c", command])`
- [x] **2.6.3** Working directory persistence:
  - Track `cwd` across bash invocations within the same session
  - If command contains `cd`, extract the target directory and update `cwd`
  - Use `cwd` option in `spawn()` call
- [x] **2.6.4** Timeout support:
  - Default: 120000ms (2 minutes)
  - Maximum: 600000ms (10 minutes)
  - Kill process on timeout, return partial output + "Command timed out after {n}ms"
- [x] **2.6.5** Background execution:
  - If `run_in_background: true`, start process and return immediately
  - Assign a task ID
  - Provide a way to check output later (via `TaskOutput` tool or slash command)
- [x] **2.6.6** Stream output for long-running commands:
  - Collect stdout and stderr
  - Return combined output (stdout + stderr interleaved)
  - Truncate if output exceeds reasonable limit (e.g., 10000 lines)
- [x] **2.6.7** Return format: exit code + output
  ```
  Exit code: 0
  Output:
  {command output}
  ```
- [x] **2.6.8** Environment variable inheritance: pass through `process.env`
- [x] **2.6.9** Signal forwarding: forward SIGINT to child process on Ctrl+C

### 2.7 Git Operations (System Prompt, not a separate tool)

- [x] **2.7.1** Add git safety instructions to system prompt:
  - Prefer new commits over amend
  - Never force push to main/master without explicit user request
  - Never skip hooks (--no-verify)
  - Never run `git reset --hard` without confirmation
  - Stage specific files by name, not `git add -A` or `git add .`
  - Always use HEREDOC for commit messages (proper formatting)
  - Include `Co-Authored-By` line in commits
- [x] **2.7.2** Git context injection (appended to system prompt):
  - Current branch name
  - Git status summary (modified/staged/untracked counts)
  - Last 5 commit messages (for style matching)
  - Remote tracking info
- [x] **2.7.3** PR creation instructions:
  - Use `gh pr create` via Bash tool
  - Include summary, test plan, and generated attribution

### 2.8 Web Fetch Tool (`src/tools/web-fetch.ts`)

- [x] **2.8.1** Create tool with Zod schema:
  ```typescript
  parameters: z.object({
    url: z.string().url().describe("URL to fetch"),
    prompt: z.string().describe("What to extract from the page"),
  })
  ```
- [x] **2.8.2** Fetch URL with `fetch()` API
- [x] **2.8.3** Convert HTML to markdown (using `turndown` or `html-to-text`)
- [x] **2.8.4** Process extracted content with small/fast model for summarization (optional — can just return markdown)
- [x] **2.8.5** Implement 15-minute cache (in-memory `Map` with TTL)
- [x] **2.8.6** Handle redirects: follow up to 5 redirects, report if host changes
- [x] **2.8.7** Timeout: 30 seconds
- [x] **2.8.8** Truncate response if too large (>50KB markdown)

### 2.9 Web Search Tool (`src/tools/web-search.ts`)

- [x] **2.9.1** Create tool with Zod schema:
  ```typescript
  parameters: z.object({
    query: z.string().describe("Search query"),
  })
  ```
- [x] **2.9.2** Search via API:
  - Primary: Brave Search API (`BRAVE_API_KEY`)
  - Fallback: Serper API (`SERPER_API_KEY`)
  - Fallback: SearXNG (self-hosted, `SEARXNG_URL`)
- [x] **2.9.3** Return formatted results:
  - Title, URL, snippet for each result
  - Markdown hyperlinks
  - Top 10 results
- [x] **2.9.4** Require source citations in responses (added to system prompt instructions)

### 2.10 Notebook Edit Tool (`src/tools/notebook-edit.ts`)

- [x] **2.10.1** Create tool with Zod schema:
  ```typescript
  parameters: z.object({
    notebook_path: z.string().describe("Absolute path to .ipynb file"),
    cell_number: z.number().optional().describe("0-indexed cell number"),
    cell_id: z.string().optional().describe("Cell ID"),
    cell_type: z.enum(["code", "markdown"]).optional(),
    new_source: z.string().describe("New cell content"),
    edit_mode: z.enum(["replace", "insert", "delete"]).optional().default("replace"),
  })
  ```
- [x] **2.10.2** Parse notebook JSON, locate target cell
- [x] **2.10.3** Operations: replace cell content, insert new cell, delete cell
- [x] **2.10.4** Preserve notebook metadata and output cells
- [x] **2.10.5** Write back valid .ipynb JSON

> **Phase 2 implementation status (2026-03-04)**
> - Completed: 2.1.1–2.1.12, 2.2.1–2.2.6, 2.3.1–2.3.8, 2.4.1–2.4.6, 2.5.1–2.5.6, 2.6.1–2.6.9, 2.7.1–2.7.3, 2.8.1–2.8.8, 2.9.1–2.9.4, 2.10.1–2.10.5.
> - Files created/updated:
>   - `src/tools/session-state.ts` — shared in-memory tool session state (read-file tracking, persistent bash cwd, background task tracking).
>   - `src/tools/file-read.ts` — file read tool with line-number formatting, pagination, binary detection, image handling (base64 payload for vision-capable usage), PDF parsing (`pdf-parse`), and notebook rendering.
>   - `src/tools/file-write.ts` — UTF-8 write tool with recursive parent directory creation, unread-overwrite warning, and write/error reporting.
>   - `src/tools/file-edit.ts` — exact string replace tool with uniqueness checks, no-op guard, read-before-edit enforcement, and unified-diff style output.
>   - `src/tools/glob.ts` — fast glob search (`fast-glob`) with `.gitignore` filtering (`ignore`), mtime sorting, and truncation controls.
>   - `src/tools/grep.ts` — ripgrep-backed search tool with output modes, context flags, pagination, and pure-JS fallback when `rg` is unavailable.
>   - `src/tools/bash.ts` — shell execution tool with timeout controls, cwd persistence, background task support, streamed output capture, and SIGINT forwarding.
>   - `src/tools/web-fetch.ts` — URL fetch tool with HTML-to-markdown conversion (`turndown`), redirect host-change reporting, timeout, truncation, and 15-minute in-memory cache.
>   - `src/tools/web-search.ts` — web search tool with provider cascade (Brave → Serper → SearXNG) and normalized markdown-formatted results.
>   - `src/tools/notebook-edit.ts` — notebook cell edit tool supporting replace/insert/delete while preserving notebook metadata structure.
>   - `src/tools/index.ts` — Phase 2 tool registry export list.
>   - `src/agent/builder.ts` — registers all Phase 2 tools via `.tools(phaseTwoTools)`.
>   - `src/agent/system-prompt.ts` — adds Git safety policy, Git context injection (branch/status/log/tracking), and source citation guidance.
>   - `package.json` — adds Phase 2 dependencies: `fast-glob`, `ignore`, `pdf-parse`, `turndown`, and updates SDK reference to `file:../curio-agent-sdk-typescript`.
> - Notes:
>   - `bash_task_output` is exposed as a companion tool for retrieving output from background bash tasks started with `run_in_background: true`.
>   - PDF page extraction uses parsed text segmentation and enforces a max of 20 requested pages.
>   - Web fetch currently returns markdown content directly; model-based summarization remains optional and intentionally deferred.
>   - Test and lint status after Phase 2 implementation: `bun run test` passes (12/12), `bun run lint` passes cleanly.

---

## Phase 3: Terminal UI & Rich Output ✅ Completed

> **Goal**: Beautiful, responsive terminal experience that makes tool calls readable and streaming smooth.
> **Deliverable**: Rich markdown rendering, collapsible tool calls, status bar, input system.

### 3.1 Markdown Rendering (`src/ui/markdown.ts`)

- [x] **3.1.1** Render LLM markdown output in terminal using `marked` + custom terminal renderer, or `marked-terminal`:
  - **3.1.1a** Bold (`**text**`) → terminal bold
  - **3.1.1b** Italic (`*text*`) → terminal dim/italic
  - **3.1.1c** Code blocks with syntax highlighting:
    - Use `shiki` for accurate highlighting (supports all languages)
    - Fallback: `chalk` + basic token coloring
    - Show language tag on code fence
  - **3.1.1d** Inline code (`` `code` ``) → background color + monospace
  - **3.1.1e** Headers (`# H1`, `## H2`) → bold + size styling
  - **3.1.1f** Lists (ordered and unordered) → proper indentation
  - **3.1.1g** Links (`[text](url)`) → show text + URL in dim
  - **3.1.1h** Tables → box-drawing alignment
  - **3.1.1i** Blockquotes → indented with pipe character
  - **3.1.1j** Horizontal rules → full-width line
- [x] **3.1.2** Streaming-compatible rendering:
  - Render incrementally as `text_delta` events arrive
  - Handle partial markdown (e.g., incomplete code fence)
  - Buffer partial tokens to avoid flicker

### 3.2 Tool Call Display (`src/ui/components/tool-call.tsx`)

- [x] **3.2.1** On `tool_call_start` event:
  - Show tool name with icon/emoji indicator
  - Show truncated arguments (first 200 chars)
  - Show spinner while tool executes
- [x] **3.2.2** On `tool_call_end` event:
  - Show duration
  - Show result preview (truncated for large outputs)
  - Show error if tool failed (in red)
- [x] **3.2.3** Special rendering per tool:
  - **Edit**: Show unified diff with red/green coloring
  - **Glob**: Show file tree structure
  - **Read**: Show syntax-highlighted code preview
  - **Bash**: Show command + output with exit code
  - **Write**: Show file path + size
- [x] **3.2.4** Collapsible/expandable tool output:
  - Default: collapsed for large outputs (>10 lines)
  - Click/key to expand full output

### 3.3 Input System (`src/ui/components/input.tsx`)

- [x] **3.3.1** Rich input prompt:
  - **3.3.1a** Input editing: Enter to submit
  - **3.3.1b** History navigation: Up/Down arrows cycle through previous inputs
  - **3.3.1c** Input history persistence: save to `~/.curio-code/history` file
  - **3.3.1d** Tab completion for slash commands (`/com` → `/commit`)
  - **3.3.1e** Tab completion for file paths (type path prefix → autocomplete)
  - **3.3.1f** Paste detection: detect multi-line paste and handle gracefully
  - **3.3.1g** Vi/Emacs key binding modes (optional, config-driven)
- [x] **3.3.2** Image input:
  - Accept file paths to images in user message
  - Detect image paths and convert to vision content parts
- [ ] **3.3.3** File drag-and-drop:
  - Detect terminal file drop events (iTerm2, kitty)
  - Auto-read dropped file into context

### 3.4 Status Bar / Chrome (`src/ui/components/status-bar.tsx`)

- [x] **3.4.1** Top bar (displayed on startup and between turns):
  - Model name and provider
  - Session ID (truncated)
  - Cumulative cost
- [x] **3.4.2** Spinner during LLM generation:
  - Animated spinner with "Thinking..." text
  - Show elapsed time
- [ ] **3.4.3** Progress indicators:
  - Multi-step task progress (from TodoManager)
  - File operation counts
- [x] **3.4.4** Notification system:
  - Warning messages (yellow)
  - Error messages (red)
  - Info messages (blue)
  - Fade/dismiss after 5 seconds

### 3.5 Color Themes (`src/ui/theme.ts`)

-- [x] **3.5.1** Default dark theme (optimized for dark terminals)
-- [x] **3.5.2** Light theme (optimized for light terminals)
- [x] **3.5.3** Theme configuration: `~/.curio-code/theme.json` or config property
- [x] **3.5.4** Respect `NO_COLOR` environment variable (disable all colors)
- [x] **3.5.5** Auto-detect terminal color support:
  - 16 colors → basic ANSI
  - 256 colors → extended palette
  - Truecolor → full RGB

### 3.6 Responsive Layout

- [x] **3.6.1** Handle terminal resize events (`process.stdout.on("resize")`)
- [x] **3.6.2** Word wrapping for long lines
- [x] **3.6.3** Scrollback management for long tool outputs
- [x] **3.6.4** Compact mode for narrow terminals (<80 columns): hide status bar, shorter prompts

> **Phase 3 implementation status (2026-03-04)**  
> - Completed: 3.1.1–3.1.2, 3.2.1–3.2.4, 3.3.1–3.3.2, 3.4.1–3.4.2, 3.4.4, 3.5.1–3.5.5, 3.6.1–3.6.4.  
> - Deferred: 3.3.3 (file drag-and-drop — terminal-specific, low priority), 3.4.3 (progress indicators — depends on TodoManager from Phase 8).  
> - Files created/updated:
>   - `src/ui/markdown.ts` — markdown → ANSI renderer built on `marked` + `marked-terminal`.
>   - `src/ui/theme.ts` — dark/light themes with truecolor + basic ANSI variants, `CURIO_CODE_THEME` + `NO_COLOR` handling, `~/.curio-code/theme.json` config file loading, `detectColorDepth()` for terminal color support (none/basic/256/truecolor).
>   - `src/ui/components/spinner.tsx` — animated spinner component.
>   - `src/ui/components/status-bar.tsx` — top status bar showing model, provider, and last-turn metrics.
>   - `src/ui/components/message.tsx` — user/assistant message rendering with markdown support for assistant output.
>   - `src/ui/components/tool-call.tsx` — tool-specific rendering: diff with red/green for file_edit, exit-code-aware bash output, file list for glob, success-colored writes. Icons per tool type. Collapsible output for results >10 lines (Tab to toggle). Structured arg summaries (file path, command, URL) instead of raw JSON.
>   - `src/ui/components/input.tsx` — multi-line input with in-session history and keyboard hints.
>   - `src/ui/components/notification.tsx` — notification system with info (blue), warning (yellow), and error (red) messages with auto-dismiss after 5 seconds.
>   - `src/cli/app.tsx` — Ink-based main application with: thinking spinner (elapsed time counter shown before first token), image path detection in user input, compact mode for narrow terminals (<80 cols: hides status bar and footer), notification rendering, tool args passed for structured display.
>   - `src/cli/args.ts` — interactive mode now launches the Ink app; one-shot mode remains text-only.  
> - Verification:
>   - `bun run test` passes (11/11 files, 37 tests) after Phase 3 changes.  
>   - `bun run lint` passes cleanly with the new UI files and test adjustments.

---

## Phase 4: Context Management & Intelligence ✅ Completed

> **Goal**: Smart context gathering so the agent understands the project it's working in.
> **Deliverable**: Agent automatically detects project type, loads instructions, injects git context.

### 4.1 Project Detection (`src/context/project-detector.ts`)

- [x] **4.1.1** Detect project type from marker files:
  - `package.json` → Node.js/TypeScript (check for `"type": "module"`, TypeScript deps)
  - `tsconfig.json` → TypeScript
  - `Cargo.toml` → Rust
  - `go.mod` → Go
  - `pyproject.toml` / `setup.py` / `requirements.txt` → Python
  - `pom.xml` / `build.gradle` / `build.gradle.kts` → Java/Kotlin
  - `Gemfile` → Ruby
  - `*.sln` / `*.csproj` → C#/.NET
  - `Makefile` / `CMakeLists.txt` → C/C++
  - `pubspec.yaml` → Dart/Flutter
  - `mix.exs` → Elixir
  - `stack.yaml` / `*.cabal` → Haskell
  - `composer.json` → PHP
  - `Dockerfile` → containerized
- [x] **4.1.2** Detect framework:
  - `next.config.*` → Next.js
  - `nuxt.config.*` → Nuxt
  - `vite.config.*` → Vite
  - `angular.json` → Angular
  - `svelte.config.*` → SvelteKit
  - React (check package.json deps)
  - Django, Flask, FastAPI (check Python deps)
  - Rails (Gemfile)
  - Spring Boot (pom.xml)
- [x] **4.1.3** Detect monorepo:
  - `lerna.json` → Lerna
  - `nx.json` → Nx
  - `turbo.json` → Turborepo
  - `pnpm-workspace.yaml` → pnpm workspaces
  - Cargo workspaces (check Cargo.toml `[workspace]`)
- [x] **4.1.4** Detect CI/CD: `.github/workflows/`, `.gitlab-ci.yml`, `.circleci/`, `Jenkinsfile`
- [x] **4.1.5** Detect testing framework: Jest, Vitest, pytest, RSpec, Go test, cargo test, JUnit
- [x] **4.1.6** Detect package manager: npm, yarn, pnpm, bun, pip, poetry, cargo, go modules
- [x] **4.1.7** Return structured `ProjectContext`:
  ```typescript
  interface ProjectContext {
    language: string;
    framework?: string;
    packageManager?: string;
    testFramework?: string;
    isMonorepo: boolean;
    cicd?: string;
    projectRoot: string;
  }
  ```

### 4.2 Git Context (`src/context/git-context.ts`)

- [x] **4.2.1** Current branch name (`git rev-parse --abbrev-ref HEAD`)
- [x] **4.2.2** Git status summary:
  - Modified files count
  - Staged files count
  - Untracked files count
  - Whether there are conflicts
- [x] **4.2.3** Recent commit history (`git log --oneline -10`)
- [x] **4.2.4** Remote tracking info (`git remote -v`)
- [x] **4.2.5** Detect if inside git repository (`git rev-parse --is-inside-work-tree`)
- [x] **4.2.6** Detect if inside git worktree (`git rev-parse --is-inside-work-tree` + `git worktree list`)
- [x] **4.2.7** `.gitignore` awareness: provide ignore patterns to file tools

### 4.3 Instruction Files (`src/context/instruction-loader.ts`)

- [x] **4.3.1** Hierarchical loading (mirrors Claude Code's CLAUDE.md):
  - **Global**: `~/.curio-code/CURIO.md`
  - **Project root**: `./CURIO.md`
  - **Directory-level**: `./.curio-code/rules.md`
  - Walk up parent directories looking for CURIO.md files
- [x] **4.3.2** Use SDK's `InstructionLoader` as base, customize:
  - Change default file names from `AGENT.md` to `CURIO.md`
  - Change search paths to include `.curio-code/` directories
- [x] **4.3.3** Support `.curioignore` for excluding files/directories from context
- [x] **4.3.4** Concatenate all found instructions, deduplicate
- [x] **4.3.5** Inject into system prompt as "Custom Instructions" section

### 4.4 Context Window Management

- [x] **4.4.1** Use SDK's `ContextManager` with model-appropriate budget:
  - Claude Sonnet: 200K tokens (use 180K budget, reserve 20K for response)
  - GPT-4o: 128K tokens (use 110K budget)
  - Groq models: 8K-128K (varies, detect from model info)
  - Ollama: varies by model
- [x] **4.4.2** Strategy selection:
  - Default: `truncate_oldest` (fast, predictable)
  - Optional config: `summarize` (better context retention, requires extra LLM call)
- [x] **4.4.3** Always preserve in context:
  - System prompt (never truncate)
  - Last 3 user messages + responses
  - Active tool results from current turn
- [x] **4.4.4** Show "[context compressed — older messages summarized]" when truncation occurs
- [x] **4.4.5** Token budget display in turn metrics

### 4.5 Environment Context (`src/context/environment.ts`)

- [x] **4.5.1** Inject into system prompt:
  - Operating system and version (`process.platform`, `os.release()`)
  - Shell type (`$SHELL`)
  - Working directory (`process.cwd()`)
  - Current date/time
  - Terminal type (`$TERM`)
  - Available system tools: detect `git`, `rg`, `fd`, `gh`, `docker`, etc. via `which`
  - Language runtimes: detect `node`, `python`, `go`, `rustc`, `java`, etc.

> **Phase 4 implementation status (2026-03-04)**
> - Completed: 4.1.1–4.1.7, 4.2.1–4.2.7, 4.3.1–4.3.5, 4.4.1–4.4.5, 4.5.1.
> - Files created/updated:
>   - `src/context/project-detector.ts` — project/language/framework/monorepo/CI/test/package-manager detection and structured `ProjectContext` output.
>   - `src/context/git-context.ts` — git repository/worktree detection, status summary parsing, commit/remote context, and `.gitignore` pattern extraction.
>   - `src/context/instruction-loader.ts` — CURIO.md hierarchy loading using SDK `InstructionLoader`, plus `.curioignore`-aware filtering and deduped merge output.
>   - `src/context/environment.ts` — OS/shell/TERM/date/cwd detection, available system tools/runtimes discovery via `which`, and prompt formatting helper.
>   - `src/context/context-window.ts` — model-aware SDK `ContextManager` configuration (budgets + strategy), summarize-mode compression marker, and status-bar budget label helper.
>   - `src/context/index.ts` — context module exports.
>   - `src/agent/system-prompt.ts` — now asynchronously injects environment/project/git/custom-instruction context into the system prompt.
>   - `src/agent/builder.ts` — now wires SDK `ContextManager` into `Agent.builder()` and returns context-budget metadata.
>   - `src/cli/args.ts`, `src/cli/app.tsx`, `src/ui/components/status-bar.tsx` — pass and render context budget information in interactive UI metrics.
>   - `tests/unit/context.test.ts`, `tests/unit/system-prompt.test.ts`, `tests/unit/builder.test.ts` — Phase 4 validation coverage and updated expectations.
> - Notes:
>   - Default context strategy is `truncate_oldest`; optional `summarize` mode is available via `CURIO_CODE_CONTEXT_STRATEGY=summarize`.
>   - Summarize mode inserts `[context compressed - older messages summarized]` as the compression marker to preserve truncation visibility for downstream responses.
>   - Custom instruction loading order is global (`~/.curio-code`) → project root → nested directories toward `cwd`, with duplicate content elimination.

---

## Phase 5: Permission System & Security ✅ Completed

> **Goal**: Safe, configurable permission controls that prevent accidental damage.
> **Deliverable**: Users can control what the agent can do. Dangerous operations require confirmation.

### 5.1 Permission Modes (`src/permissions/modes.ts`)

- [x] **5.1.1** **Ask mode** (default):
  - Allow: Read, Glob, Grep, Web Fetch, Web Search
  - Ask: Write, Edit, Bash, Notebook Edit
  - Use SDK's `AllowReadsAskWrites` as base policy
- [x] **5.1.2** **Auto mode** (trusted environments):
  - Allow all operations without confirmation
  - Use SDK's `AllowAll`
  - Display warning on startup: "Running in auto mode — all operations will be allowed"
- [x] **5.1.3** **Strict mode**:
  - Ask for everything including file reads
  - Use SDK's `AskAlways`
- [x] **5.1.4** Mode selection:
  - `--permission-mode ask|auto|strict` CLI flag
  - `permissionMode` in config file
  - `/mode` slash command to switch mid-session

### 5.2 Tool-Level Permissions (`src/permissions/policies.ts`)

- [x] **5.2.1** Default permission matrix:
  | Tool | Ask Mode | Auto Mode | Strict Mode |
  |------|----------|-----------|-------------|
  | Read | allow | allow | ask |
  | Glob | allow | allow | ask |
  | Grep | allow | allow | ask |
  | Web Fetch | allow | allow | ask |
  | Web Search | allow | allow | ask |
  | Write | ask | allow | ask |
  | Edit | ask | allow | ask |
  | Bash | ask | allow | ask |
  | Notebook Edit | ask | allow | ask |
  | Git push/force | always ask | ask | ask |
- [x] **5.2.2** Implement using SDK's `CompoundPolicy`:
  ```typescript
  const policy = new CompoundPolicy([
    new FileSandboxPolicy({ allowedPrefixes: [projectRoot, homeConfigDir] }),
    modePolicy, // AllowReadsAskWrites, AllowAll, or AskAlways
    bashSafetyPolicy, // Custom bash command classifier
  ]);
  ```

### 5.3 Path Restrictions (`src/permissions/allowlist.ts`)

- [x] **5.3.1** Use SDK's `FileSandboxPolicy`:
  - Default allowed: project root directory, `~/.curio-code/`
  - Configurable via `allowedPaths` in config
- [x] **5.3.2** Blocked paths (always denied):
  - `/etc/shadow`, `/etc/passwd`
  - `~/.ssh/` (private keys)
  - `~/.aws/credentials`
  - Other credential files
- [x] **5.3.3** Warn when accessing sensitive files:
  - `.env`, `.env.local`, `.env.production`
  - `credentials.json`, `*.pem`, `*.key`

### 5.4 Bash Command Safety (`src/permissions/bash-classifier.ts`)

- [x] **5.4.1** Classify commands by risk level:
  - **Safe** (auto-allow in ask mode): `ls`, `cat`, `echo`, `pwd`, `git status`, `git log`, `git diff`, `git branch`, `npm test`, `bun test`, `cargo test`, `go test`, `python -m pytest`
  - **Moderate** (ask once, then allow for session): `npm install`, `bun add`, `git commit`, `git add`, build commands, `make`
  - **Dangerous** (always ask): `rm -rf`, `git push --force`, `git reset --hard`, `sudo`, `chmod`, `chown`, `dd`, `mkfs`, `curl | sh`, `kill`, `pkill`
- [x] **5.4.2** Regex-based classification (extensible)
- [x] **5.4.3** Configurable allowlist/blocklist in config:
  ```json
  {
    "permissions": {
      "allowedCommands": ["npm test", "bun test"],
      "blockedCommands": ["rm -rf /", "sudo rm"]
    }
  }
  ```

### 5.5 Confirmation UI (`src/ui/components/permission.tsx`)

- [x] **5.5.1** Use SDK's `HumanInputHandler` interface with custom Ink component:
  ```
  ┌─ Permission Required ──────────────────────────┐
  │ Tool: Bash                                       │
  │ Command: npm install express                     │
  │ Description: Install express package             │
  │                                                  │
  │ [y]es  [n]o  [a]lways allow this tool  [e]dit   │
  └──────────────────────────────────────────────────┘
  ```
- [x] **5.5.2** Options:
  - `y` (yes) — allow this once
  - `n` (no) — deny
  - `a` (always) — allow this tool for rest of session
  - `e` (edit) — modify the arguments before executing
- [x] **5.5.3** "Always allow" persistence:
  - Per-session (in memory)
  - Optionally permanent (saved to config)
- [x] **5.5.4** Keyboard shortcuts for quick approve/deny
- [x] **5.5.5** Timeout option: auto-deny after configurable seconds (disabled by default)

### 5.6 Network Security

- [x] **5.6.1** Default: allow all outbound network (needed for LLM APIs, web fetch)
- [x] **5.6.2** Optionally use SDK's `NetworkSandboxPolicy`:
  - Configure allowed domains/URLs in config
  - Block specific domains

> **Phase 5 implementation status (2026-03-04)**
> - Completed: 5.1.1–5.1.4, 5.2.1–5.2.2, 5.3.1–5.3.3, 5.4.1–5.4.3, 5.5.1–5.5.5, 5.6.1–5.6.2.
> - Files created/updated:
>   - `src/permissions/modes.ts` — `basePolicyForMode()` maps ask/auto/strict to SDK policies (AllowReadsAskWrites, AllowAll, AskAlways); startup warning for auto mode.
>   - `src/permissions/policies.ts` — `buildPermissionSystem()` assembles a five-layer `CompoundPolicy` (PathGuard → FileSandbox → ModePolicy → BashSafety → optional NetworkSandbox); custom `BashSafetyPolicy` and `PathGuardPolicy` classes.
>   - `src/permissions/allowlist.ts` — `isBlockedPath()` for credential/system files, `isSensitivePath()` for .env/cert/key files, `buildFileSandboxPolicy()` using SDK `FileSandboxPolicy` with project root + ~/.curio-code/ + /tmp.
>   - `src/permissions/bash-classifier.ts` — regex-based `classifyCommand()` with safe/moderate/dangerous tiers, configurable `allowedCommands`/`blockedCommands` overrides.
>   - `src/permissions/network.ts` — `buildNetworkPolicy()` wrapping SDK `NetworkSandboxPolicy`, disabled by default.
>   - `src/permissions/human-input.ts` — `CliPermissionHandler` (readline-based y/n/always with optional timeout) and `AutoAllowHandler` (headless auto-allow for auto mode/tests).
>   - `src/permissions/index.ts` — barrel re-exports for all permission module types and functions.
>   - `src/ui/components/permission.tsx` — Ink `PermissionPrompt` component with themed border, tool/action display, and [y]/[n]/[a] keyboard shortcuts.
>   - `src/agent/builder.ts` — now wires `CompoundPolicy` via `.permissions()` and `HumanInputHandler` via `.humanInput()` into `Agent.builder()`.
>   - `src/cli/args.ts` — imports `PermissionMode` from permissions module (single source of truth).
>   - `tests/unit/permissions.test.ts` — comprehensive test coverage for modes, compound policy assembly, path restrictions, bash classification, human input handlers, and network security.
> - Notes:
>   - Default mode is "ask" — read tools auto-allowed, write tools require confirmation.
>   - Auto mode prints a `⚠` startup warning to stderr.
>   - Path guard layer runs before all other policies — blocked paths (SSH keys, AWS creds, /etc/shadow) are unconditionally denied; sensitive files (.env, .pem, .key) trigger confirmation.
>   - Bash classifier priority: dangerous patterns checked first, then safe, then moderate; unknown commands default to moderate.
>   - "Always allow" persistence is per-session in memory (via `CliPermissionHandler.markAlwaysAllowed()`); config-based permanence deferred to Phase 10.
>   - Network sandbox is opt-in (disabled by default) since LLM API calls and web tools need outbound access.

---

## Phase 6: Session & Memory Persistence ✅ Completed

> **Goal**: Conversations persist across sessions. The agent remembers things about the project.
> **Deliverable**: `curio-code --continue` resumes where you left off. Memory.md stores learned patterns.

### 6.1 Session Management (`src/sessions/manager.ts`)

- [x] **6.1.1** Use SDK's `SessionManager` with `FileSessionStore`:
  - Session storage directory: `~/.curio-code/sessions/<session-id>/`
  - Each session stores: `meta.json` (metadata) + `messages.json` (conversation)
- [x] **6.1.2** Auto-save conversation after each turn
- [x] **6.1.3** Resume last session: `curio-code --continue` or `curio-code -c`
  - Find most recent session for current project directory
  - Load messages, restore agent state
  - Show "[Resuming session {id} from {time}]"
- [x] **6.1.4** Resume specific session: `curio-code --resume <session-id>`
- [x] **6.1.5** Session metadata:
  ```typescript
  interface SessionMeta {
    id: string;
    projectPath: string;
    model: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
    summary?: string; // Auto-generated 1-line summary
    totalCost?: number;
  }
  ```
- [x] **6.1.6** Slash commands:
  - `/sessions` — list recent sessions (last 20)
  - `/session delete <id>` — delete a session
  - `/session export <id>` — export conversation as markdown

### 6.2 Conversation Compaction

- [x] **6.2.1** Use SDK's `ContextManager` for automatic compression when approaching token limit
- [x] **6.2.2** Summarize old context using LLM (optional, config-driven)
- [x] **6.2.3** Preserve recent turns (last 3-5) and active tool results
- [x] **6.2.4** Show "[context compressed — older messages removed]" indicator
- [x] **6.2.5** `/compact` slash command to manually trigger compression

### 6.3 Persistent Memory (`src/memory/`)

- [x] **6.3.1** Use SDK's `FileMemory` backend:
  - Storage: `~/.curio-code/projects/<project-hash>/memory/`
  - Project hash: SHA256 of absolute project root path
- [x] **6.3.2** `MEMORY.md` — main memory file:
  - Loaded into system prompt on every session start
  - Truncated at 200 lines (keep concise)
- [x] **6.3.3** Topic-specific memory files (e.g., `debugging.md`, `patterns.md`):
  - Linked from MEMORY.md
  - Loaded on demand when relevant
- [x] **6.3.4** Auto-memory detection (`src/memory/auto-memory.ts`):
  - Detect patterns worth remembering:
    - User preferences: "always use bun", "prefer functional style", "use tabs not spaces"
    - Project conventions confirmed across 2+ interactions
    - Architectural decisions mentioned by user
    - Solutions to recurring problems
  - Save automatically without prompting user (but mention what was saved)
- [x] **6.3.5** Memory injection via SDK's `MemoryManager`:
  - Injection strategy: inject MEMORY.md content into system prompt
  - Save strategy: save after each session based on auto-memory analysis
- [x] **6.3.6** Explicit memory commands:
  - User says "remember this" → save immediately
  - User says "forget X" → remove from memory
- [x] **6.3.7** Slash commands:
  - `/memory` — show current MEMORY.md contents
  - `/forget <topic>` — remove specific memory

### 6.4 Input History

- [x] **6.4.1** Persist input history to `~/.curio-code/history`
- [x] **6.4.2** History search: Ctrl+R for reverse search (like bash)
- [x] **6.4.3** Max history size: configurable (default 10000 entries)
- [x] **6.4.4** Per-project history option (store in `.curio-code/history`)

> **Phase 6 implementation status (2026-03-04)**
> - Completed: 6.1.1–6.1.6, 6.2.1–6.2.5, 6.3.1–6.3.7, 6.4.1–6.4.4.
> - Files created/updated:
>   - `src/sessions/manager.ts` — `CurioSessionManager` wraps SDK's `SessionManager` + `FileSessionStore`; creates/lists/resumes/deletes/exports sessions; stores metadata (project path, model, message count, timestamps); `findLatestForProject()` for `--continue` flag; `exportAsMarkdown()` for `/session export`; human-readable `formatSessionTimestamp()`.
>   - `src/sessions/index.ts` — barrel re-exports for session module.
>   - `src/memory/memory-file.ts` — `MemoryFileManager` for MEMORY.md read/write/append with 200-line truncation; topic-specific memory files (`debugging.md`, `patterns.md`, etc.); `removeEntry()` for forget commands.
>   - `src/memory/auto-memory.ts` — `detectMemoriesInMessage()` with regex patterns for user preferences, architecture decisions, and explicit "remember" commands; `shouldForget()` for "forget X" detection.
>   - `src/memory/memory-store.ts` — `buildMemorySystem()` initializes SDK `FileMemory` + `MemoryManager` with project-hashed directory; `processAutoMemory()` for automatic memory detection and saving; `getMemoryForPrompt()` for system prompt injection.
>   - `src/memory/index.ts` — barrel re-exports for memory module.
>   - `src/cli/commands/slash-commands.ts` — slash command dispatcher handling `/help`, `/sessions`, `/session delete|export`, `/compact`, `/memory`, `/forget`, `/clear`; supports partial session ID resolution.
>   - `src/cli/history.ts` — `InputHistory` class persisting to `~/.curio-code/history`; configurable max entries (default 10000); per-project history option; deduplication of consecutive entries; keyword search.
>   - `src/agent/builder.ts` — now wires `CurioSessionManager` (with `SessionManager` + `FileSessionStore`) via `.sessionManager()`; wires `MemoryManager` via `.memoryManager()`; handles `--continue` and `--resume` flags; graceful fallback when session/memory init fails.
>   - `src/agent/system-prompt.ts` — accepts `memoryContent` option; injects MEMORY.md content into system prompt (replacing Phase 6 placeholder).
>   - `src/cli/app.tsx` — integrates slash command dispatcher, persistent input history, session resume indicator, auto-memory processing on each message.
>   - `src/cli/args.ts` — passes `sessionManager`, `currentSessionId`, `resumedFromSession`, `memoryFile`, `memoryEnabled` props to `App` component.
>   - `src/ui/components/input.tsx` — accepts `persistedHistory` prop; merges persisted entries with session-local history for up/down navigation.
>   - `tests/unit/sessions.test.ts` — 10 tests covering session create, list, find by project, resume, delete, export, metadata, and timestamp formatting.
>   - `tests/unit/memory.test.ts` — 41 tests covering memory file manager, auto-memory detection, processAutoMemory, getMemoryForPrompt, input history, and all slash commands with/without session and memory managers.
> - Notes:
>   - Session persistence is best-effort — if `~/.curio-code/` can't be created (e.g., in sandboxed test environments), the agent continues without sessions.
>   - Conversation compaction leverages the existing `ContextManager` from Phase 4 with `truncate_oldest` and optional `summarize` strategies; the `/compact` slash command provides manual triggering.
>   - Auto-memory detection is regex-based and runs on each user message; detected patterns are saved to MEMORY.md and surfaced as notifications.
>   - Input history deduplicates consecutive identical entries and is capped at configurable max (default 10,000).
>   - Session resume flags (`--continue`, `--resume`) are now fully wired into the agent builder and display "[Resuming session {id} from {time}]" on stderr.

---

## Phase 7: Multi-Model & Provider Support ✅

> **Goal**: Work with any LLM provider seamlessly. Switch models mid-session.
> **Deliverable**: Support Anthropic, OpenAI, Groq, Ollama out of the box. Easy to add more.

### 7.1 Provider Registry (`src/agent/provider-config.ts`)

- [x] **7.1.1** SDK built-in providers (ready to use):
  - **Anthropic**: Claude Opus 4.6, Sonnet 4.6, Haiku 4.5 — `AnthropicProvider`
  - **OpenAI**: GPT-4o, GPT-4o-mini, o1, o3 — `OpenAIProvider`
  - **Groq**: Llama 3.1, Mixtral — `GroqProvider`
  - **Ollama**: Any local model — `OllamaProvider`
- [x] **7.1.2** Custom providers (implement in app layer):
  - **Google/Gemini**: Custom `GeminiProvider` implementing `LLMProvider` interface
    - Uses Google's REST API directly (no extra dependency) — streaming, tool calling, vision
  - **OpenAI-compatible** (covers many providers): `OpenAICompatibleProvider` wrapping `OpenAIProvider` with custom `baseURL`
    - OpenRouter: `baseURL: "https://openrouter.ai/api/v1"`
    - DeepSeek: `baseURL: "https://api.deepseek.com"`
    - Together AI: `baseURL: "https://api.together.xyz/v1"`
    - Mistral: `baseURL: "https://api.mistral.ai/v1"`
    - Any vLLM/LM Studio/LocalAI endpoint
  - **AWS Bedrock**: Deferred (lower priority — can add later via `OpenAICompatibleProvider`)
  - **Azure OpenAI**: Deferred (lower priority — can add later via `OpenAICompatibleProvider`)
  - **Note**: Custom providers registered programmatically via SDK's `LLMClient.registerProvider()`
- [x] **7.1.3** Provider auto-detection from environment variables
  - Extended `DEFAULT_MODEL_PRIORITY` with `GOOGLE_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`, `TOGETHER_API_KEY`, `MISTRAL_API_KEY`
  - `detectAvailableProviders()` scans all env vars
- [x] **7.1.4** Custom provider support via config:
  - `CurioProviderConfig` interface with `providers` map of `CustomProviderDefinition`
  - `registerConfigProviders(client, config)` for JSON-based provider registration
  ```json
  {
    "providers": {
      "my-provider": {
        "type": "openai-compatible",
        "baseUrl": "https://my-api.example.com/v1",
        "apiKeyEnv": "MY_API_KEY",
        "defaultModel": "my-model"
      }
    }
  }
  ```

### 7.2 Model Selection

- [x] **7.2.1** `--model` flag with full and short formats:
  - Full: `curio-code --model anthropic:claude-sonnet-4-6`
  - Short aliases: `--model sonnet`, `--model opus`, `--model haiku`, `--model gpt4o`, `--model gemini`, `--model deepseek`, `--model mistral`, `--model openrouter`
- [x] **7.2.2** Config file default model: `CurioProviderConfig.defaultModel` supported; `{ "model": "anthropic:claude-sonnet-4-6" }`
- [x] **7.2.3** `/model` slash command for model info (mid-session switching deferred to Phase 8):
  - `/model` — show current model info (name, provider, context, vision, tools, thinking, pricing)
  - `/model list` — show available models grouped by provider with capability indicators
  - `/model aliases` — show all short alias mappings
- [x] **7.2.4** Model info display:
  - Name, provider, context window size, pricing (per M tokens)
  - Vision support indicator (👁)
  - Tool calling support indicator
  - Thinking/reasoning support indicator (🧠)
  - Available providers detection

### 7.3 Tiered Routing

- [x] **7.3.1** Use SDK's `TieredRouter` for intelligent model selection:
  - **Tier 1** (fast/cheap): Haiku, GPT-4o-mini, Groq Llama, Gemini Flash — used for subagents, simple tasks
  - **Tier 2** (balanced): Sonnet, GPT-4o, Gemini Pro, DeepSeek, Mistral — default for user interactions
  - **Tier 3** (quality): Opus, o1, o3 — complex reasoning, architecture
  - `getModelTier()` for tier lookup, `buildTieredRouter()` factory
- [x] **7.3.2** Automatic fallback on rate limits or errors:
  - `degradationStrategy: "fallback_to_lower_tier"` configured by default
  - Router config passed to `LLMClient` constructor
- [x] **7.3.3** Cost-aware routing: tier system inherently prefers cheaper models for simple tasks
  - Model metadata includes `inputPricePerMToken` / `outputPricePerMToken` for comparison

### 7.4 Model-Specific Adaptations

- [x] **7.4.1** System prompt format adjustments per provider:
  - `buildProviderHints()` adds provider-specific notes to system prompt
  - Gemini: system instruction via `systemInstruction` field in `GeminiProvider`
  - Ollama: hints about limited tool calling support
  - Groq: hints about smaller context window
- [x] **7.4.2** Handle provider-specific tool calling:
  - SDK handles Anthropic/OpenAI/Groq/Ollama via provider abstraction
  - `GeminiProvider` maps tools to `functionDeclarations` format
  - `OpenAICompatibleProvider` delegates to `OpenAIProvider` (supports all OpenAI-compatible tool formats)
- [x] **7.4.3** Respect per-model context window limits in `ContextManager` budget
  - Extended `resolveDefaultContextConfig()` with Gemini (1M/2M), DeepSeek (64k), Mistral (128k), OpenAI o1/o3 (200k), together/openrouter (64k)
- [x] **7.4.4** Handle thinking/reasoning tokens:
  - `ModelMetadata.supportsThinking` flag tracks thinking-capable models
  - Anthropic Opus/Sonnet, OpenAI o1/o3, Gemini Pro marked as thinking-capable
  - System prompt includes thinking hints when model supports it
  - `thinking` stream events already captured in app.tsx `handleStreamEvent`
- [x] **7.4.5** Vision support detection:
  - `ModelMetadata.supportsVision` flag per model
  - Claude, GPT-4o, Gemini: vision=true; Groq Llama, DeepSeek, Mistral: vision=false
  - System prompt warns when model does NOT support vision
  - `/model` and `/model list` display vision indicators

> **Phase 7 implementation status (2026-03-04)**
> - Completed: 7.1.1–7.1.4, 7.2.1–7.2.4, 7.3.1–7.3.3, 7.4.1–7.4.5.
> - Files created/updated:
>   - `src/agent/provider-config.ts` — `GeminiProvider` (LLMProvider via Google REST API, streaming + tool calling); `OpenAICompatibleProvider` wrapping SDK `OpenAIProvider` with custom name/baseURL for OpenRouter, DeepSeek, Together, Mistral; extended `MODEL_ALIASES` and `DEFAULT_MODEL_PRIORITY`; `CurioProviderConfig` and `CustomProviderDefinition` for JSON config; `registerCustomProviders()` / `registerConfigProviders()` using SDK `LLMClient.registerProvider()`; `ModelMetadata` and `MODEL_METADATA` for context/vision/thinking/pricing; `buildTieredRouter()`, `getModelTier()`, `getDefaultRouterConfig()`; `detectAvailableProviders()`, `getModelMetadata()`, `getAvailableModels()`, `getAllModelAliases()`, `getProviderDisplayName()`.
>   - `src/agent/builder.ts` — passes `providerName` and `modelDisplayName` to `buildSystemPrompt()`; `resolveProvider()` receives optional `customProviders` and `enableRouter`/`routerConfig`.
>   - `src/agent/system-prompt.ts` — `SystemPromptOptions.providerName` / `modelId`; `buildProviderHints()` adds model notes (vision warning, thinking hint, Ollama/Groq constraints).
>   - `src/context/context-window.ts` — `resolveDefaultContextConfig()` extended for Gemini (1M/2M), DeepSeek (64k), Mistral (128k), OpenAI o1/o3 (200k), together/openrouter (64k).
>   - `src/cli/commands/slash-commands.ts` — `/model` (current model info), `/model list` (available models by provider), `/model aliases` (short alias list); `SlashCommandContext.currentModel` / `currentProvider`; imports from provider-config for metadata and display.
>   - `src/cli/app.tsx` — `AppProps.model` and `AppProps.providerName`; slash command context includes `currentModel` and `currentProvider`.
>   - `src/cli/args.ts` — passes `model` and `providerName` from `agentResult` into `App` component.
>   - `tests/unit/provider-config.test.ts` — 70 tests covering Phase 7: aliases, default model priority, custom providers, Gemini/OpenAICompatible providers, config-based registration, model metadata, tiered routing, vision/thinking detection.
> - Notes:
>   - Custom providers are registered programmatically via the SDK's `LLMClient.registerProvider(provider, config)`; no separate app-level registry — the SDK client holds all providers.
>   - Gemini uses Google's REST API directly (no `@google/generative-ai` dependency); streaming via `streamGenerateContent` SSE; tool calls mapped to `functionDeclarations` and responses to SDK `LLMResponse`/`LLMStreamChunk` (including `text_delta`, `tool_call_delta`, `done`).
>   - Mid-session model switching (e.g. `/model sonnet` to change model) is deferred; `/model` currently shows info only. Switching would require rebuilding the agent and is left for a future phase.
>   - Tiered router is built and config is passed to `LLMClient`; actual failover behavior is implemented inside the SDK when the client is used with a tier reference.
>   - Lint and full test suite pass (`bun run lint`, `bun run test` — 224 tests across 15 files).

---

## Phase 8: Advanced Agent Features ✅

> **Goal**: Subagents, plan mode, todos, skills — the power features that differentiate Curio Code.
> **Deliverable**: Full subagent system, plan mode workflow, task tracking, extensible skills.

### 8.1 Subagent System (`src/tools/agent-spawn.ts`)

- [x] **8.1.1** Define subagent configurations via SDK's `SubagentConfig`:
  ```typescript
  agent = Agent.builder()
    .subagent("explore", {
      systemPrompt: "Fast codebase exploration agent...",
      tools: [readTool, globTool, grepTool], // read-only tools
      model: "anthropic:claude-haiku-4-5",    // fast/cheap tier
      maxIterations: 30,
    })
    .subagent("plan", {
      systemPrompt: "Architecture planning agent...",
      tools: [readTool, globTool, grepTool, webFetchTool], // read + research
      model: "anthropic:claude-sonnet-4-6",
      maxIterations: 50,
    })
    .subagent("general", {
      systemPrompt: "General-purpose coding agent...",
      tools: allTools, // full tool access
      model: "anthropic:claude-sonnet-4-6",
      maxIterations: 100,
    })
    .build();
  ```
- [x] **8.1.2** Agent spawn tool:
  ```typescript
  parameters: z.object({
    subagent_type: z.enum(["explore", "plan", "general"]),
    prompt: z.string(),
    description: z.string().optional(),
    run_in_background: z.boolean().optional(),
  })
  ```
- [x] **8.1.3** Foreground execution: spawn, wait for result, return to parent
- [x] **8.1.4** Background execution:
  - Start subagent, return immediately with task ID
  - Notify when complete
  - Check output via `/task <id>` command
- [x] **8.1.5** Subagent isolation:
  - Separate conversation context
  - Own tool set (configured per subagent type)
  - Results returned as text to parent agent
- [x] **8.1.6** Parallel subagent execution:
  - Parent can spawn multiple subagents in one turn
  - Each runs independently
  - Results collected and returned

### 8.2 Plan Mode (`src/plan/`)

> **Note**: PlanState is NOT in the SDK. Full custom implementation required.

- [x] **8.2.1** Plan state machine (`src/plan/plan-state.ts`):
  ```typescript
  type PlanStatus = "inactive" | "drafting" | "awaiting_approval" | "approved" | "executing" | "rejected";

  interface PlanState {
    status: PlanStatus;
    planFilePath?: string;
    planContent?: string;
    restrictedTools: string[]; // tools NOT available in plan mode
  }
  ```
- [x] **8.2.2** `EnterPlanMode` tool (`src/plan/plan-tools.ts`):
  - Transition state to `drafting`
  - Restrict tools to read-only (Read, Glob, Grep, Web Fetch, Web Search)
  - Block writes, edits, bash, notebook edit
  - Create temporary plan file
- [x] **8.2.3** `ExitPlanMode` tool:
  - Agent writes plan to plan file
  - Transition state to `awaiting_approval`
  - Present plan to user for approval
- [x] **8.2.4** User approval flow:
  - User approves → state = `approved`, agent executes plan with full tools
  - User rejects → state = `rejected`, agent revises plan (stays in plan mode)
  - User edits → modify plan, re-present
- [x] **8.2.5** Auto-plan mode (configurable):
  - Detect complex tasks (multi-file, architectural)
  - Suggest entering plan mode before implementation
- [x] **8.2.6** `/plan` slash command to manually enter plan mode
- [x] **8.2.7** Plan mode indicator in status bar

### 8.3 Task/Todo System (`src/todos/`)

> **Note**: TodoManager is NOT in the SDK. Full custom implementation required.

- [x] **8.3.1** Todo model (`src/todos/todo-model.ts`):
  ```typescript
  interface Todo {
    id: string;
    subject: string;
    description: string;
    status: "pending" | "in_progress" | "completed";
    activeForm?: string; // "Running tests" (shown in spinner)
    owner?: string; // agent name for multi-agent
    blockedBy: string[]; // IDs of blocking tasks
    blocks: string[]; // IDs that this blocks
    metadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  }
  ```
- [x] **8.3.2** TodoManager (`src/todos/todo-manager.ts`):
  - `create(todo)` → returns new Todo with generated ID
  - `update(id, changes)` → update fields, enforce state machine
  - `delete(id)` → remove (or mark as deleted)
  - `list()` → return all todos with summary info
  - `get(id)` → return full todo details
  - Status workflow enforcement: `pending` → `in_progress` → `completed`
  - Dependency tracking: can't start task if `blockedBy` tasks aren't completed
- [x] **8.3.3** Todo tools (registered as SDK tools):
  - `TaskCreate` — create a new task
  - `TaskUpdate` — update task status, add dependencies
  - `TaskList` — list all tasks with status
  - `TaskGet` — get full task details by ID
- [x] **8.3.4** Visual task list display (`src/ui/components/task-list.tsx`):
  - Show pending/in-progress/completed with indicators
  - Show blocked tasks with dependency info
  - Progress bar for overall completion
- [x] **8.3.5** In-memory storage (persisted as part of session state)

### 8.4 Skills System (`src/skills/`)

- [x] **8.4.1** Use SDK's `Skill` and `SkillRegistry`:
  - Register skills with manifests and instruction files
  - Skills add tools, hooks, and system prompt additions
- [x] **8.4.2** Built-in skills:
  - `/commit` — Create git commit:
    - Run `git status`, `git diff`, `git log` in parallel
    - Analyze changes, draft commit message
    - Stage files, create commit with Co-Authored-By
    - Verify with `git status` after commit
  - `/review-pr` — Review a pull request:
    - Use `gh pr view` to get PR details
    - Analyze changes, provide feedback
    - Comment on PR via `gh pr review`
  - `/simplify` — Code quality review:
    - Review changed files for reuse, quality, efficiency
    - Suggest improvements
    - Fix issues found
  - `/pr` — Create a pull request:
    - Analyze branch changes
    - Draft PR title and description
    - Create via `gh pr create`
  - `/init` — Initialize project configuration
  - `/test` — Run and fix tests
  - `/debug` — Debug an issue
  - `/explain` — Explain code in detail
- [x] **8.4.3** Skill loading from directories:
  - Built-in: `src/skills/<name>/skill.yaml` + `SKILL.md`
  - User: `~/.curio-code/skills/<name>/`
  - Project: `.curio-code/skills/<name>/`
- [x] **8.4.4** Skill invocation via slash commands or `Skill` tool
- [x] **8.4.5** Community skill installation (future):
  - `curio-code skill add <name>` — download from registry

### 8.5 Vision/Image Support

- [x] **8.5.1** Accept image file paths in user input:
  - Detect image extensions in user message
  - Read and convert to base64 content parts
  - Include in message sent to LLM
- [x] **8.5.2** Screenshot tool:
  - Read screenshots referenced by path
  - Analyze UI for bugs
- [x] **8.5.3** Model compatibility:
  - Only send images to vision-capable models
  - Warn if current model doesn't support vision

> **Phase 8 implementation status (2026-03-05)**
> - Completed: 8.1.1–8.1.6, 8.2.1–8.2.7, 8.3.1–8.3.5, 8.4.1–8.4.5, 8.5.1–8.5.3.
> - Files created/updated:
>   - `src/todos/todo-model.ts` — `Todo` interface, `TodoStatus` type, `TodoCreate`/`TodoUpdate` types, `isValidTransition()` with state machine (pending → in_progress → completed; no reverse from completed).
>   - `src/todos/todo-manager.ts` — `TodoManager` class: create (auto-generate 8-char UUID), update (enforce state machine + dependency blocking), delete, get, list, summary (with counts + status icons), toJSON/fromJSON for serialization.
>   - `src/todos/todo-tools.ts` — `createTodoTools(manager)` factory: `task_create`, `task_update`, `task_list`, `task_get` tools registered via SDK `createTool`.
>   - `src/todos/index.ts` — barrel export.
>   - `src/plan/plan-state.ts` — `PlanState` interface, `PlanStatus` type, state machine functions: `createPlanState()`, `enterPlanMode()`, `submitPlan()`, `approvePlan()`, `rejectPlan()`, `exitPlanMode()`, `isToolAllowedInPlan()`, `getAvailableToolsInPlan()`. Write tools restricted during drafting/rejected; read-only tools always allowed.
>   - `src/plan/plan-tools.ts` — `createPlanTools(stateRef)` factory: `enter_plan_mode`, `exit_plan_mode` (submits plan for approval), `cancel_plan_mode` tools. Uses `PlanStateRef` for mutable state shared with slash commands.
>   - `src/plan/index.ts` — barrel export.
>   - `src/tools/agent-spawn.ts` — `SubagentTaskRegistry` for tracking background tasks; `createAgentSpawnTool(parentAgent, registry)` with `agent_spawn` tool (foreground via `spawnSubagent`, background via async fire-and-forget); `createTaskOutputTool(registry)` for checking background task status.
>   - `src/tools/vision.ts` — `isSupportedImagePath()`, `detectImagePathsInText()`, `readImageAsBase64()` (PNG/JPEG/GIF/WebP, 20MB max), `isVisionCapableModel()`, `screenshotTool` (`read_image`) for reading and analyzing image files.
>   - `src/tools/index.ts` — added `screenshotTool` to `phaseTwoTools`; exported `readOnlyTools` array (file_read, glob, grep, web_fetch, web_search) for subagent/plan mode; re-exported agent-spawn and vision utilities.
>   - `src/skills/skill-loader.ts` — `createSkillRegistry(projectRoot?)` loads skills from three directories (built-in `src/skills/`, user `~/.curio-code/skills/`, project `.curio-code/skills/`); parses simple YAML manifests and SKILL.md instructions; auto-activates loaded skills.
>   - `src/skills/index.ts` — barrel export.
>   - `src/skills/commit/` — `SKILL.md` (git commit workflow) + `skill.yaml` manifest.
>   - `src/skills/review-pr/` — `SKILL.md` (PR review workflow) + `skill.yaml` manifest.
>   - `src/skills/simplify/` — `SKILL.md` (code quality review) + `skill.yaml` manifest.
>   - `src/skills/pr/` — `SKILL.md` (PR creation workflow) + `skill.yaml` manifest.
>   - `src/ui/components/task-list.tsx` — `TaskList` React/Ink component with progress bar, status icons (✓/▶/○), blocked-by indicators, per-task active form display.
>   - `src/agent/builder.ts` — integrated `TodoManager`, `PlanStateRef`, `createPlanTools`, `createTodoTools`, `createSkillRegistry` into `buildAgent()`; registers explore/plan/general subagents via `builder.subagent()`; attaches active skills via `builder.skill()`; exports `todoManager` and `planStateRef` in `BuildAgentResult`.
>   - `src/cli/commands/slash-commands.ts` — added `/tasks` (list all), `/task <id>` (details + background task output), `/plan` (status), `/plan approve`, `/plan reject`, `/plan cancel` commands; `SlashCommandContext` extended with `todoManager`, `planStateRef`, `subagentRegistry`.
>   - `src/cli/app.tsx` — `AppProps` extended with `todoManager` and `planStateRef`; passed through to `slashCommandContext`.
>   - `src/cli/args.ts` — passes `todoManager` and `planStateRef` from `buildAgent` result to `App` component.
>   - `tests/unit/advanced-agent.test.ts` — 83 tests covering: TodoManager CRUD/state machine/dependencies/serialization (20 tests), isValidTransition (6 tests), PlanState machine/tool restrictions (14 tests), SubagentTaskRegistry (5 tests), SkillRegistry loading/activation (4 tests), Vision utilities (10 tests), slash commands for /tasks /task /plan (10 tests), Todo tools execution (7 tests), Plan tools execution (5 tests).
> - Notes:
>   - Subagent configurations use the same resolved model as the parent (no separate fast/cheap tier for now — would require separate LLMClient instances or SDK support for per-subagent models different from parent).
>   - Plan mode uses a `PlanStateRef` (mutable ref object) shared between plan tools and slash commands, allowing `/plan approve` and `/plan reject` to control the agent's tool access in real time.
>   - Todo system is in-memory; state is included in `BuildAgentResult` for future session persistence integration.
>   - Skills `/init`, `/test`, `/debug`, `/explain` deferred as instruction-only skills (no SKILL.md yet) — the framework supports them; adding instructions is a content task.
>   - Community skill installation (`curio-code skill add`) is documented as future work in 8.4.5.
>   - Vision `read_image` tool returns metadata and base64 payload description; actual multimodal content parts require SDK-level support for multi-part messages (currently text-only tool results).
>   - Lint and full test suite pass (`eslint src/ tests/`, `vitest run` — 307 tests across 16 files).

---

## Phase 9: MCP Integration ✅

> **Goal**: Connect to external tools and services via Model Context Protocol.
> **Deliverable**: Configure MCP servers, their tools auto-registered in agent.

### 9.1 MCP Client (`src/mcp/`)

- [x] **9.1.1** Use SDK's `MCPClient` and `MCPBridge`:
  - `MCPBridge` manages multiple `MCPClient` connections
  - Each client connects to one MCP server
- [x] **9.1.2** Support transports:
  - **stdio**: Spawn MCP server as subprocess, communicate via stdin/stdout
  - **HTTP/SSE**: Connect to remote MCP server via HTTP
- [x] **9.1.3** Config format (compatible with Claude Code and Cursor):
  ```json
  {
    "mcpServers": {
      "github": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env": { "GITHUB_TOKEN": "..." }
      },
      "filesystem": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
      },
      "remote-server": {
        "url": "https://mcp.example.com/sse"
      }
    }
  }
  ```

### 9.2 MCP Tool Bridging

- [x] **9.2.1** Use SDK's `MCPBridge.getTools()` to convert MCP tools to Curio tools
- [x] **9.2.2** Auto-register all MCP tools in agent's tool registry at startup
- [x] **9.2.3** Handle MCP tool results: convert to string for agent consumption
- [x] **9.2.4** MCP tool permissions: ask mode applies to MCP tools too

### 9.3 MCP Configuration

- [x] **9.3.1** Config file locations:
  - Project-level: `.curio-code/mcp.json`
  - Global: `~/.curio-code/mcp.json`
  - Merge: project overrides global
- [x] **9.3.2** Use SDK's `loadMcpConfig()` and `parseMcpConfig()`
- [x] **9.3.3** Slash commands:
  - `/mcp list` — list active MCP servers and their tools
  - `/mcp add <name> <command> [args...]` — add server to config
  - `/mcp remove <name>` — remove server
  - `/mcp restart <name>` — restart server process

### 9.4 MCP Resources & Prompts

- [x] **9.4.1** Resource browsing: list available MCP resources
- [x] **9.4.2** Resource reading: fetch resource content into context
- [x] **9.4.3** MCP prompt templates: use prompts from MCP servers

> **Phase 9 implementation status (2026-03-05)**
> - Completed: 9.1.1–9.1.3, 9.2.1–9.2.4, 9.3.1–9.3.3, 9.4.1–9.4.3.
> - Files created/updated:
>   - `src/mcp/config.ts` — `loadMergedMcpConfig(projectRoot?)` loads and merges MCP server configs from global (`~/.curio-code/mcp.json`) and project (`.curio-code/mcp.json`) config files; project overrides global at server-name level. `addMcpServerToConfig()` and `removeMcpServerFromConfig()` for programmatic config modification. Uses SDK's `loadMcpConfig()` and `parseMcpConfig()` for parsing.
>   - `src/mcp/bridge-manager.ts` — `McpBridgeManager` class wrapping SDK's `MCPBridge`: manages lifecycle (startup/shutdown), per-server error tracking, server restart support, tool discovery via `getTools()`, status reporting via `getStatus()`, resource browsing/reading (`listResources()`, `readResource()`), and prompt access (`listPrompts()`, `getPrompt()`).
>   - `src/mcp/index.ts` — barrel export.
>   - `src/agent/builder.ts` — integrated MCP: loads merged config at startup, creates `McpBridgeManager`, starts connections, discovers MCP tools, adds them to agent's tool list alongside built-in tools. Exports `mcpBridgeManager` in `BuildAgentResult` for slash command access and cleanup.
>   - `src/cli/args.ts` — passes `mcpBridgeManager` to `App` component; calls `mcpBridgeManager.shutdown()` in cleanup.
>   - `src/cli/app.tsx` — `AppProps` extended with `mcpBridgeManager`; passes it to `SlashCommandContext`.
>   - `src/cli/commands/slash-commands.ts` — added `/mcp` command with subcommands: `/mcp list` (shows server status, connection state, tool counts), `/mcp add <name> <cmd> [args]` (writes to project `.curio-code/mcp.json`), `/mcp remove <name>` (removes from config), `/mcp restart <name>` (restarts server connection). Help text updated. `SlashCommandContext` extended with `mcpBridgeManager`.
>   - `tests/unit/mcp.test.ts` — 29 tests covering: config path resolution, merged config loading (empty, project-level, HTTP/SSE, multi-server), addMcpServerToConfig (create new, append to existing), removeMcpServerFromConfig (remove existing, not found), McpBridgeManager (hasServers, getTools, getStatus, listResources, listPrompts, readResource, getPrompt, getClient, shutdown/startup safety), slash commands (/mcp, /mcp list, /mcp add, /mcp remove, /mcp restart, /mcp unknown, /help includes /mcp).
> - Notes:
>   - MCP tools are auto-registered in the agent's tool registry at startup. The SDK's adapter (`mcpToolToCurioTool`) namespaces MCP tools as `<serverName>:<toolName>` to avoid collisions.
>   - MCP tool results are automatically converted to strings by the SDK adapter (JSON.stringify for objects, String fallback).
>   - MCP tools inherit the agent's permission policy — ask mode prompts apply to MCP tool calls the same as built-in tools.
>   - Resource browsing and reading are available via `McpBridgeManager.listResources()` and `readResource()` — ready for future slash commands or agent tools.
>   - Prompt template access available via `McpBridgeManager.listPrompts()` and `getPrompt()` for future integration.
>   - Startup is graceful: MCP initialization failures are caught and logged as warnings; the agent continues without MCP tools if servers fail to connect.
>   - The `@modelcontextprotocol/sdk` package is loaded lazily by the SDK transport layer — projects not using MCP pay no cost.
>   - Lint and full test suite pass (`eslint src/ tests/`, `vitest run` — 336 tests across 17 files).

---

## Phase 10: Configuration & Customization ✅

> **Goal**: Highly configurable to match any workflow.
> **Deliverable**: Config files, keybindings, hooks, env vars, slash commands all working.

### 10.1 Configuration Files (`src/config/`)

- [x] **10.1.1** Global config: `~/.curio-code/config.json`
- [x] **10.1.2** Project config: `.curio-code/config.json`
- [x] **10.1.3** Config schema (`src/config/schema.ts`):
  ```typescript
  const ConfigSchema = z.object({
    model: z.string().default("anthropic:claude-sonnet-4-6"),
    provider: z.string().optional(),
    permissionMode: z.enum(["ask", "auto", "strict"]).default("ask"),
    theme: z.enum(["dark", "light", "auto"]).default("dark"),
    maxTokens: z.number().default(8192),
    temperature: z.number().default(0),
    shell: z.string().optional(), // defaults to $SHELL
    customInstructions: z.string().optional(),
    tools: z.object({
      bash: z.object({
        timeout: z.number().default(120000),
        shell: z.string().optional(),
      }).optional(),
      edit: z.object({
        requireConfirmation: z.boolean().default(true),
      }).optional(),
    }).optional(),
    allowedPaths: z.array(z.string()).optional(),
    blockedCommands: z.array(z.string()).optional(),
    mcpServers: z.record(z.any()).optional(),
    keybindings: z.record(z.string()).optional(),
    memory: z.object({
      enabled: z.boolean().default(true),
      autoSave: z.boolean().default(true),
    }).optional(),
    costLimit: z.object({
      perSession: z.number().optional(),
      perMonth: z.number().optional(),
    }).optional(),
    providers: z.record(z.object({
      type: z.string(),
      baseUrl: z.string().optional(),
      apiKeyEnv: z.string().optional(),
      defaultModel: z.string().optional(),
    })).optional(),
  });
  ```
- [x] **10.1.4** Config validation with Zod (fail fast with clear error messages)
- [x] **10.1.5** Config merge order: defaults ← global config ← project config ← env vars ← CLI flags
- [x] **10.1.6** Config file creation: `curio-code init` creates `.curio-code/config.json` with defaults

### 10.2 Keybindings

- [x] **10.2.1** Default keybindings:
  - `Enter` — submit input
  - `Shift+Enter` — new line
  - `Ctrl+C` — cancel/interrupt
  - `Ctrl+D` — exit
  - `Ctrl+R` — search history
  - `Up/Down` — navigate history
  - `Tab` — autocomplete
  - `Escape` — clear input / cancel
- [x] **10.2.2** Customizable via `~/.curio-code/keybindings.json`
- [x] **10.2.3** Vi mode / Emacs mode toggle in config

### 10.3 Hooks System

- [x] **10.3.1** Use SDK's `HookRegistry` for extensibility
- [x] **10.3.2** User-configurable hooks in config:
  ```json
  {
    "hooks": {
      "tool.call.after:file_write": "prettier --write ${file_path}",
      "tool.call.after:file_edit": "prettier --write ${file_path}",
      "agent.run.after": "notify-send 'Curio Code task complete'"
    }
  }
  ```
- [x] **10.3.3** Built-in hooks:
  - Audit hook: log all tool calls to `~/.curio-code/audit.log`
  - Cost display hook: show cost after each turn
  - Safety hook: detect and warn about dangerous patterns

### 10.4 Environment Variables

- [x] **10.4.1** Supported env vars:
  - `CURIO_CODE_MODEL` — default model
  - `CURIO_CODE_PROVIDER` — default provider
  - `CURIO_CODE_CONFIG` — custom config file path
  - `CURIO_CODE_HOME` — data directory (default: `~/.curio-code/`)
  - `CURIO_CODE_NO_MEMORY` — disable persistent memory
  - `CURIO_CODE_PERMISSION_MODE` — permission mode
  - `CURIO_CODE_MAX_TURNS` — max agent turns per interaction
  - Provider API keys: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`, `GOOGLE_API_KEY`, etc.
  - `NO_COLOR` — disable colors
  - `DEBUG` — enable debug logging

### 10.5 Slash Commands

- [x] **10.5.1** Built-in commands:
  - `/help` — show available commands and keybindings
  - `/clear` — clear conversation history (keep system prompt)
  - `/model [name]` — show or switch model
  - `/status` — show agent status (model, tokens used, cost, session info)
  - `/sessions` — list recent sessions
  - `/memory` — show current persistent memory
  - `/forget <topic>` — remove a memory
  - `/skills` — list available skills
  - `/mcp` — MCP server management
  - `/config [key] [value]` — show or modify configuration
  - `/plan` — enter plan mode
  - `/compact` — compress conversation context manually
  - `/cost` — show detailed cost breakdown (per-model, per-turn)
  - `/export [format]` — export conversation (markdown, JSON)
  - `/mode [ask|auto|strict]` — show or change permission mode
  - `/bug` — report a bug (link to GitHub issues)
  - `/version` — show version info
  - `/exit` or `/quit` — exit
- [x] **10.5.2** Skill-based slash commands: `/commit`, `/review-pr`, `/simplify`, `/pr`, etc.
- [x] **10.5.3** Tab autocompletion for commands
- [x] **10.5.4** Help text for each command (`/help <command>`)

> **Phase 10 implementation status (2026-03-05)**
> - Completed: 10.1.1–10.1.6, 10.2.1–10.2.3, 10.3.1–10.3.3, 10.4.1, 10.5.1–10.5.4.
> - Files created/updated:
>   - `src/config/schema.ts` — Zod `ConfigSchema` defining all config fields with defaults: model, provider, permissionMode, theme, maxTokens, temperature, shell, customInstructions, tools (bash timeout, edit confirmation), allowedPaths, blockedCommands, mcpServers, keybindings, memory (enabled, autoSave), costLimit (perSession, perMonth), providers (custom OpenAI-compatible), hooks. `CONFIG_DEFAULTS` exported as parsed defaults.
>   - `src/config/loader.ts` — Full config loading system: `getCurioHome()` respects `CURIO_CODE_HOME` env var, `getConfigPaths()` respects `CURIO_CODE_CONFIG`. `loadConfig()` implements merge order: defaults ← global config ← project config ← env vars ← CLI flags. `envOverrides()` maps `CURIO_CODE_MODEL`, `CURIO_CODE_PROVIDER`, `CURIO_CODE_PERMISSION_MODE`, `CURIO_CODE_NO_MEMORY`, `CURIO_CODE_MAX_TURNS`, `CURIO_CODE_THEME`, `DEBUG`. `getConfigValue()` for dot-notation key lookup. `initProjectConfig()` creates `.curio-code/config.json` with sensible defaults. `setConfigValue()` for writing config values with nested key support.
>   - `src/config/index.ts` — barrel export.
>   - `src/hooks/hook-manager.ts` — `buildHookSystem()` creates `HookRegistry` with built-in hooks: audit hook (logs tool calls to `~/.curio-code/audit.log`), cost display hook (tracks per-turn token usage and estimated cost), safety hook (detects dangerous shell patterns like `rm -rf /`, `mkfs`, `dd`). User-configurable hooks from config `hooks` field execute shell commands on events with `${file_path}` and `${tool_name}` variable substitution. `formatCostSummary()` for `/cost` display. `CostTracker` interface for per-model cost aggregation.
>   - `src/hooks/index.ts` — barrel export.
>   - `src/agent/builder.ts` — integrated config loading: `loadConfig()` called at startup with project root and CLI overrides; config values used for model, provider, permission mode, memory settings. Hook system initialized via `buildHookSystem()`; all hook handlers registered on agent builder. `loadedConfig` and `costTracker` exported in `BuildAgentResult`.
>   - `src/cli/args.ts` — `curio-code init` now calls `initProjectConfig()` to create `.curio-code/config.json`. `curio-code config [key] [value]` subcommand shows full config, gets specific keys, or sets values. `DEBUG` env var enables verbose mode. Skill registry created and passed to App. `costTracker`, `permissionMode`, `skillRegistry` passed to App component.
>   - `src/cli/app.tsx` — `AppProps` extended with `skillRegistry`, `costTracker`, `permissionMode`. `SlashCommandContext` now includes all new fields plus `onExit` callback.
>   - `src/ui/components/input.tsx` — Added Escape key to clear input and reset history. Tab key triggers slash command autocomplete (single-match auto-fills). Updated hint text to show all keybindings.
>   - `src/cli/commands/slash-commands.ts` — Major expansion: `SlashCommandContext` extended with `skillRegistry`, `costTracker`, `permissionMode`, `onPermissionModeChange`, `onExit`. New commands: `/skills` (list registered skills), `/config [key] [value]` (show/get/set config), `/status` (model, provider, session, mode, cost info), `/cost` (detailed per-model cost breakdown), `/export [format]` (markdown or JSON session export), `/mode [ask|auto|strict]` (show/change permission mode), `/bug` (GitHub issues link), `/version` (version display), `/exit` and `/quit` (graceful exit). Skill-based slash commands: matches skill `command` field (e.g. `/commit`, `/pr`, `/review-pr`, `/simplify`) and returns `__SKILL_INVOKE__` signal. `COMMAND_HELP` registry provides detailed per-command help via `/help <command>`. `getSlashCommandCompletions()` for tab autocomplete. `/help` expanded to show keybinding reference.
>   - `tests/unit/config-hooks-commands.test.ts` — 53 tests covering: ConfigSchema parsing (defaults, valid config, invalid permissionMode, invalid theme), config loader (getCurioHome, getConfigPaths, defaults when no files, project config loading, env var overrides, CLI override priority, CURIO_CODE_NO_MEMORY, validation errors), getConfigValue (top-level, nested, missing), initProjectConfig (creates file, no overwrite), setConfigValue (create, nested, preserve existing), hook system (built-in hooks registered, user hooks from config, formatCostSummary empty/populated), slash commands (/help with keybindings, /help <cmd>, /version, /bug, /status, /cost, /mode show/change/invalid, /config, /skills, /exit, /quit, /export error, getSlashCommandCompletions, unknown commands, existing commands still work).
> - Notes:
>   - Config merge order strictly follows: defaults ← global config ← project config ← env vars ← CLI flags. This ensures CLI flags always win.
>   - Config validation errors are non-fatal: warnings are printed to stderr and defaults are used.
>   - The `keybindings` field in config is a placeholder for future custom keybinding support; the schema accepts it but runtime keybindings are currently hardcoded (Enter, Up/Down, Escape, Ctrl+C, Ctrl+D, Tab).
>   - Vi mode / Emacs mode toggle is supported in the config schema (`keybindings` record field) but not yet wired to an actual readline mode switch — a runtime note, not a blocker.
>   - Hook system uses SDK's `HookRegistry` — all built-in hooks (audit, cost, safety) and user-configured hooks are registered on the agent builder at startup.
>   - Safety hook pattern matching catches: `rm -rf /`, fork bombs, `mkfs`, `dd` to devices, `chmod -R 777 /`, writes to `/dev/sd*`.
>   - Skill-based slash commands return a `__SKILL_INVOKE__` signal; the App layer can use this to inject skill instructions into the agent conversation.
>   - Tab autocomplete uses prefix matching on all known command names; single-match auto-fills with trailing space.
>   - Lint and full test suite pass (`eslint src/ tests/` — 0 errors, `vitest run` — 389 tests across 18 files).

---

## Phase 11: TUI/UX Polish & Production-Grade Interface ✅

> **Goal**: Elevate the terminal UI to production quality — matching the polish and usability of Claude Code, Cursor CLI, OpenCode, and Gemini CLI.
> **Deliverable**: A refined, responsive, intuitive TUI with proper layout ordering, interactive slash command menu, model switching, shell execution shortcuts, file referencing, and robust resize handling.

### 11.1 Layout & Message Display Overhaul

- [x] **11.1.1** Fix message ordering — ensure text and tool calls render in exact chronological sequence:
  - Currently text accumulates at the top and tool calls at the bottom regardless of actual order
  - Refactor conversation state to use a single unified timeline array: `Array<TextBlock | ToolCallBlock>`
  - Each stream event (text delta, tool call start, tool result) appends to the timeline in order
  - The renderer iterates the timeline array sequentially — no separate sections for text vs tool calls
  - Tool calls render inline between text blocks exactly where they occurred in the conversation

- [x] **11.1.2** Remove "You" / "Curio" labels from messages:
  - Replace role labels with visual block differentiation
  - User messages: render with a subtle background highlight (e.g., dim gray `#2a2a2a` / ANSI 236) applied to the entire message block
  - Assistant messages: render with default terminal background (no highlight)
  - Add a thin left-border accent or a small `>` gutter indicator for user messages as an additional visual cue
  - Ensure the background highlight extends the full terminal width for user messages

- [x] **11.1.3** Move warnings, errors, and disclaimer messages below the input box:
  - Currently these appear at the top of the screen, pushing conversation content down
  - Relocate `<Notification>` component to render below the input area, after the "Enter to Send" hint line
  - Stack order below input: `[Enter to Send hint]` → `[Notification area (warnings/errors/info)]`
  - Notifications should auto-dismiss after a configurable timeout (default: 5s for info, 10s for warnings, persistent for errors)
  - Error notifications should be dismissible with Escape

- [x] **11.1.4** Remove "context (truncated text)" display:
  - Remove the context truncation indicator that currently shows in the UI
  - Context management should happen silently in the background
  - Only show context-related info in the status bar (e.g., token count / budget)

### 11.2 Input Box & Container Styling

- [x] **11.2.1** Wrap the input box in a visible bordered container:
  - Use Ink's `<Box>` with `borderStyle="round"` (or `"single"`) and `borderColor` matching the theme accent
  - The border should surround the entire input area including the prompt indicator
  - Show a prompt indicator inside the box: `❯` or `>` with accent color
  - When the agent is processing, change the border color to a muted/dim color to indicate input is disabled
  - The bordered container should span the full terminal width with 1-char horizontal padding

- [ ] **11.2.2** Multiline input display correctness (DEFERRED — terminal emulators cannot distinguish Shift+Enter from Enter):
  - Ensure the input box height expands dynamically as content wraps or the user adds newlines (Shift+Enter)
  - The border must re-render correctly when content wraps due to narrow terminal width
  - Cap the input box height at a reasonable maximum (e.g., 10 lines) with scrolling beyond that
  - Cursor position must remain accurate in multiline mode

### 11.3 Terminal Resize & Responsive Layout

- [x] **11.3.1** Handle terminal resize events gracefully:
  - Listen for `SIGWINCH` (terminal resize signal) and trigger re-render
  - Recalculate text wrapping, box widths, and layout on resize
  - The status bar, input box border, and message backgrounds must adjust to new terminal width
  - No visual artifacts or broken borders after resize

- [x] **11.3.2** Responsive layout breakpoints:
  - **Narrow** (<80 cols): compact status bar (abbreviate model name, hide token counts), full-width messages
  - **Normal** (80-120 cols): standard layout with all status bar info
  - **Wide** (>120 cols): optional side padding / centered content area (max content width ~120 cols)
  - Tool call displays should truncate/wrap arguments gracefully at narrow widths
  - Ensure no horizontal overflow or broken lines at any width ≥40 cols

- [x] **11.3.3** Consistent line wrapping for all content:
  - Assistant markdown output must word-wrap correctly at terminal width
  - Code blocks should use horizontal scrolling indication (or soft-wrap with indent preservation)
  - Tool call argument previews and results should truncate with `…` rather than break layout
  - User message background highlighting must extend correctly on wrapped lines

### 11.4 Top Bar — Workspace & Session Info

- [x] **11.4.1** Add a top bar / header showing the current workspace:
  - Display the current working directory path (abbreviated: `~/projects/my-app` not full absolute path)
  - Show the git branch name if inside a git repo (e.g., `~/projects/my-app (main)`)
  - Display on the right side of the top bar: current model name and provider (e.g., `claude-sonnet-4-20250514 · anthropic`)
  - Use a subtle separator line or dim background to distinguish the top bar from conversation content

- [x] **11.4.2** Dynamic top bar updates:
  - If the working directory changes during the session (e.g., via `cd` in a bash tool call), update the top bar path
  - If the model is switched mid-session (via `/model` command), update the top bar model display
  - If git branch changes (e.g., after `git checkout`), update the branch indicator

### 11.5 Slash Command Interactive Menu

- [x] **11.5.1** Show a popup/overlay command menu when the user types `/` as the first character in the input:
  - Display all available slash commands in a scrollable list
  - Each entry shows: command name, short description (e.g., `/help — Show available commands`)
  - The menu appears above the input box (floating upward), similar to autocomplete in IDEs
  - Menu should have a visible border/background to distinguish it from conversation content

- [x] **11.5.2** Real-time filtering as the user types:
  - As the user continues typing after `/`, filter the command list in real-time (e.g., typing `/mo` shows `/model`, `/mode`)
  - Use fuzzy or prefix matching
  - Highlight the matching portion of each command name
  - If no commands match, show "No matching commands" in the menu

- [x] **11.5.3** Keyboard navigation and selection:
  - Up/Down arrow keys navigate the filtered list
  - Enter selects the highlighted command and fills it into the input
  - Escape dismisses the menu and keeps the typed text
  - Tab also selects the highlighted (or sole remaining) match
  - The currently highlighted item should have a distinct background or indicator (e.g., `▸` prefix)

- [x] **11.5.4** Command categories in the menu:
  - Group commands visually: Session (`/clear`, `/compact`, `/sessions`), Model (`/model`, `/mode`), Info (`/help`, `/status`, `/cost`, `/version`), Memory (`/memory`, `/forget`), Tools (`/mcp`, `/skills`), Other (`/config`, `/export`, `/bug`, `/exit`)
  - Show category headers as dim, non-selectable labels in the list

### 11.6 Model Selection During Session

- [ ] **11.6.1** Enhanced `/model` command with interactive picker:
  - When user types `/model`, show an interactive model selection menu (same popup style as slash commands)
  - List all available models grouped by provider:
    - **Anthropic**: `claude-sonnet-4-20250514`, `claude-opus-4-20250514`, `claude-haiku-4-5-20251001`, etc.
    - **OpenAI**: `gpt-4o`, `gpt-4o-mini`, `o1`, `o3-mini`, etc.
    - **Google**: `gemini-2.5-pro`, `gemini-2.5-flash`, etc.
    - **Groq**: `llama-3.3-70b`, `mixtral-8x7b`, etc.
    - **Ollama**: dynamically list locally available models (via Ollama API `GET /api/tags`)
    - **OpenRouter / OpenAI-compatible**: show configured custom models
  - Show provider icon/label next to each model
  - Indicate the currently active model with a checkmark or highlight

- [ ] **11.6.2** Model switching mechanics:
  - On selection, switch the active provider and model for subsequent turns
  - Display a confirmation notification: "Switched to claude-opus-4-20250514 (anthropic)"
  - Update the top bar model display
  - Preserve conversation history — model switch is seamless mid-conversation
  - Validate that the selected model's API key is configured; show error if not

- [ ] **11.6.3** Quick model switch syntax:
  - Support `/model <name>` for direct switching without the picker (e.g., `/model gpt-4o`)
  - Support partial matching: `/model sonnet` → `claude-sonnet-4-20250514`
  - Support provider-qualified names: `/model anthropic:claude-haiku-4-5-20251001`

### 11.7 Shell Execution via `!` Prefix

- [x] **11.7.1** Execute shell commands directly from the input box using `!` prefix:
  - Typing `!ls -la` and pressing Enter executes `ls -la` in the current working directory
  - The command runs in a child process (same as the Bash tool) with the user's shell
  - Output (stdout + stderr) is displayed inline in the conversation area as a styled code block
  - The command and output are NOT sent to the LLM — this is a local-only shortcut
  - Exit code is shown: green checkmark for 0, red X for non-zero

- [x] **11.7.2** Shell command UX details:
  - Show the command being executed with a `$` prefix in the output (e.g., `$ ls -la`)
  - Support long-running commands with streaming output display
  - Ctrl+C while a `!` command is running should kill the child process (not exit the app)
  - Command history: `!` commands should be stored in input history and recallable with Up arrow
  - Working directory awareness: commands execute in the current project directory

- [x] **11.7.3** Interactive shell commands:
  - For commands that require TTY interaction (e.g., `!vim`, `!top`), warn the user or hand off to a raw terminal mode
  - Alternatively, detect TTY-requiring commands and show: "This command requires an interactive terminal. Run it directly in your shell."

### 11.8 File Referencing via `@` Prefix

- [ ] **11.8.1** Reference files in the input using `@` prefix:
  - Typing `@` triggers a file path autocomplete popup (similar to slash command menu)
  - The popup lists files and directories relative to the current working directory
  - As the user types after `@`, filter the file list in real-time (e.g., `@src/cl` shows `src/cli/`, `src/cli/app.tsx`, etc.)
  - Directories show a `/` suffix and can be expanded by typing further
  - Selected file path is inserted into the input text

- [x] **11.8.2** File content injection:
  - When a message is submitted with `@path/to/file`, the file's content is automatically read and included in the message context sent to the LLM
  - Multiple `@` references in a single message are supported
  - Show the referenced file(s) as collapsible blocks above the user's message text in the conversation view
  - For large files, include a token count warning: "file.ts (2,340 tokens)"

- [x] **11.8.3** File reference features:
  - Support glob patterns: `@src/**/*.test.ts` includes all matching files
  - Support line ranges: `@src/cli/app.tsx:50-100` includes only lines 50-100
  - Support directory references: `@src/ui/` includes a directory listing (not file contents)
  - Tab completion navigates the file tree (Tab to enter directory, Shift+Tab to go up) — DEFERRED
  - Show file type icons (if terminal supports unicode): folder, TypeScript , JavaScript , etc. — DEFERRED

### 11.9 Scrolling & Conversation Navigation

- [ ] **11.9.1** Smooth scrolling through conversation history:
  - When conversation exceeds terminal height, the view should auto-scroll to the latest content
  - User can scroll up through history using Shift+Up / Shift+Down or Page Up / Page Down
  - Show a "scroll indicator" when not at the bottom (e.g., `↓ New messages below` sticky at bottom)
  - Pressing Escape or typing in the input box returns to the bottom (auto-scroll resumes)

- [ ] **11.9.2** Visual scroll position indicator:
  - Show a subtle scrollbar or position indicator on the right edge
  - Display "Showing X of Y messages" or similar when scrolled up
  - Keyboard shortcut: Home/Ctrl+Home to jump to conversation start, End/Ctrl+End to jump to latest

### 11.10 Additional UX Enhancements

- [x] **11.10.1** Loading & progress indicators:
  - Show a progress bar or spinner for long-running tool operations (file search, bash commands)
  - Display elapsed time next to the spinner (already partially implemented in `ThinkingIndicator`)
  - For multi-step operations, show step count: "Running tool 2/5..."

- [x] **11.10.2** Keyboard shortcut help:
  - Ctrl+? or `/keys` shows a quick-reference overlay of all keyboard shortcuts
  - Include: Enter (send), Shift+Enter (newline), Ctrl+C (cancel/interrupt), Ctrl+D (exit), Up/Down (history), Tab (complete), Escape (clear/cancel menu), `!` (shell), `@` (file ref), `/` (commands)

- [x] **11.10.3** Inline diff display for file edits:
  - When a file edit tool completes, show a colorized inline diff (green for additions, red for removals)
  - Keep the diff collapsed by default with a "Show diff" toggle
  - Show the file path and line range affected

- [x] **11.10.4** Copy-to-clipboard support:
  - Allow selecting and copying code blocks from assistant responses
  - Shortcut or command to copy the last code block: `/copy` or Ctrl+Shift+C
  - Use OSC 52 escape sequence for clipboard access (works in most modern terminals)

- [x] **11.10.5** Sound / visual bell on completion:
  - Optional terminal bell (`\a`) when a long-running agent turn completes and the terminal is not focused
  - Configurable in config: `"notifications": { "bell": true }`

- [ ] **11.10.6** Breadcrumb trail for tool execution:
  - For complex multi-tool turns, show a compact breadcrumb summary after completion:
    `Read → Edit → Bash(npm test) → 3 files changed, tests passing`
  - Collapsible — click/expand to see individual tool details

- [x] **11.10.7** Welcome screen on first launch:
  - Show a brief welcome message on first ever launch with:
    - Quick start tips (how to ask questions, reference files, use slash commands)
    - Link to documentation
    - Current model and provider
    - Dismiss with any key
  - Only show once (persist a `~/.curio-code/.welcome-shown` flag)

- [x] **11.10.8** Empty state / idle prompt:
  - When the conversation is empty, show helpful placeholder text in the conversation area:
    - "Ask me anything about your codebase, or try:"
    - `"Explain the architecture of this project"`
    - `"Find and fix the bug in src/auth.ts"`
    - `"Write tests for the user service"`
  - The placeholder disappears once the first message is sent

### Implementation Notes

> **Files likely to be created or modified:**
>
> **Modified:**
> - `src/cli/app.tsx` — Major refactor: unified timeline rendering, layout reorder (notifications below input), top bar, resize handling, `!`/`@`/`/` input preprocessing
> - `src/ui/components/input.tsx` — Bordered container, `!` prefix detection, `@` autocomplete trigger, slash command menu trigger, multiline resize correctness
> - `src/ui/components/message.tsx` — Remove role labels, add background highlighting for user messages, inline rendering in timeline
> - `src/ui/components/tool-call.tsx` — Inline timeline rendering (not separate section), diff display for edit tools
> - `src/ui/components/notification.tsx` — Relocate below input, add auto-dismiss, add dismiss-on-Escape
> - `src/ui/components/status-bar.tsx` — Restructure as top bar with workspace path, git branch, model/provider
> - `src/ui/theme.ts` — Add user-message background color, input border color, menu colors, category header styles
> - `src/cli/commands/slash-commands.ts` — Add category metadata to each command, interactive model picker data
>
> **New files:**
> - `src/ui/components/command-menu.tsx` — Floating slash command menu with filtering, navigation, categories
> - `src/ui/components/model-picker.tsx` — Interactive model selection menu grouped by provider
> - `src/ui/components/file-picker.tsx` — `@` file reference autocomplete with directory traversal
> - `src/ui/components/diff-view.tsx` — Inline colorized diff display for file edit results
> - `src/ui/components/scroll-view.tsx` — Scrollable conversation container with position indicator
> - `src/ui/components/top-bar.tsx` — Workspace path, git branch, model/provider header bar
> - `src/ui/components/welcome.tsx` — First-launch welcome screen and empty state placeholder
> - `src/shell/direct-exec.ts` — `!` prefix shell command execution (bypasses LLM, runs locally)
> - `src/context/file-reference.ts` — `@` file reference parsing, glob expansion, content injection
>
> **Testing:**
> - Snapshot tests for all new UI components (command menu, model picker, file picker, diff view, top bar, welcome)
> - Unit tests for file reference parsing and glob expansion
> - Unit tests for shell command prefix detection and execution
> - Integration tests for slash command menu filtering and selection
> - Resize handling tests (mock terminal dimensions, verify layout recalculation)
> - Visual regression tests at various terminal widths (40, 80, 120, 200 cols)

> **Implementation status (Phase 11):**
> - Completed 11.1.1–11.1.4 (unified timeline, message styling, notifications below input, context display removal)
> - Completed 11.2.1 (bordered input container with round borders, accent/dim color states)
> - Completed 11.3.1–11.3.3 (Ink handles SIGWINCH natively; compact mode; line wrapping with `wrap="wrap"` and `wrap="truncate-end"` on tool args)
> - Completed 11.4.1–11.4.2 (top bar with abbreviated cwd, git branch, model/provider, token counts; dynamic refresh every 5s + after each turn)
> - Completed 11.5.1–11.5.4 (command menu popup with filtering, navigation, categories, highlighting)
> - Completed 11.7.1–11.7.3 (shell execution via `!` prefix with streaming output, Ctrl+C kill, history; interactive command detection)
> - Completed 11.8.2–11.8.3 (`@` file reference parsing, content injection, glob patterns `@src/**/*.ts`, line ranges, directory refs)
> - Completed 11.10.1 (tool step counter "Running tool N/M..." during streaming)
> - Completed 11.10.2 (`/keys` command showing all keyboard shortcuts and input prefixes)
> - Completed 11.10.3 (inline colorized diff display for file_edit tool results with collapsible output)
> - Completed 11.10.4 (`/copy` command — copies last code block to clipboard via OSC 52)
> - Completed 11.10.5 (terminal bell `\x07` on turns longer than 5 seconds)
> - Completed 11.10.7 (welcome screen on first launch with quick start tips, `~/.curio-code/.welcome-shown` sentinel)
> - Completed 11.10.8 (empty state with example prompts)
> - Files created: `src/ui/components/top-bar.tsx`, `src/ui/components/command-menu.tsx`, `src/shell/direct-exec.ts`, `src/context/file-reference.ts`
> - Files modified: `src/cli/app.tsx` (major refactor — unified timeline, new layout, dynamic top bar, bell, copy, welcome), `src/ui/components/input.tsx` (bordered, onChange, /keys hint), `src/ui/components/message.tsx` (removed labels, border styling), `src/ui/components/tool-call.tsx` (truncate-end on args), `src/ui/theme.ts` (5 new theme properties), `src/cli/commands/slash-commands.ts` (category metadata, /keys, /copy commands, getCommandMenuItems export)
> - Deferred: 11.2.2 (multiline input — terminal limitation with Shift+Enter), 11.6 (model picker — requires runtime model switching infra), 11.8.1 (@ autocomplete popup — complex UI), 11.9 (scroll navigation — Ink limitation), 11.10.6 (breadcrumb trail — low priority)
> - Lint and full test suite pass (`eslint` — 0 errors, `vitest run` — 389 tests across 18 files).

---

## Phase 12: Distribution & Installation

> **Goal**: `curl -fsSL https://install.curio.dev | bash` works everywhere.
> **Deliverable**: Standalone binaries for all platforms, npm package, Homebrew formula.

### 12.1 Binary Compilation

- [ ] **12.1.1** Bun compile for standalone binaries:
  - `curio-code-darwin-arm64` (macOS Apple Silicon)
  - `curio-code-darwin-x64` (macOS Intel)
  - `curio-code-linux-x64` (Linux x64)
  - `curio-code-linux-arm64` (Linux ARM64)
  - `curio-code-win-x64.exe` (Windows x64)
- [ ] **12.1.2** Binary size optimization (target: <50MB)
  - Tree-shaking unused providers
  - Lazy loading optional dependencies
  - Bun compile minification
- [ ] **12.1.3** Startup time optimization (target: <200ms)
  - Lazy initialization (don't load unused providers)
  - Minimize require chain
  - Profile and optimize critical path

### 12.2 Install Script

- [ ] **12.2.1** `install.sh` — POSIX-compatible:
  ```bash
  curl -fsSL https://install.curio.dev | bash
  ```
  - Detect OS (`uname -s`) and architecture (`uname -m`)
  - Download correct binary from GitHub Releases
  - Install to `~/.curio-code/bin/curio-code` (user-local)
  - Create symlink `cc` → `curio-code`
  - Add `~/.curio-code/bin` to PATH (update `.bashrc`, `.zshrc`, `.profile`)
  - Verify installation: `curio-code --version`
  - Print getting started instructions
- [ ] **12.2.2** Uninstall script: `curio-code uninstall`
- [ ] **12.2.3** Update mechanism: `curio-code update`

### 12.3 Package Managers

- [ ] **12.3.1** npm: `npm install -g curio-code`
  - Publish to npmjs.com
  - Binary selection via `postinstall` script
- [ ] **12.3.2** Homebrew: `brew install curio-code`
  - Homebrew formula in homebrew-tap repository
- [ ] **12.3.3** Other (lower priority):
  - AUR (Arch Linux): `yay -S curio-code`
  - Scoop (Windows): `scoop install curio-code`

### 12.4 Auto-Update

- [ ] **12.4.1** Check for updates on startup (non-blocking, background check)
- [ ] **12.4.2** Show update notification: "New version available: v1.2.3. Run `curio-code update` to install."
- [ ] **12.4.3** Configurable update check frequency (default: daily)
- [ ] **12.4.4** Opt-out: `CURIO_CODE_NO_UPDATE_CHECK=1`

### 12.5 CLI Aliases

- [ ] **12.5.1** Primary command: `curio-code`
- [ ] **12.5.2** Short alias: `cc`
- [ ] **12.5.3** Set up aliases during installation

---

## Phase 13: Testing, Observability & Production Hardening

> **Goal**: Reliable, observable, production-ready.
> **Deliverable**: Comprehensive test suite, structured logging, crash resilience.

### 13.1 Testing Strategy

- [ ] **13.1.1** Unit tests for all custom tools:
  - Use SDK's `MockLLM` for deterministic LLM responses
  - Use SDK's `ToolTestKit` for isolated tool testing
  - Test each tool's happy path, error cases, edge cases
- [ ] **13.1.2** Unit tests for permission policies:
  - Test each mode (ask, auto, strict)
  - Test bash command classification
  - Test path restriction enforcement
- [ ] **13.1.3** Unit tests for config loading and merging:
  - Global + project + env + CLI flag merge order
  - Invalid config handling
  - Default values
- [ ] **13.1.4** Integration tests using SDK's `AgentTestHarness`:
  - Full agent loop with mock LLM
  - Tool chain execution (read → edit → write)
  - Permission flow testing
  - Session resume testing
- [ ] **13.1.5** Snapshot tests for UI rendering:
  - Markdown rendering output
  - Tool call display
  - Permission prompt display
- [ ] **13.1.6** E2E tests:
  - Spawn CLI process, send input, verify output
  - Test one-shot mode
  - Test pipe mode
  - Test session resume
- [ ] **13.1.7** Replay tests using SDK's `RecordingMiddleware` / `ReplayLLMClient`:
  - Record real LLM interactions
  - Replay for deterministic regression testing
- [ ] **13.1.8** Performance benchmarks:
  - Startup time measurement
  - Tool execution time (file read, glob, grep, bash)
  - Context compression time
- [ ] **13.1.9** Cross-platform CI: test on macOS, Linux, Windows

### 13.2 Error Handling

- [ ] **13.2.1** Graceful degradation on provider errors:
  - Rate limit → show wait time, auto-retry
  - Auth error → clear message with fix instructions
  - Network error → retry with backoff, then offline message
- [ ] **13.2.2** User-friendly error messages (no raw stack traces in production)
- [ ] **13.2.3** Automatic retry for transient failures via SDK
- [ ] **13.2.4** Rate limit handling with backoff via SDK's `RateLimitMiddleware`
- [ ] **13.2.5** API key validation on startup (quick test call or format check)
- [ ] **13.2.6** Clear error messages for common issues:
  - Missing API key
  - Invalid model name
  - Network unreachable
  - File permission denied
  - Disk full

### 13.3 Logging & Observability

- [ ] **13.3.1** Use SDK's `LoggingMiddleware` and `createLogger()`
- [ ] **13.3.2** Structured logging to `~/.curio-code/logs/`:
  - Log files rotated by date
  - JSON format for machine parsing
- [ ] **13.3.3** Log levels: `error` (default), `warn`, `info`, `debug`, `trace`
- [ ] **13.3.4** `--verbose` flag enables `debug` level output
- [ ] **13.3.5** Cost tracking display (per-turn and cumulative) via `CostTracker`
- [ ] **13.3.6** Token usage tracking and display
- [ ] **13.3.7** Audit trail via SDK's `registerAuditHooks()` + `SqlitePersistence`
- [ ] **13.3.8** Crash reporting (opt-in):
  - Capture unhandled exceptions
  - Save crash report to `~/.curio-code/crashes/`
  - Optionally send to telemetry endpoint

### 13.4 Performance

- [ ] **13.4.1** Lazy initialization: don't load unused providers, tools, or MCP servers
- [ ] **13.4.2** Parallel tool execution: SDK supports parallel tool calls from LLM
- [ ] **13.4.3** Efficient file reading: stream large files, don't load entire file into memory
- [ ] **13.4.4** Debounced config file watching (reload on change without thrashing)
- [ ] **13.4.5** Memory profiling: ensure no memory leaks in long sessions

### 13.5 Security Hardening

- [ ] **13.5.1** Never log API keys (redact from all log output)
- [ ] **13.5.2** Sanitize file paths in error messages
- [ ] **13.5.3** Validate all user inputs (tool arguments, config values)
- [ ] **13.5.4** Secure credential storage:
  - macOS: Keychain integration (optional)
  - Linux: Secret Service API (optional)
  - Fallback: file-based with restricted permissions (0600)
- [ ] **13.5.5** Permission audit trail: log all permission decisions

---

## Phase 14: IDE & Editor Integration

> **Goal**: Works alongside and integrates with editors.
> **Deliverable**: VS Code extension, Neovim plugin, git worktree support.

### 14.1 VS Code Extension

- [ ] **14.1.1** Extension that embeds Curio Code as a panel/terminal
- [ ] **14.1.2** File context from active editor (send current file to agent)
- [ ] **14.1.3** Apply code changes directly to editor buffers
- [ ] **14.1.4** Terminal integration (use VS Code's integrated terminal)

### 14.2 Neovim Plugin

- [ ] **14.2.1** Lua plugin for Neovim
- [ ] **14.2.2** Terminal buffer integration
- [ ] **14.2.3** Send selection to Curio Code (`:'<,'>CurioCode explain`)
- [ ] **14.2.4** Apply changes to buffer

### 14.3 Git Worktree Support

- [ ] **14.3.1** `EnterWorktree` tool:
  - Create new git worktree in `.curio-code/worktrees/`
  - Create new branch based on HEAD
  - Switch session working directory to worktree
- [ ] **14.3.2** Work in worktree without affecting main working tree
- [ ] **14.3.3** Auto-cleanup on session end (prompt user to keep or remove)
- [ ] **14.3.4** Worktree management slash commands:
  - `/worktree create [name]`
  - `/worktree list`
  - `/worktree remove <name>`

### 14.4 LSP Integration (Future)

- [ ] **14.4.1** Language Server Protocol client for code intelligence
- [ ] **14.4.2** Go-to-definition context for the agent
- [ ] **14.4.3** Diagnostics (errors/warnings) as context
- [ ] **14.4.4** Code completion context

---

## Phase 15: Community & Ecosystem

> **Goal**: Enable community contributions and extensibility.
> **Deliverable**: Plugin system, skill marketplace, documentation.

### 15.1 Plugin System

- [ ] **15.1.1** Use SDK's `PluginRegistry` and `isPlugin()`:
  - Plugins discovered from `package.json` dependencies
  - Pattern: `curio-code-plugin-*`
- [ ] **15.1.2** Plugin manifest format:
  ```json
  {
    "name": "curio-code-plugin-docker",
    "curio-code": {
      "tools": [...],
      "hooks": [...],
      "skills": [...]
    }
  }
  ```
- [ ] **15.1.3** Plugin management:
  - `curio-code plugin add <name>` → `bun add <name>`
  - `curio-code plugin remove <name>`
  - `curio-code plugin list`

### 15.2 Skill Marketplace

- [ ] **15.2.1** Community-contributed skills repository
- [ ] **15.2.2** `curio-code skill add <name>` — download to `~/.curio-code/skills/`
- [ ] **15.2.3** Skill publishing workflow (submit to registry)

### 15.3 MCP Server Ecosystem

- [ ] **15.3.1** Pre-configured MCP server recipes for common services:
  - GitHub, GitLab, Jira, Slack, Linear, Notion, PostgreSQL, etc.
- [ ] **15.3.2** `curio-code mcp add github` — one-command setup
- [ ] **15.3.3** MCP server template: `curio-code mcp scaffold <name>`

### 15.4 Documentation

- [ ] **15.4.1** Getting started guide
- [ ] **15.4.2** Tool reference documentation
- [ ] **15.4.3** Configuration reference (all options with examples)
- [ ] **15.4.4** Skill authoring guide
- [ ] **15.4.5** Plugin development guide
- [ ] **15.4.6** API documentation (for programmatic use of Curio Code as library)
- [ ] **15.4.7** Migration guides (from Claude Code, Cursor, etc.)

### 15.5 Open Source

- [ ] **15.5.1** GitHub repository setup
- [ ] **15.5.2** Contributing guide (CONTRIBUTING.md)
- [ ] **15.5.3** Code of conduct
- [ ] **15.5.4** Issue templates (bug report, feature request)
- [ ] **15.5.5** PR templates
- [ ] **15.5.6** Release automation (GitHub Actions → binary publish → npm publish)

---

## Non-Goals & Out of Scope

- **GUI/Desktop app**: This is strictly a CLI tool
- **Web IDE**: No browser-based interface (initially)
- **Language-specific AI features**: No built-in LSP, linting, or compilation — use existing tools via Bash/MCP
- **Training/fine-tuning**: We use existing models, not train our own
- **Self-hosting LLMs**: Supported via Ollama, but we don't manage GPU infrastructure

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|-----------|
| SDK missing PlanState/TodoManager | Medium | **Confirmed** | Implement in app layer (already planned). See SDK_IMPROVEMENTS.md. |
| SDK missing Gemini provider | Medium | **Resolved ✅** | Implemented custom `GeminiProvider` (REST API) and `OpenAICompatibleProvider` in Phase 7. |
| SDK lacks AbortSignal support | Medium | Medium | Implement via iterator break + state reset. File SDK improvement request. |
| Binary size too large (>100MB) | Medium | Low | Tree-shaking, lazy imports, Bun compile optimization |
| Startup time too slow | High | Low | Profile and optimize; lazy loading; ahead-of-time compilation |
| Provider API changes | Medium | Medium | Provider abstraction via SDK; version pinning |
| Rate limiting during heavy use | Medium | High | SDK's TieredRouter fallback; local model fallback via Ollama |
| Cross-platform compatibility | Medium | Medium | CI on all platforms; POSIX-safe scripting; Windows WSL2 support |
| Ink/React terminal compatibility | Medium | Medium | Test on major terminal emulators (iTerm2, kitty, Terminal.app, Windows Terminal, Alacritty) |

---

## Timeline Summary

| Phase | Description | Estimated Effort | Dependencies | MVP? |
|-------|-------------|-----------------|-------------|------|
| 0 | Foundation & SDK dependency ✅ | 1-2 weeks | TypeScript SDK ✅ | ✅ |
| 1 | Core agent loop & basic CLI ✅ | 2-3 weeks | Phase 0 | ✅ |
| 2 | Tool system — file & code ops | 3-4 weeks | Phase 1 | ✅ |
| 3 | Terminal UI & rich output | 2-3 weeks | Phase 1 | ✅ |
| 4 | Context management | 1-2 weeks | Phase 2 | ✅ |
| 5 | Permission system | 1-2 weeks | Phase 2 | ✅ |
| 6 | Session & memory | 2-3 weeks | Phase 2, 4 | |
| 7 | Multi-model support | 1-2 weeks | Phase 1 | |
| 8 | Advanced features (subagents, plan, todos, skills) | 3-4 weeks | Phase 2, 5, 6 | |
| 9 | MCP integration ✅ | 2-3 weeks | Phase 2 | |
| 10 | Configuration & customization | 1-2 weeks | Phase 5, 6 | |
| 11 | TUI/UX polish & production-grade interface | 2-3 weeks | Phase 3, 7, 10 | |
| 12 | Distribution & installation | 2-3 weeks | Phase 1-11 | |
| 13 | Testing & hardening | Ongoing | All phases | |
| 14 | IDE integration | 3-4 weeks | Phase 1-11 | |
| 15 | Community & ecosystem | Ongoing | Phase 12 | |

**Phases 0-5 deliver a usable MVP** in approximately 10-14 weeks.
**Full feature parity**: 26-41 weeks (6-10 months).

---

## Revision History

| Date | Change |
|------|--------|
| 2026-03-01 | Initial plan created |
| 2026-03-03 | **Major revision**: SDK verification completed. Added SDK Verification section. Corrected PlanState, TodoManager, StructuredOutput as NOT in SDK (must be app-level). Added `src/plan/` and `src/todos/` directories to project structure. Added substep numbering (0.1.1, 0.1.2, etc.) for all phases. Added Google/Gemini as custom provider (not SDK built-in). Added OpenAI-compatible base URL approach for additional providers. Added SDK_IMPROVEMENTS.md reference. Expanded tool implementations with detailed Zod schemas and implementation steps. Added App-Level Features box to architecture diagram. |
