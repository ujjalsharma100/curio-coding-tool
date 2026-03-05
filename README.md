# Curio Code

Terminal-based AI coding assistant built on the [Curio Agent SDK](https://github.com/ujjalsharma100/curio-agent-sdk-typescript) (TypeScript). Chat with an agent that can read and edit files, run shell commands, search the web, and use MCP servers and skills.

## Requirements

- **Bun** ≥ 1.1.0

## Setup

From the repo root (or with the SDK as `curio-agent-sdk-typescript`):

```bash
cd curio-coding-tool
bun install
```

## Usage

**Interactive REPL** (default):

```bash
bun run dev
# or, after building: ./curio-code
```

**One-shot** (single prompt, then exit):

```bash
bun run dev -- "explain the main function in src/index.ts"
```

**Options:** `--model`, `--provider`, `--permission-mode ask|auto|strict`, `--memory`, `--verbose`, etc.

## Configuration

- **Project:** `.curio-code/config.json` — model, permission mode, tools, MCP servers, etc.
- **Instructions:** `CURIO.md` or `.curio-code/rules.md` — custom instructions for the agent.
- **Ignore:** `.curioignore` — paths to exclude from context (e.g. `node_modules`).
- **Global:** `~/.curio-code/` — default config, history, sessions, memory.

## Features

- **Tools:** file read/write/edit, glob, grep, bash, web fetch/search, notebook edit, screenshot/vision.
- **MCP:** Connect MCP servers via project or global config.
- **Skills:** Load skills from `.curio-code/skills` or `~/.curio-code/skills`.
- **Sessions & memory:** Resume sessions; optional persistent memory per project.
- **Permissions:** Control tool use with ask/auto/strict and optional allowlists.

## Scripts

| Command        | Description              |
|----------------|--------------------------|
| `bun run dev`  | Run with watch           |
| `bun run build`| Compile to `curio-code`  |
| `bun run test` | Run tests                |
| `bun run lint` | ESLint                   |

