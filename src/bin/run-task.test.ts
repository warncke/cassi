import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import * as fs from "fs";
import path from "path";

vi.mock("commander");
vi.mock("fs");
vi.mock("../lib/cassi/Cassi.js");
vi.mock("../lib/user/User.js");
vi.mock("../lib/cli-prompt-handler/CLIPromptHandler.js");
vi.mock("../lib/task/Task.js");
vi.mock("../lib/repository/Worktree.js");

const mockParse = vi.fn();
const mockOption = vi.fn().mockReturnThis();
const mockOpts = vi.fn();

vi.mocked(Command).mockImplementation(
  () =>
    ({
      option: mockOption,
      parse: mockParse,
      opts: mockOpts,
    } as any)
);

const mockExistsSync = vi.mocked(fs.existsSync);
const mockAddWorktree = vi.fn();
const mockCassiInit = vi.fn();
const mockCassi = vi.fn().mockImplementation(() => ({
  init: mockCassiInit,
  repository: {
    addWorktree: mockAddWorktree,
  },
}));
const { Cassi } = await import("../lib/cassi/Cassi.js");
vi.mocked(Cassi).mockImplementation(mockCassi);

const mockUser = vi.fn();
const { User } = await import("../lib/user/User.js");
vi.mocked(User).mockImplementation(mockUser);

const { CLIPromptHandler } = await import(
  "../lib/cli-prompt-handler/CLIPromptHandler.js"
);
const mockCLIPromptHandler = vi.fn().mockImplementation(() => ({
  handlePrompt: vi.fn(),
}));
vi.mocked(CLIPromptHandler).mockImplementation(mockCLIPromptHandler);

const { Task } = await import("../lib/task/Task.js");
const mockTaskInstance = { taskId: null, worktree: null };
const mockTask = vi.fn().mockImplementation(() => mockTaskInstance);
vi.mocked(Task).mockImplementation(mockTask);

const { Worktree } = await import("../lib/repository/Worktree.js");
const mockWorktreeInstance = {};
const mockWorktree = vi.fn().mockImplementation(() => mockWorktreeInstance);
vi.mocked(Worktree).mockImplementation(mockWorktree);

async function runRunTask() {
  await import("./run-task.js");
}

describe("run-task script", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = (vi.spyOn(process, "exit") as any).mockImplementation(
      () => {}
    );

    vi.mocked(Command).mockImplementation(
      () =>
        ({
          option: mockOption,
          parse: mockParse,
          opts: mockOpts,
        } as any)
    );
    mockTaskInstance.taskId = null;
    mockTaskInstance.worktree = null;
    vi.mocked(Command).mockImplementation(
      () =>
        ({
          option: mockOption,
          parse: mockParse,
          opts: mockOpts,
        } as any)
    );
    vi.mocked(Cassi).mockImplementation(mockCassi);
    vi.mocked(User).mockImplementation(mockUser);
    vi.mocked(CLIPromptHandler).mockImplementation(mockCLIPromptHandler);
    vi.mocked(Task).mockImplementation(mockTask);
    vi.mocked(Worktree).mockImplementation(mockWorktree);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it("should throw an error if worktree-dir is not provided", async () => {
    mockOpts.mockReturnValue({
      repositoryDir: ".",
      configFile: "cassi.json",
    });

    await runRunTask();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: "worktree-dir is required" })
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("should throw an error if worktree-dir does not exist", async () => {
    mockOpts.mockReturnValue({
      repositoryDir: ".",
      worktreeDir: "/non/existent/path",
      configFile: "cassi.json",
    });
    mockExistsSync.mockReturnValue(false);

    await runRunTask();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Worktree directory does not exist: /non/existent/path",
      })
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("should initialize Cassi with an absolute worktree-dir", async () => {
    const worktreeDir = "/valid/absolute/path";
    const taskId = "path";
    mockOpts.mockReturnValue({
      repositoryDir: "/repo/dir",
      worktreeDir: worktreeDir,
      configFile: "cassi.json",
    });
    mockExistsSync.mockReturnValue(true);

    await runRunTask();

    expect(mockExistsSync).toHaveBeenCalledWith(worktreeDir);
    expect(mockExistsSync).toHaveBeenCalledWith(worktreeDir);
    expect(mockUser).toHaveBeenCalledOnce();
    expect(mockCassi).toHaveBeenCalledOnce();
    expect(mockCassiInit).toHaveBeenCalledOnce();
    expect(mockTask).toHaveBeenCalledWith(expect.any(Object));
    expect(mockTaskInstance.taskId).toBe(taskId);
    expect(mockWorktree).toHaveBeenCalledWith(
      expect.any(Object),
      mockTaskInstance,
      worktreeDir
    );
    expect(mockTaskInstance.worktree).toBe(mockWorktreeInstance);
    expect(mockAddWorktree).toHaveBeenCalledWith(mockWorktreeInstance);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      `Cassi initialized for worktree: ${worktreeDir} (Task ID: ${taskId})`
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it("should construct absolute path and taskId for a relative worktree-dir", async () => {
    const repositoryDir = "/repo/dir";
    const relativeWorktreeDir = "relative-task";
    const expectedAbsoluteWorktreeDir = path.join(
      repositoryDir,
      ".cassi",
      "worktrees",
      relativeWorktreeDir
    );
    const expectedTaskId = "relative-task";

    mockOpts.mockReturnValue({
      repositoryDir: repositoryDir,
      worktreeDir: relativeWorktreeDir,
      configFile: "cassi.json",
    });
    mockExistsSync.mockReturnValue(true);

    await runRunTask();

    expect(mockExistsSync).toHaveBeenCalledWith(expectedAbsoluteWorktreeDir);
    expect(mockExistsSync).toHaveBeenCalledWith(expectedAbsoluteWorktreeDir);
    expect(mockUser).toHaveBeenCalledOnce();
    expect(mockCassi).toHaveBeenCalledOnce();
    expect(mockCassiInit).toHaveBeenCalledOnce();
    expect(mockTask).toHaveBeenCalledWith(expect.any(Object));
    expect(mockTaskInstance.taskId).toBe(expectedTaskId);
    expect(mockWorktree).toHaveBeenCalledWith(
      expect.any(Object),
      mockTaskInstance,
      expectedAbsoluteWorktreeDir
    );
    expect(mockTaskInstance.worktree).toBe(mockWorktreeInstance);
    expect(mockAddWorktree).toHaveBeenCalledWith(mockWorktreeInstance);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      `Cassi initialized for worktree: ${expectedAbsoluteWorktreeDir} (Task ID: ${expectedTaskId})`
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it("should throw an error if the constructed absolute worktree-dir does not exist", async () => {
    const repositoryDir = "/repo/dir";
    const relativeWorktreeDir = "non-existent-task";
    const expectedAbsoluteWorktreeDir = path.join(
      repositoryDir,
      ".cassi",
      "worktrees",
      relativeWorktreeDir
    );

    mockOpts.mockReturnValue({
      repositoryDir: repositoryDir,
      worktreeDir: relativeWorktreeDir,
      configFile: "cassi.json",
    });
    mockExistsSync.mockReturnValue(false);

    await runRunTask();

    expect(mockExistsSync).toHaveBeenCalledWith(expectedAbsoluteWorktreeDir);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: `Worktree directory does not exist: ${expectedAbsoluteWorktreeDir}`,
      })
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
