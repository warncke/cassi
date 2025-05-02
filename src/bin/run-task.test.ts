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

const mockParse = vi.fn().mockReturnThis();
const mockOption = vi.fn().mockReturnThis();
const mockArgument = vi.fn().mockReturnThis();
const mockOpts = vi.fn();
const mockArgs = vi.fn().mockReturnValue([]);

vi.mocked(Command).mockImplementation(
  () =>
    ({
      option: mockOption,
      argument: mockArgument,
      parse: mockParse,
      opts: mockOpts,
      args: mockArgs(),
    } as any)
);

const mockExistsSync = vi.mocked(fs.existsSync);
const mockAddWorktree = vi.fn();
const mockCassiInit = vi.fn();
const mockNewTaskRun = vi.fn();
const mockNewTaskInstance = { run: mockNewTaskRun };
const mockNewTask = vi.fn().mockReturnValue(mockNewTaskInstance);
const mockCassi = vi.fn().mockImplementation(() => ({
  init: mockCassiInit,
  repository: {
    addWorktree: mockAddWorktree,
  },
  task: {
    newTask: mockNewTask,
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
const mockAddSubtask = vi.fn();
const mockTaskRun = vi.fn();
const mockTaskInstance = {
  taskId: null,
  worktree: null,
  addSubtask: mockAddSubtask,
  run: mockTaskRun,
};
const mockTask = vi.fn().mockImplementation(() => mockTaskInstance);
vi.mocked(Task).mockImplementation(mockTask);

const { Worktree } = await import("../lib/repository/Worktree.js");
const mockInitRepositoryBranch = vi.fn();
const mockWorktreeInstance = {
  initRepositoryBranch: mockInitRepositoryBranch,
};
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

    mockOption.mockClear().mockReturnThis();
    mockArgument.mockClear().mockReturnThis();
    mockParse.mockClear().mockReturnThis();
    mockOpts.mockClear();
    mockArgs.mockClear().mockReturnValue([]);

    mockCassiInit.mockClear();
    mockAddWorktree.mockClear();
    mockNewTask.mockClear().mockReturnValue(mockNewTaskInstance);
    mockNewTaskRun.mockClear();
    mockUser.mockClear();
    mockCLIPromptHandler.mockClear().mockImplementation(() => ({
      handlePrompt: vi.fn(),
    }));
    mockTask.mockClear().mockImplementation(() => mockTaskInstance);
    mockAddSubtask.mockClear();
    mockTaskRun.mockClear();
    mockWorktree.mockClear().mockImplementation(() => mockWorktreeInstance);
    mockInitRepositoryBranch.mockClear();
    mockExistsSync.mockClear();

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = (vi.spyOn(process, "exit") as any).mockImplementation(
      () => {}
    );

    vi.mocked(Command).mockImplementation(
      () =>
        ({
          option: mockOption,
          argument: mockArgument,
          parse: mockParse,
          opts: mockOpts,
          args: mockArgs(),
        } as any)
    );

    mockTaskInstance.taskId = null;
    mockTaskInstance.worktree = null;

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

  it("should call initRepositoryBranch on the worktree", async () => {
    const worktreeDir = "/valid/absolute/path";
    mockOpts.mockReturnValue({
      repositoryDir: "/repo/dir",
      worktreeDir: worktreeDir,
      configFile: "cassi.json",
    });
    mockExistsSync.mockReturnValue(true);
    mockArgs.mockReturnValue(["SomeTask"]);

    await runRunTask();

    expect(mockAddWorktree).toHaveBeenCalledWith(mockWorktreeInstance);
    expect(mockInitRepositoryBranch).toHaveBeenCalledOnce();
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

  it("should configure commander with correct arguments", async () => {
    mockOpts.mockReturnValue({
      worktreeDir: "/valid/path",
    });
    mockExistsSync.mockReturnValue(true);
    mockArgs.mockReturnValue(["MyTask", "arg1", "arg2"]);

    await runRunTask();

    expect(mockArgument).toHaveBeenCalledWith(
      "<taskName>",
      "name of the task to run"
    );
    expect(mockArgument).toHaveBeenCalledWith(
      "[taskArgs...]",
      "arguments for the task"
    );
  });

  it("should call cassi.task.newTask with correct arguments and run the task", async () => {
    const worktreeDir = "/valid/path";
    const taskName = "MyTask";
    const taskArgs = ["arg1", "arg2"];
    mockOpts.mockReturnValue({
      repositoryDir: "/repo/dir",
      worktreeDir: worktreeDir,
      configFile: "cassi.json",
    });
    mockExistsSync.mockReturnValue(true);
    mockArgs.mockReturnValue([taskName, ...taskArgs]);

    await runRunTask();

    expect(mockNewTask).toHaveBeenCalledWith(
      taskName,
      mockTaskInstance,
      ...taskArgs
    );
    expect(mockAddSubtask).toHaveBeenCalledWith(mockNewTaskInstance);
    expect(mockTaskRun).toHaveBeenCalledOnce();
    expect(mockNewTaskRun).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it("should call cassi.task.newTask without taskArgs if none are provided", async () => {
    const worktreeDir = "/valid/path";
    const taskName = "MyTask";
    mockOpts.mockReturnValue({
      repositoryDir: "/repo/dir",
      worktreeDir: worktreeDir,
      configFile: "cassi.json",
    });
    mockExistsSync.mockReturnValue(true);
    mockArgs.mockReturnValue([taskName]);

    await runRunTask();

    expect(mockNewTask).toHaveBeenCalledWith(
      taskName,
      mockTaskInstance
    );
    expect(mockAddSubtask).toHaveBeenCalledWith(mockNewTaskInstance);
    expect(mockTaskRun).toHaveBeenCalledOnce();
    expect(mockNewTaskRun).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it("should handle errors from cassi.task.newTask", async () => {
    const worktreeDir = "/valid/path";
    const taskName = "NonExistentTask";
    const error = new Error(`Task "${taskName}" not found.`);
    mockOpts.mockReturnValue({
      repositoryDir: "/repo/dir",
      worktreeDir: worktreeDir,
      configFile: "cassi.json",
    });
    mockExistsSync.mockReturnValue(true);
    mockArgs.mockReturnValue([taskName]);
    mockNewTask.mockImplementation(() => {
      throw error;
    });

    await runRunTask();

    expect(mockNewTask).toHaveBeenCalledWith(taskName, mockTaskInstance);
    expect(mockAddSubtask).not.toHaveBeenCalled();
    expect(mockTaskRun).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(error);
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("should handle errors from the created task's run method", async () => {
    const worktreeDir = "/valid/path";
    const taskName = "FailingTask";
    const error = new Error("Task execution failed");
    mockOpts.mockReturnValue({
      repositoryDir: "/repo/dir",
      worktreeDir: worktreeDir,
      configFile: "cassi.json",
    });
    mockExistsSync.mockReturnValue(true);
    mockArgs.mockReturnValue([taskName]);
    mockNewTaskRun.mockImplementation(async () => {
      throw error;
    });

    mockTaskRun.mockImplementation(async () => {
      throw error;
    });

    await runRunTask();

    expect(mockNewTask).toHaveBeenCalledWith(taskName, mockTaskInstance);
    expect(mockAddSubtask).toHaveBeenCalledWith(mockNewTaskInstance);
    expect(mockTaskRun).toHaveBeenCalledOnce();
    expect(mockNewTaskRun).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(error);
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
