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
import { Worktree } from "../repository/Worktree.js";
import { genkit } from "genkit";

vi.mock("../cassi/Cassi.js");
vi.mock("../user/User.js");
vi.mock("../config/Config.js");
vi.mock("../repository/Repository.js");
vi.mock("../tool/Tool.js");
vi.mock("../model/Model.js");
vi.mock("../repository/Worktree.js");

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

  describe("getCwd", () => {
    const mockWorktreePath = "/path/to/worktree";
    const mockProcessCwd = "/current/process/dir";
    let processCwdSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      processCwdSpy = vi.spyOn(process, "cwd").mockReturnValue(mockProcessCwd);
    });

    afterEach(() => {
      processCwdSpy.mockRestore();
    });

    it("should return the result of worktreeDir() if it returns a path", () => {
      task = new Task(mockCassi);
      vi.spyOn(task, "worktreeDir").mockReturnValue(mockWorktreePath);

      expect(task.getCwd()).toBe(mockWorktreePath);
      expect(processCwdSpy).not.toHaveBeenCalled();
    });

    it("should return process.cwd() if worktreeDir() throws an error", () => {
      task = new Task(mockCassi);
      const worktreeError = new Error("Worktree not found");
      vi.spyOn(task, "worktreeDir").mockImplementation(() => {
        throw worktreeError;
      });

      expect(task.getCwd()).toBe(mockProcessCwd);
      expect(processCwdSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("worktreeDir", () => {
    const mockWorktreePath = "/path/to/worktree";

    it("should return worktree.worktreeDir if worktree exists and has worktreeDir", () => {
      task = new Task(mockCassi);
      task.worktree = { worktreeDir: mockWorktreePath } as Worktree;
      expect(task.worktreeDir()).toBe(mockWorktreePath);
    });

    it("should call parentTask.worktreeDir() if worktree is not set and parentTask exists", () => {
      const parentTask = new Task(mockCassi);
      const parentWorktreeDirSpy = vi
        .spyOn(parentTask, "worktreeDir")
        .mockReturnValue(mockWorktreePath);

      const childTask = new Task(mockCassi, parentTask);
      childTask.worktree = undefined;

      expect(childTask.worktreeDir()).toBe(mockWorktreePath);
      expect(parentWorktreeDirSpy).toHaveBeenCalledTimes(1);

      parentWorktreeDirSpy.mockRestore();
    });

    it("should throw an error if worktree is not set and parentTask is null", () => {
      task = new Task(mockCassi);
      task.worktree = undefined;
      task.parentTask = null;

      expect(() => task.worktreeDir()).toThrow(
        "Worktree directory not found for this task or any parent task."
      );
    });

    it("should throw an error if worktree exists but worktreeDir is undefined", () => {
      task = new Task(mockCassi);
      task.worktree = {} as Worktree;
      task.parentTask = null;

      expect(() => task.worktreeDir()).toThrow(
        "Worktree directory not found for this task or any parent task."
      );
    });

    it("should throw an error if parentTask exists but its worktreeDir() throws", () => {
      const parentTask = new Task(mockCassi);
      const parentError = new Error("Parent worktree not found");
      const parentWorktreeDirSpy = vi
        .spyOn(parentTask, "worktreeDir")
        .mockImplementation(() => {
          throw parentError;
        });

      const childTask = new Task(mockCassi, parentTask);
      childTask.worktree = undefined;

      expect(() => childTask.worktreeDir()).toThrow(
        "Worktree directory not found for this task or any parent task."
      );
      expect(parentWorktreeDirSpy).toHaveBeenCalledTimes(1);

      parentWorktreeDirSpy.mockRestore();
    });

    it("should handle nested parent tasks correctly, returning the first available worktreeDir", () => {
      const grandParentTask = new Task(mockCassi);
      grandParentTask.worktree = { worktreeDir: mockWorktreePath } as Worktree;
      const grandParentSpy = vi.spyOn(grandParentTask, "worktreeDir");

      const parentTask = new Task(mockCassi, grandParentTask);
      parentTask.worktree = undefined;
      const parentSpy = vi.spyOn(parentTask, "worktreeDir");

      const childTask = new Task(mockCassi, parentTask);
      childTask.worktree = undefined;

      expect(childTask.worktreeDir()).toBe(mockWorktreePath);
      expect(parentSpy).toHaveBeenCalledTimes(1);
      expect(grandParentSpy).toHaveBeenCalledTimes(1);

      grandParentSpy.mockRestore();
      parentSpy.mockRestore();
    });

    it("should handle nested parent tasks where an intermediate parent throws", () => {
      const grandParentTask = new Task(mockCassi);
      grandParentTask.worktree = { worktreeDir: mockWorktreePath } as Worktree;
      const grandParentSpy = vi.spyOn(grandParentTask, "worktreeDir");

      const parentTask = new Task(mockCassi, grandParentTask);
      parentTask.worktree = undefined;
      const parentSpy = vi
        .spyOn(parentTask, "worktreeDir")
        .mockImplementation(() => {
          throw new Error("Intermediate parent error");
        });

      const childTask = new Task(mockCassi, parentTask);
      childTask.worktree = undefined;

      expect(() => childTask.worktreeDir()).toThrow(
        "Worktree directory not found for this task or any parent task."
      );
      expect(parentSpy).toHaveBeenCalledTimes(1);
      expect(grandParentSpy).not.toHaveBeenCalled();

      grandParentSpy.mockRestore();
      parentSpy.mockRestore();
    });
  });

  describe("setTaskId", () => {
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

      task.setTaskId(summary);

      expect(task.taskId).toBeDefined();
      expect(task.taskId).toMatch(/^[a-zA-Z0-9]{8}-implement-feature-x$/);
    });

    it("should handle summaries with different characters", () => {
      const summary = "Fix Bug #123 with $pecial Chars!";
      const expectedSlug = "fix-bug-123-with-pecial-chars";
      const expectedHashInput = `${expectedSlug}${mockTimestamp}`;

      task.setTaskId(summary);

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

      task1.setTaskId(summary1);
      task2.setTaskId(summary2);

      expect(task1.taskId).not.toBe(task2.taskId);
      expect(task1.taskId).toMatch(/^[a-zA-Z0-9]{8}-summary-one$/);
      expect(task2.taskId).toMatch(/^[a-zA-Z0-9]{8}-summary-two$/);
    });

    it("should generate different IDs for the same summary at different times", () => {
      const summary = "Same Summary";

      const task1 = new Task(mockCassi);
      task1.setTaskId(summary);
      const taskId1 = task1.taskId;

      dateNowSpy.mockReturnValue(mockTimestamp + 1000);

      const task2 = new Task(mockCassi);
      task2.setTaskId(summary);
      const taskId2 = task2.taskId;

      expect(taskId1).not.toBe(taskId2);
      expect(taskId1).toMatch(/^[a-zA-Z0-9]{8}-same-summary$/);
      expect(taskId2).toMatch(/^[a-zA-Z0-9]{8}-same-summary$/);
    });
  });

  describe("initWorktree", () => {
    let mockWorktree: Worktree;
    let getWorktreeSpy: any;
    let mockFileInfo: any;

    beforeEach(() => {
      mockFileInfo = { getInfo: vi.fn(), deleteCache: vi.fn() };
      mockWorktree = {
        repository: mockRepository,
        task: task,
        worktreeDir: "/mock/worktree/dir",
        fileInfo: mockFileInfo,
        init: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn(),
        repositoryBranch: "main",
        initRepositoryBranch: vi.fn(),
        name: "mock-worktree",
      } as Worktree;
      getWorktreeSpy = vi
        .spyOn(mockRepository, "getWorktree")
        .mockResolvedValue(mockWorktree);
    });

    it("should call cassi.repository.getWorktree with the task instance", async () => {
      await task.initWorktree();
      expect(getWorktreeSpy).toHaveBeenCalledTimes(1);
      expect(getWorktreeSpy).toHaveBeenCalledWith(task);
    });

    it("should set the task.worktree property to the returned worktree", async () => {
      expect(task.worktree).toBeUndefined();
      await task.initWorktree();
      expect(task.worktree).toBe(mockWorktree);
    });

    it("should propagate errors from cassi.repository.getWorktree", async () => {
      const testError = new Error("Failed to get worktree");
      getWorktreeSpy.mockRejectedValue(testError);

      await expect(task.initWorktree()).rejects.toThrow(testError);
      expect(task.worktree).toBeUndefined();
    });
  });

  describe("getTaskId", () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it("should return taskId if set on the current task", () => {
      const testId = "task-123";
      task.taskId = testId;
      expect(task.getTaskId()).toBe(testId);
    });

    it("should return parentTask's taskId if current task's taskId is null and parent exists", () => {
      const parentId = "parent-456";
      const parentTask = new Task(mockCassi);
      parentTask.taskId = parentId;
      task.parentTask = parentTask;
      task.taskId = null;
      expect(task.getTaskId()).toBe(parentId);
    });

    it("should return grandparentTask's taskId if current and parent task's taskId are null", () => {
      const grandParentId = "grandparent-789";
      const grandParentTask = new Task(mockCassi);
      grandParentTask.taskId = grandParentId;

      const parentTask = new Task(mockCassi, grandParentTask);
      parentTask.taskId = null;

      task.parentTask = parentTask;
      task.taskId = null;

      expect(task.getTaskId()).toBe(grandParentId);
    });

    it('should return "XXXXXXXX" if taskId is null and there is no parentTask', () => {
      task.taskId = null;
      task.parentTask = null;
      expect(task.getTaskId()).toBe("XXXXXXXX");
    });

    it('should return "XXXXXXXX" if taskId is null and parentTask exists but also has null taskId and no further parent', () => {
      const parentTask = new Task(mockCassi);
      parentTask.taskId = null;
      parentTask.parentTask = null;

      task.parentTask = parentTask;
      task.taskId = null;

      expect(task.getTaskId()).toBe("XXXXXXXX");
    });
  });

  describe("getTaskIdShort", () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it("should return the first 8 characters of taskId if set", () => {
      const testId = "task-1234567890";
      task.taskId = testId;
      expect(task.getTaskIdShort()).toBe("task-123");
    });

    it("should return the first 8 characters of parentTask's taskId if current taskId is null", () => {
      const parentId = "parent-abcdefghij";
      const parentTask = new Task(mockCassi);
      parentTask.taskId = parentId;
      task.parentTask = parentTask;
      task.taskId = null;
      expect(task.getTaskIdShort()).toBe("parent-a");
    });

    it("should return the first 8 characters of grandparentTask's taskId if current and parent taskId are null", () => {
      const grandParentId = "grandpa-qwertyuiop";
      const grandParentTask = new Task(mockCassi);
      grandParentTask.taskId = grandParentId;
      const parentTask = new Task(mockCassi, grandParentTask);
      parentTask.taskId = null;
      task.parentTask = parentTask;
      task.taskId = null;
      expect(task.getTaskIdShort()).toBe("grandpa-");
    });

    it('should return the first 8 characters of "XXXXXXXX" if no taskId is found', () => {
      task.taskId = null;
      task.parentTask = null;
      expect(task.getTaskIdShort()).toBe("XXXXXXXX");
    });

    it('should return the first 8 characters of "XXXXXXXX" even if parent exists but has no taskId', () => {
      const parentTask = new Task(mockCassi);
      parentTask.taskId = null;
      task.parentTask = parentTask;
      task.taskId = null;
      expect(task.getTaskIdShort()).toBe("XXXXXXXX");
    });
  });

  describe("getWorkTree", () => {
    let mockWorktree: Worktree;
    let mockFileInfo: any;

    beforeEach(() => {
      mockFileInfo = { getInfo: vi.fn(), deleteCache: vi.fn() };
      mockWorktree = {
        repository: mockRepository,
        task: task,
        worktreeDir: "/mock/worktree/dir",
        fileInfo: mockFileInfo,
        init: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn(),
        repositoryBranch: "main",
        initRepositoryBranch: vi.fn(),
        name: "mock-worktree",
      } as Worktree;
    });

    it("should return this.worktree if it is set", () => {
      task.worktree = mockWorktree;
      expect(task.getWorkTree()).toBe(mockWorktree);
    });

    it("should call parentTask.getWorkTree() if this.worktree is null and parentTask exists", () => {
      const parentTask = new Task(mockCassi);
      parentTask.worktree = mockWorktree;
      const parentGetWorkTreeSpy = vi.spyOn(parentTask, "getWorkTree");

      task.parentTask = parentTask;
      task.worktree = undefined;

      const result = task.getWorkTree();

      expect(result).toBe(mockWorktree);
      expect(parentGetWorkTreeSpy).toHaveBeenCalledTimes(1);

      parentGetWorkTreeSpy.mockRestore();
    });

    it("should throw an error if this.worktree is null and parentTask is null", () => {
      task.worktree = undefined;
      task.parentTask = null;

      expect(() => task.getWorkTree()).toThrow(
        "Worktree not found for this task or any parent task."
      );
    });

    it("should throw an error if this.worktree is null and parentTask.getWorkTree() throws", () => {
      const parentTask = new Task(mockCassi);
      const parentError = new Error("Parent worktree retrieval failed");
      const parentGetWorkTreeSpy = vi
        .spyOn(parentTask, "getWorkTree")
        .mockImplementation(() => {
          throw parentError;
        });

      task.parentTask = parentTask;
      task.worktree = undefined;

      expect(() => task.getWorkTree()).toThrow(
        "Worktree not found for this task or any parent task."
      );
      expect(parentGetWorkTreeSpy).toHaveBeenCalledTimes(1);

      parentGetWorkTreeSpy.mockRestore();
    });

    it("should handle nested parent tasks, returning the first available worktree", () => {
      const grandParentTask = new Task(mockCassi);
      grandParentTask.worktree = mockWorktree;
      const grandParentSpy = vi.spyOn(grandParentTask, "getWorkTree");

      const parentTask = new Task(mockCassi, grandParentTask);
      parentTask.worktree = undefined;
      const parentSpy = vi.spyOn(parentTask, "getWorkTree");

      task.parentTask = parentTask;
      task.worktree = undefined;

      const result = task.getWorkTree();

      expect(result).toBe(mockWorktree);
      expect(parentSpy).toHaveBeenCalledTimes(1);
      expect(grandParentSpy).toHaveBeenCalledTimes(1);

      grandParentSpy.mockRestore();
      parentSpy.mockRestore();
    });

    it("should throw an error if no worktree is found in the entire parent chain", () => {
      const grandParentTask = new Task(mockCassi);
      grandParentTask.worktree = undefined;
      const grandParentSpy = vi.spyOn(grandParentTask, "getWorkTree");

      const parentTask = new Task(mockCassi, grandParentTask);
      parentTask.worktree = undefined;
      const parentSpy = vi.spyOn(parentTask, "getWorkTree");

      task.parentTask = parentTask;
      task.worktree = undefined;

      expect(() => task.getWorkTree()).toThrow(
        "Worktree not found for this task or any parent task."
      );
      expect(parentSpy).toHaveBeenCalledTimes(1);
      expect(grandParentSpy).toHaveBeenCalledTimes(1);

      grandParentSpy.mockRestore();
      parentSpy.mockRestore();
    });
  });

  describe("getRootTask", () => {
    it("should return the task itself if it has no parent", () => {
      task.parentTask = null;
      expect(task.getRootTask()).toBe(task);
    });

    it("should return the parent task if it exists and has no parent", () => {
      const parentTask = new Task(mockCassi);
      parentTask.parentTask = null;
      task.parentTask = parentTask;
      expect(task.getRootTask()).toBe(parentTask);
    });

    it("should return the top-level ancestor task in a multi-level hierarchy", () => {
      const grandParentTask = new Task(mockCassi);
      grandParentTask.parentTask = null;

      const parentTask = new Task(mockCassi, grandParentTask);

      const childTask = new Task(mockCassi, parentTask);

      const grandChildTask = new Task(mockCassi, childTask);

      expect(grandChildTask.getRootTask()).toBe(grandParentTask);
      expect(childTask.getRootTask()).toBe(grandParentTask);
      expect(parentTask.getRootTask()).toBe(grandParentTask);
    });

    it("should return the task itself if the parent is explicitly set to null", () => {
      const parentTask = new Task(mockCassi);
      task.parentTask = parentTask;
      task.parentTask = null;
      expect(task.getRootTask()).toBe(task);
    });
  });
});
