import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { spawn } from "node:child_process";
import { bashTool, bashTaskOutputTool } from "../../src/tools/bash.js";
import { toolSessionState } from "../../src/tools/session-state.js";

vi.mock("node:child_process", async () => {
  const actual = await import("node:child_process") as typeof import("node:child_process");
  return {
    ...actual,
    spawn: vi.fn(),
  };
});

const mockedSpawn = vi.mocked(spawn);

describe("Phase 2 bash + session tools", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("executes foreground commands and formats output", async () => {
    const stdoutHandlers: Array<(chunk: Buffer) => void> = [];
    const closeHandlers: Array<(code: number) => void> = [];

    (mockedSpawn as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      stdout: {
        on: (_event: string, cb: (chunk: Buffer) => void) => {
          stdoutHandlers.push(cb);
        },
      },
      stderr: {
        on: () => {},
      },
      on: (event: string, cb: (arg: unknown) => void) => {
        if (event === "close") {
          closeHandlers.push(cb as (arg: number) => void);
        }
      },
      kill: () => true,
    } as never);

    const promise = bashTool.execute({
      command: "echo hi",
      run_in_background: false,
      timeout: 5000,
    } as never);

    stdoutHandlers.forEach((cb) => cb(Buffer.from("hi\n", "utf8")));
    closeHandlers.forEach((cb) => cb(0));

    const result = await promise;
    expect(result).toContain("Exit code: 0");
    expect(result).toContain("hi");
  });

  it("starts background tasks and exposes bash_task_output", async () => {
    (mockedSpawn as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      stdout: { on: () => {} },
      stderr: { on: () => {} },
      on: () => {},
      kill: () => true,
    } as never);

    const startResult = await bashTool.execute({
      command: "sleep 1",
      run_in_background: true,
    } as never);

    const match = String(startResult).match(/Started background task (\S+)/);
    expect(match).not.toBeNull();
    const taskId = match?.[1] ?? "";

    const rawTask = toolSessionState.getBackgroundTask(taskId);
    expect(rawTask).toBeDefined();

    const outputResult = await bashTaskOutputTool.execute({
      task_id: taskId,
    } as never);

    const parsed = JSON.parse(String(outputResult));
    expect(parsed.id).toBe(taskId);
    expect(parsed.command).toBe("sleep 1");
  });
});

