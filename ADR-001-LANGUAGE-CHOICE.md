# ADR-001: Language Choice for Curio Coding Tool

## Status

**Accepted**

## Date

2026-03-01

## Context

We are building **Curio Code** — a production-grade CLI coding agent (comparable to Claude Code, OpenCode, Cursor CLI, Gemini CLI). The tool will be built on top of the Curio Agent SDK, which currently exists as a Python package. We are also building a TypeScript port of the SDK (`curio-agent-sdk-typescript`). The question is: which language/SDK should we use for the coding tool itself?

## Decision Drivers


| Factor                 | Python SDK                                                             | TypeScript SDK                                                                                            |
| ---------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **SDK Maturity**       | Exists now, 117 files, battle-tested                                   | Not yet built — must be created first                                                                     |
| **CLI Ecosystem**      | argparse, click, rich, prompt_toolkit — good but not native            | ink, clack, chalk, blessed, ora, commander — purpose-built for modern CLIs                                |
| **Terminal UI**        | `rich` + `prompt_toolkit` can do it, but ergonomics are secondary      | ink (React for CLI), blessed-contrib — first-class TUI support                                            |
| **Startup Time**       | ~300-800ms (Python interpreter + imports)                              | ~50-150ms (Node.js / Bun) — 5-10x faster                                                                  |
| **Distribution**       | pip install, pipx, standalone via PyInstaller/Nuitka — works but heavy | npm install -g, npx, curl-install scripts, single binary via pkg/bun compile — native to CLI distribution |
| **Cross-platform**     | Works everywhere Python is installed                                   | Works everywhere Node/Bun is installed; easier to bundle as standalone                                    |
| **Async Model**        | asyncio — good but single-threaded GIL limits                          | Native event loop, workers, excellent concurrency                                                         |
| **Developer Base**     | Strong in AI/ML, backend                                               | Dominant in tooling, CLI, full-stack — larger contributor pool for coding tools                           |
| **Industry Precedent** | —                                                                      | Claude Code (TS), OpenCode (Go/TS), Cursor CLI (TS), Gemini CLI (TS), Aider (Python — exception)          |
| **LSP/Treesitter**     | tree-sitter bindings exist but secondary                               | tree-sitter WASM, native LSP client libs — primary ecosystem                                              |
| **Editor Integration** | Possible but awkward                                                   | Natural fit (VS Code extensions, LSP, etc.)                                                               |
| **curl Install**       | Requires Python runtime detection, venv creation                       | Single binary via Bun compile or pkg; simple curl                                                         |


## Decision

**Use the TypeScript SDK (`curio-agent-sdk-typescript`) to build Curio Code.**

## Rationale

### 1. Startup Performance is Critical for CLI Tools

A coding tool is invoked dozens of times per session. Python's ~500ms startup penalty compounds. TypeScript/Bun achieves ~100ms cold start. This is a user-experience differentiator.

### 2. Distribution Story is Dramatically Better

The goal is `curl -fsSL https://install.curio.dev | bash`. With TypeScript:

- **Bun compile** produces a single binary (no runtime needed)
- **npm/npx** provides fallback installation
- No Python version conflicts, no venv management, no pip dependency resolution hell

With Python:

- Must detect Python version, create venv, install pip dependencies
- PyInstaller/Nuitka binaries are 80-200MB
- Cross-compilation is painful

### 3. Industry Convergence on TypeScript for CLI Coding Tools

Every major CLI coding agent is TypeScript (or Go):

- **Claude Code**: TypeScript
- **Cursor CLI**: TypeScript
- **Gemini CLI**: TypeScript
- **OpenCode**: Go (with TS frontend)
- **Aider**: Python (the exception — and notably has distribution complaints)

This isn't coincidental. The TypeScript ecosystem has optimized for CLI developer tools.

### 4. Terminal UI Ecosystem

TypeScript's ink (React renderer for CLI), blessed, and clack provide component-based TUI development that maps naturally to the streaming, interactive UI a coding tool needs. Python's alternatives (`rich`, `prompt_toolkit`) are capable but require more boilerplate.

### 5. Tree-sitter and LSP Integration

Code intelligence (parsing, AST manipulation, language server integration) is a first-class citizen in the TypeScript/WASM ecosystem. Python bindings exist but are secondary.

### 6. SDK Port is Required Regardless

The TypeScript SDK is being built as a separate deliverable. Using it for the coding tool validates the SDK in a real-world, demanding scenario — the ultimate dogfooding.

### 7. Contributor Ecosystem

CLI developer tools attract TypeScript developers. Building in TypeScript maximizes the potential contributor base.

## Trade-offs Accepted


| Downside                                     | Mitigation                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| TypeScript SDK doesn't exist yet             | Build it first (Phase 0 dependency)                                     |
| Python SDK is more mature                    | TypeScript SDK will reach parity before coding tool needs full features |
| Team may have more Python experience         | TypeScript is widely known; SDK port builds familiarity                 |
| Two codebases to maintain (Python + TS SDKs) | Both are strategic assets; coding tool validates TS SDK                 |


## Alternatives Considered

### Python SDK (Rejected)

- Faster to start (SDK exists), but worse end-user experience
- Distribution story is a dealbreaker for the `curl install` goal
- Would not validate the TypeScript SDK

### Go (Rejected)

- Excellent for single-binary CLIs
- No Curio SDK in Go — would require a third SDK port
- Less ecosystem support for AI/LLM tooling

### Rust (Rejected)

- Best performance and binary size
- Highest development cost; no Curio SDK port planned
- AI/LLM ecosystem is immature

## Consequences

1. **TypeScript SDK must be built first** (or in parallel, with coding tool using progressive features)
2. **Bun** is the recommended runtime for compilation and performance
3. **Node.js** compatibility must be maintained as a fallback
4. The coding tool serves as the **reference application** for the TypeScript SDK
5. Any SDK gaps discovered during coding tool development feed back into both SDKs

