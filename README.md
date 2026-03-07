# Curio Code

Terminal-based AI coding assistant built on the [Curio Agent SDK](https://github.com/ujjalsharma100/curio-agent-sdk-typescript) (TypeScript). Chat with an agent that can read and edit files, run shell commands, search the web, and use MCP servers and skills.

## Installation

**One-line install** (clone + build from GitHub, then install binary to `~/.curio-code/bin`; requires **git** and **Bun**):

```bash
curl -fsSL https://raw.githubusercontent.com/ujjalsharma100/curio-coding-tool/main/scripts/install.sh | sh
```

The script clones [curio-coding-tool](https://github.com/ujjalsharma100/curio-coding-tool) and [curio-agent-sdk-typescript](https://github.com/ujjalsharma100/curio-agent-sdk-typescript), builds from source, installs the `curio-code` binary, adds `~/.curio-code/bin` to your PATH, and creates a `cc` alias. The temporary clone directory is removed after install.

**Install from a local clone** (if you already have the repo):

```bash
cd curio-coding-tool
./scripts/install.sh
```

This builds from your current tree and installs to `~/.curio-code/bin` (no clone). Requires **Bun** ≥ 1.1.0.

After installing, open a new terminal or run `source ~/.zshrc` (or `~/.bashrc` / `~/.profile`) so `curio-code` and `cc` are on your PATH.

## Requirements

- **Bun** ≥ 1.1.0 (for both run-from-repo and install script)
- **git** (only for the one-line curl install)

## Development setup

From the repo root (or with the SDK as `curio-agent-sdk-typescript`):

```bash
cd curio-coding-tool
bun install
```

## Usage

**Interactive REPL** (default):

```bash
curio-code
# or: cc
# From repo without installing: bun run dev
```

**One-shot** (single prompt, then exit):

```bash
curio-code "explain the main function in src/index.ts"
# From repo: bun run dev -- "explain the main function in src/index.ts"
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

| Command                | Description                          |
|------------------------|--------------------------------------|
| `./scripts/install.sh` | Install binary to `~/.curio-code/bin` |
| `bun run dev`          | Run with watch                       |
| `bun run build`        | Compile to `curio-code`              |
| `bun run test`         | Run tests                            |
| `bun run lint`         | ESLint                               |

