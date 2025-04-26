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

const mockParse = vi.fn().mockReturnThis(); // Chain .parse()
const mockOption = vi.fn().mockReturnThis();
const mockArgument = vi.fn().mockReturnThis(); // Add mockArgument
const mockOpts = vi.fn();
const mockArgs = vi.fn().mockReturnValue([]); // Add mockArgs

vi.mocked(Command).mockImplementation(
  () =>
    ({
      option: mockOption,
      argument: mockArgument, // Add argument
      parse: mockParse,
      opts: mockOpts,
      args: mockArgs(), // Add args
    } as any)
);

const mockExistsSync = vi.mocked(fs.existsSync);
const mockAddWorktree = vi.fn();
const mockCassiInit = vi.fn();
const mockNewTaskRun = vi.fn(); // Mock for the created task's run method
const mockNewTaskInstance = { run: mockNewTaskRun }; // Mock instance returned by newTask
const mockNewTask = vi.fn().mockReturnValue(mockNewTaskInstance); // Mock for cassi.task.newTask
const mockCassi = vi.fn().mockImplementation(() => ({
  init: mockCassiInit,
  repository: {
    addWorktree: mockAddWorktree,
  },
  task: {
    // Add task property
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
const mockAddSubtask = vi.fn(); // Mock for task.addSubtask
const mockTaskRun = vi.fn(); // Mock for task.run
const mockTaskInstance = {
  taskId: null,
  worktree: null,
  addSubtask: mockAddSubtask,
  run: mockTaskRun,
};
const mockTask = vi.fn().mockImplementation(() => mockTaskInstance);
vi.mocked(Task).mockImplementation(mockTask);

const { Worktree } = await import("../lib/repository/Worktree.js");
const mockInitRepositoryBranch = vi.fn(); // Mock for initRepositoryBranch
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

    // Reset mocks for commander
    mockOption.mockClear().mockReturnThis();
    mockArgument.mockClear().mockReturnThis();
    mockParse.mockClear().mockReturnThis();
    mockOpts.mockClear();
    mockArgs.mockClear().mockReturnValue([]);

    // Reset mocks for Cassi and related components
    mockCassiInit.mockClear();
    mockAddWorktree.mockClear();
    mockNewTask.mockClear().mockReturnValue(mockNewTaskInstance);
    mockNewTaskRun.mockClear();
    mockUser.mockClear();
    mockCLIPromptHandler.mockClear().mockImplementation(() => ({
      handlePrompt: vi.fn(),
    }));
    mockTask.mockClear().mockImplementation(() => mockTaskInstance);
    mockAddSubtask.mockClear(); // Reset addSubtask mock
    mockTaskRun.mockClear(); // Reset task.run mock
    mockWorktree.mockClear().mockImplementation(() => mockWorktreeInstance);
    mockInitRepositoryBranch.mockClear(); // Reset initRepositoryBranch mock
    mockExistsSync.mockClear();

    // Reset spies
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = (vi.spyOn(process, "exit") as any).mockImplementation(
      () => {}
    );

    // Re-apply mocks with cleared state for Command
    vi.mocked(Command).mockImplementation(
      () =>
        ({
          option: mockOption,
          argument: mockArgument, // Ensure argument is included
          parse: mockParse,
          opts: mockOpts,
          args: mockArgs(), // Ensure args is included
        } as any)
    );

    // Reset mock instance states
    mockTaskInstance.taskId = null;
    mockTaskInstance.worktree = null;

    // Re-apply other mocks (redundant but safe)
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
    mockArgs.mockReturnValue(["SomeTask"]); // Need a task name

    await runRunTask();

    expect(mockAddWorktree).toHaveBeenCalledWith(mockWorktreeInstance);
    expect(mockInitRepositoryBranch).toHaveBeenCalledOnce(); // Verify the call
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
      mockTaskInstance, // The parent task instance
      ...taskArgs
    );
    expect(mockAddSubtask).toHaveBeenCalledWith(mockNewTaskInstance); // Check addSubtask call
    expect(mockTaskRun).toHaveBeenCalledOnce(); // Check main task run call
    expect(mockNewTaskRun).not.toHaveBeenCalled(); // Ensure subtask run wasn't called directly
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
    mockArgs.mockReturnValue([taskName]); // Only taskName

    await runRunTask();

    expect(mockNewTask).toHaveBeenCalledWith(
      taskName,
      mockTaskInstance // The parent task instance
    ); // No spread args
    expect(mockAddSubtask).toHaveBeenCalledWith(mockNewTaskInstance); // Check addSubtask call
    expect(mockTaskRun).toHaveBeenCalledOnce(); // Check main task run call
    expect(mockNewTaskRun).not.toHaveBeenCalled(); // Ensure subtask run wasn't called directly
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
    expect(mockAddSubtask).not.toHaveBeenCalled(); // Should fail before adding subtask
    expect(mockTaskRun).not.toHaveBeenCalled(); // Main task run shouldn't be called
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

    // Mock the main task's run to throw the error (simulating subtask failure)
    mockTaskRun.mockImplementation(async () => {
      throw error;
    });

    await runRunTask();

    expect(mockNewTask).toHaveBeenCalledWith(taskName, mockTaskInstance);
    expect(mockAddSubtask).toHaveBeenCalledWith(mockNewTaskInstance); // Subtask was added
    expect(mockTaskRun).toHaveBeenCalledOnce(); // Main task run was called
    expect(mockNewTaskRun).not.toHaveBeenCalled(); // Subtask run wasn't called directly by the script
    expect(consoleErrorSpy).toHaveBeenCalledWith(error);
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
