import process from "node:process";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Task } from "./Task.js";
import { Cassi } from "../cassi/Cassi.js";
import { User } from "../user/User.js";
import { Config } from "../config/Config.js";
import { Repository } from "../repository/Repository.js";
import { Tool } from "../tool/Tool.js";
import { Model } from "../model/Model.js";
import { Models } from "../model/Models.js";
import { genkit } from "genkit";

vi.mock("../cassi/Cassi.js");
vi.mock("../user/User.js");
vi.mock("../config/Config.js");
vi.mock("../repository/Repository.js");
vi.mock("../tool/Tool.js");
vi.mock("../model/Model.js");

vi.mock("genkit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("genkit")>();
  return {
    ...actual,
    genkit: vi.fn(() => ({
      plugins: [],
      ai: {},
    })),
  };
});

const mockPluginInstance = { name: "mock-task-test-plugin" };
const mockPluginInitializer = vi.fn(() => () => mockPluginInstance);

class MockModel extends Models {
  constructor(pluginInitializer: () => any, task: Task) {
    super(pluginInitializer(), task);
  }
  async generate(options: any): Promise<string> {
    return "mock generated content";
  }
}

describe("Task", () => {
  let mockCassi: Cassi;
  let mockUser: User;
  let mockConfig: Config;
  let mockRepository: Repository;
  let mockTool: Tool;
  let mockModel: Model;
  let task: Task;

  beforeEach(() => {
    vi.resetAllMocks();
    mockPluginInitializer.mockClear();
    (genkit as ReturnType<typeof vi.fn>).mockClear();

    mockUser = new User();
    mockConfig = new Config("mock-config.json", mockUser);
    mockRepository = new Repository("/mock/repo/dir", mockUser);
    mockTool = new Tool(mockUser, mockConfig);
    mockModel = new Model();

    mockCassi = {
      user: mockUser,
      config: mockConfig,
      repository: mockRepository,
      tool: mockTool,
      model: mockModel,
      tasks: [],
      init: vi.fn(),
      newTask: vi.fn(),
      runTasks: vi.fn(),
    } as unknown as Cassi;

    task = new Task(mockCassi);

    vi.spyOn(Task.prototype, "initTask").mockResolvedValue();
    vi.spyOn(Task.prototype, "cleanupTask").mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should create an instance of Task", () => {
    expect(task).toBeInstanceOf(Task);
    expect(task.cassi).toBe(mockCassi);
  });

  it("should have an empty subTasks array by default", () => {
    expect(task.subTasks).toEqual([]);
  });

  it("should have null startedAt by default", () => {
    expect(task.startedAt).toBeNull();
  });

  it("should have null finishedAt by default", () => {
    expect(task.finishedAt).toBeNull();
  });

  it("should have null error by default", () => {
    expect(task.error).toBeNull();
  });

  it("should have null taskId by default", () => {
    expect(task.taskId).toBeNull();
  });

  it("should have null parentTask by default", () => {
    expect(task.parentTask).toBeNull();
  });

  it("should correctly assign parentTask when provided", () => {
    const parent = new Task(mockCassi);
    const child = new Task(mockCassi, parent);
    expect(child.parentTask).toBe(parent);
  });

  describe("initTask", () => {
    it("should exist and run without error", async () => {
      await expect(task.initTask()).resolves.toBeUndefined();
    });
  });

  describe("cleanupTask", () => {
    it("should exist and run without error", async () => {
      await expect(task.cleanupTask()).resolves.toBeUndefined();
    });
  });

  describe("run", () => {
    it("should call initTask before running subtasks", async () => {
      const subTask = new Task(mockCassi, task);
      const subTaskRunSpy = vi.spyOn(subTask, "run").mockResolvedValue();
      task.addSubtask(subTask);

      await task.run();

      expect(task.initTask).toHaveBeenCalled();
      const initTaskCallOrder = (task.initTask as any).mock
        .invocationCallOrder[0];
      const subTaskRunCallOrder = subTaskRunSpy.mock.invocationCallOrder[0];
      expect(initTaskCallOrder).toBeLessThan(subTaskRunCallOrder);
    });

    it("should set startedAt and finishedAt dates", async () => {
      expect(task.startedAt).toBeNull();
      expect(task.finishedAt).toBeNull();

      await task.run();

      expect(task.startedAt).toBeInstanceOf(Date);
      expect(task.finishedAt).toBeInstanceOf(Date);
      expect(task.finishedAt!.getTime()).toBeGreaterThanOrEqual(
        task.startedAt!.getTime()
      );
    });

    it("should run subtasks sequentially after initTask", async () => {
      const subTask1 = new Task(mockCassi, task);
      const subTask2 = new Task(mockCassi, task);
      const subTask1RunSpy = vi.spyOn(subTask1, "run").mockResolvedValue();
      const subTask2RunSpy = vi.spyOn(subTask2, "run").mockResolvedValue();
      task.addSubtask(subTask1);
      task.addSubtask(subTask2);

      await task.run();

      expect(task.initTask).toHaveBeenCalled();
      expect(subTask1RunSpy).toHaveBeenCalled();
      expect(subTask2RunSpy).toHaveBeenCalled();

      const initCallOrder = (task.initTask as any).mock.invocationCallOrder[0];
      const sub1CallOrder = subTask1RunSpy.mock.invocationCallOrder[0];
      const sub2CallOrder = subTask2RunSpy.mock.invocationCallOrder[0];

      expect(initCallOrder).toBeLessThan(sub1CallOrder);
      expect(sub1CallOrder).toBeLessThan(sub2CallOrder);
    });

    it("should set error property if initTask throws", async () => {
      const testError = new Error("Init failed");
      vi.spyOn(task, "initTask").mockRejectedValue(testError);

      await task.run();

      expect(task.error).toBe(testError);
      expect(task.finishedAt).toBeInstanceOf(Date);
    });

    it("should set error property if a subtask throws", async () => {
      const testError = new Error("Subtask failed");
      const subTask1 = new Task(mockCassi, task);
      const subTask2 = new Task(mockCassi, task);
      vi.spyOn(subTask1, "run").mockRejectedValue(testError);
      const subTask2RunSpy = vi.spyOn(subTask2, "run");

      task.addSubtask(subTask1);
      task.addSubtask(subTask2);

      await task.run();

      expect(task.error).toBe(testError);
      expect(subTask2RunSpy).not.toHaveBeenCalled();
      expect(task.finishedAt).toBeInstanceOf(Date);
    });

    it("should set error property if a subtask sets its error property", async () => {
      const subtaskError = new Error("Subtask internal failure");
      const subTask1 = new Task(mockCassi, task);
      const subTask2 = new Task(mockCassi, task);

      vi.spyOn(subTask1, "run").mockImplementation(async () => {
        subTask1.error = subtaskError;
        throw subtaskError;
      });
      const subTask2RunSpy = vi.spyOn(subTask2, "run");

      task.addSubtask(subTask1);
      task.addSubtask(subTask2);

      await task.run();

      expect(task.error).toBe(subtaskError);
      expect(subTask2RunSpy).not.toHaveBeenCalled();
      expect(task.finishedAt).toBeInstanceOf(Date);
    });

    it("should handle non-Error objects thrown", async () => {
      const nonError = "Something went wrong";
      vi.spyOn(task, "initTask").mockRejectedValue(nonError);

      await task.run();

      expect(task.error).toBeInstanceOf(Error);
      expect(task.error?.message).toBe(nonError);
      expect(task.finishedAt).toBeInstanceOf(Date);
    });

    it("should call cleanupTask in finally block on success", async () => {
      await task.run();
      expect(task.cleanupTask).toHaveBeenCalled();
    });

    it("should call cleanupTask in finally block even if initTask throws", async () => {
      vi.spyOn(task, "initTask").mockRejectedValue(new Error("Init failed"));
      await task.run();
      expect(task.cleanupTask).toHaveBeenCalled();
    });

    it("should call cleanupTask in finally block even if a subtask throws", async () => {
      const subTask = new Task(mockCassi, task);
      vi.spyOn(subTask, "run").mockRejectedValue(new Error("Subtask failed"));
      task.addSubtask(subTask);
      await task.run();
      expect(task.cleanupTask).toHaveBeenCalled();
    });

    it("should log error if cleanupTask itself throws but not overwrite original error", async () => {
      const originalError = new Error("Init failed");
      const cleanupError = new Error("Cleanup failed");
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      vi.spyOn(task, "initTask").mockRejectedValue(originalError);
      vi.spyOn(task, "cleanupTask").mockRejectedValue(cleanupError);

      await task.run();

      expect(task.error).toBe(originalError);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `[Task] Error during cleanup for Task: ${cleanupError.message}`
      );

      consoleErrorSpy.mockRestore();
    });

    it("should log error if cleanupTask throws when run was successful", async () => {
      const cleanupError = new Error("Cleanup failed");
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      vi.spyOn(task, "cleanupTask").mockRejectedValue(cleanupError);

      await task.run();

      expect(task.error).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `[Task] Error during cleanup for Task: ${cleanupError.message}`
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("invoke", () => {
    beforeEach(() => {
      mockTool.invoke = vi.fn();
    });

    it("should call cassi.tool.invoke with the correct arguments and return its result", async () => {
      const expectedResult = { success: true };
      (mockTool.invoke as ReturnType<typeof vi.fn>).mockResolvedValue(
        expectedResult
      );

      const toolName = "fs";
      const methodName = "readFile";
      const toolArgs = ["/path/to/tool"];
      const methodArgs = ["file.txt", "utf8"];

      const result = await task.invoke(
        toolName,
        methodName,
        toolArgs,
        methodArgs
      );

      expect(mockTool.invoke).toHaveBeenCalledTimes(1);
      expect(mockTool.invoke).toHaveBeenCalledWith(
        task,
        toolName,
        methodName,
        toolArgs,
        methodArgs
      );
      expect(result).toBe(expectedResult);
    });

    it("should propagate errors from cassi.tool.invoke", async () => {
      const testError = new Error("Tool invocation failed");
      (mockTool.invoke as ReturnType<typeof vi.fn>).mockRejectedValue(
        testError
      );

      await expect(
        task.invoke("fs", "writeFile", [], ["a.txt", "data"])
      ).rejects.toThrow(testError);
    });
  });

  describe("newModel", () => {
    let newInstanceSpy: any;

    beforeEach(() => {
      newInstanceSpy = vi
        .spyOn(mockModel, "newInstance")
        .mockImplementation((modelName: string, taskInstance: Task) => {
          return new MockModel(mockPluginInitializer, taskInstance);
        }) as any;
    });

    it("should call cassi.model.newInstance with the correct model class name and task instance", () => {
      const modelClassName = "MockModel";
      task.newModel(modelClassName);

      expect(newInstanceSpy).toHaveBeenCalledTimes(1);
      expect(newInstanceSpy).toHaveBeenCalledWith(modelClassName, task);
    });

    it("should return the model instance created by cassi.model.newInstance", () => {
      const modelClassName = "AnotherModel";
      const expectedInstance = new MockModel(mockPluginInitializer, task);
      newInstanceSpy.mockReturnValue(expectedInstance);

      const result = task.newModel(modelClassName);

      expect(result).toBe(expectedInstance);
    });

    it("should throw an error if cassi.model.newInstance throws", () => {
      const modelClassName = "NonExistentModel";
      const testError = new Error(`Model class '${modelClassName}' not found.`);
      newInstanceSpy.mockImplementation(() => {
        throw testError;
      });

      expect(() => task.newModel(modelClassName)).toThrow(testError);
      expect(newInstanceSpy).toHaveBeenCalledTimes(1);
      expect(newInstanceSpy).toHaveBeenCalledWith(modelClassName, task);
    });
  });

  describe("addSubtask", () => {
    it("should add the subtask to the subTasks array", () => {
      const subtask = new Task(mockCassi);
      expect(task.subTasks).toHaveLength(0);
      task.addSubtask(subtask);
      expect(task.subTasks).toHaveLength(1);
      expect(task.subTasks[0]).toBe(subtask);
    });

    it("should set the parentTask property on the subtask", () => {
      const subtask = new Task(mockCassi);
      expect(subtask.parentTask).toBeNull();
      task.addSubtask(subtask);
      expect(subtask.parentTask).toBe(task);
    });

    it("should allow adding multiple subtasks", () => {
      const subtask1 = new Task(mockCassi);
      const subtask2 = new Task(mockCassi);
      task.addSubtask(subtask1);
      task.addSubtask(subtask2);
      expect(task.subTasks).toHaveLength(2);
      expect(task.subTasks).toContain(subtask1);
      expect(task.subTasks).toContain(subtask2);
      expect(subtask1.parentTask).toBe(task);
      expect(subtask2.parentTask).toBe(task);
    });
  });

  describe("cwd", () => {
    const mockWorktreeDir = "/path/to/worktree";
    const mockProcessCwd = "/current/process/dir";

    beforeEach(() => {});

    it("should return task.worktreeDir if set", () => {
      task = new Task(mockCassi);
      task.worktreeDir = mockWorktreeDir;
      expect(task.getCwd()).toBe(mockWorktreeDir);
    });

    it("should return parentTask.getCwd() if task.worktreeDir is not set and parentTask exists", () => {
      const parentTask = new Task(mockCassi);
      const parentGetCwdSpy = vi
        .spyOn(parentTask, "getCwd")
        .mockReturnValue(mockWorktreeDir);

      const childTask = new Task(mockCassi, parentTask);
      childTask.worktreeDir = undefined;

      expect(childTask.getCwd()).toBe(mockWorktreeDir);
      expect(parentGetCwdSpy).toHaveBeenCalled();

      parentGetCwdSpy.mockRestore();
    });

    it("should return process.cwd() if task.worktreeDir and parentTask are not set", () => {
      const processCwdSpy = vi
        .spyOn(process, "cwd")
        .mockReturnValue(mockProcessCwd);
      task = new Task(mockCassi);
      task.worktreeDir = undefined;

      expect(task.getCwd()).toBe(mockProcessCwd);
      expect(processCwdSpy).toHaveBeenCalled();

      processCwdSpy.mockRestore();
    });

    it("should handle nested parent tasks correctly", () => {
      const grandParentTask = new Task(mockCassi);
      const grandParentGetCwdSpy = vi
        .spyOn(grandParentTask, "getCwd")
        .mockReturnValue(mockWorktreeDir);

      const parentTask = new Task(mockCassi, grandParentTask);
      parentTask.worktreeDir = undefined;
      const childTask = new Task(mockCassi, parentTask);
      childTask.worktreeDir = undefined;

      expect(childTask.getCwd()).toBe(mockWorktreeDir);
      expect(grandParentGetCwdSpy).toHaveBeenCalled();

      grandParentGetCwdSpy.mockRestore();
    });
  });

  describe("setTaskID", () => {
    let dateNowSpy: any;
    const mockTimestamp = 1678886400000;

    beforeEach(() => {
      dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(mockTimestamp);
    });

    afterEach(() => {
      dateNowSpy.mockRestore();
    });

    it("should generate a taskId based on the summary and current timestamp", () => {
      const summary = "Implement Feature X";
      const expectedSlug = "implement-feature-x";
      const expectedHashInput = `${expectedSlug}${mockTimestamp}`;

      task.setTaskID(summary);

      expect(task.taskId).toBeDefined();
      expect(task.taskId).toMatch(/^[a-zA-Z0-9]{8}-implement-feature-x$/);
    });

    it("should handle summaries with different characters", () => {
      const summary = "Fix Bug #123 with $pecial Chars!";
      const expectedSlug = "fix-bug-123-with-pecial-chars";
      const expectedHashInput = `${expectedSlug}${mockTimestamp}`;

      task.setTaskID(summary);

      expect(task.taskId).toBeDefined();
      expect(task.taskId).toMatch(
        /^[a-zA-Z0-9]{8}-fix-bug-123-with-pecial-chars$/
      );
    });

    it("should generate different IDs for different summaries at the same time", () => {
      const summary1 = "Summary One";
      const summary2 = "Summary Two";

      const task1 = new Task(mockCassi);
      const task2 = new Task(mockCassi);

      task1.setTaskID(summary1);
      task2.setTaskID(summary2);

      expect(task1.taskId).not.toBe(task2.taskId);
      expect(task1.taskId).toMatch(/^[a-zA-Z0-9]{8}-summary-one$/);
      expect(task2.taskId).toMatch(/^[a-zA-Z0-9]{8}-summary-two$/);
    });

    it("should generate different IDs for the same summary at different times", () => {
      const summary = "Same Summary";

      const task1 = new Task(mockCassi);
      task1.setTaskID(summary);
      const taskId1 = task1.taskId;

      dateNowSpy.mockReturnValue(mockTimestamp + 1000);

      const task2 = new Task(mockCassi);
      task2.setTaskID(summary);
      const taskId2 = task2.taskId;

      expect(taskId1).not.toBe(taskId2);
      expect(taskId1).toMatch(/^[a-zA-Z0-9]{8}-same-summary$/);
      expect(taskId2).toMatch(/^[a-zA-Z0-9]{8}-same-summary$/);
    });
  });
});
