import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Task } from "./Task.js";
import { Cassi } from "../cassi/Cassi.js";
import { User } from "../user/User.js";
import { Config } from "../config/Config.js";
import { Repository } from "../repository/Repository.js";
import { Tool } from "../tool/Tool.js";
import { Model } from "../model/Model.js"; // Import Model
import { Models } from "../model/Models.js"; // Import Models
import { genkit } from "genkit"; // Import genkit for mocking super call

// Mocks
vi.mock("../cassi/Cassi.js");
vi.mock("../user/User.js");
vi.mock("../config/Config.js");
vi.mock("../repository/Repository.js");
vi.mock("../tool/Tool.js");
vi.mock("../model/Model.js"); // Mock Model

// Mock genkit minimally for the super() call in MockModel
vi.mock("genkit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("genkit")>();
  return {
    ...actual,
    genkit: vi.fn(() => ({
      // Mock genkit() to return a dummy object with 'plugins'
      plugins: [],
      ai: {}, // Add a dummy 'ai' object if needed by Models constructor logic
    })),
  };
});

// Define a mock plugin function for this test file
const mockPluginInstance = { name: "mock-task-test-plugin" };
// This function now represents the plugin *initializer* like googleAI()
const mockPluginInitializer = vi.fn(() => () => mockPluginInstance);

// Mock Models subclass for testing newModel
class MockModel extends Models {
  constructor(pluginInitializer: () => any, task: Task) {
    // Expect initializer function
    // Pass the initializer function and task to super
    super(pluginInitializer(), task); // Execute the initializer before passing to super
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
  let mockModel: Model; // Mock Model instance
  let task: Task;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();
    mockPluginInitializer.mockClear();
    (genkit as ReturnType<typeof vi.fn>).mockClear();

    // Create instances of mocks
    mockUser = new User();
    mockConfig = new Config("mock-config.json", mockUser);
    mockRepository = new Repository("/mock/repo/dir", mockUser);
    mockTool = new Tool(mockUser, mockConfig);
    mockModel = new Model(); // Instantiate the mocked Model

    // Mock the Cassi instance and its properties
    mockCassi = {
      user: mockUser,
      config: mockConfig,
      repository: mockRepository,
      tool: mockTool,
      model: mockModel, // Assign the mocked Model instance
      tasks: [],
      init: vi.fn(),
      newTask: vi.fn(),
      runTasks: vi.fn(),
    } as unknown as Cassi; // Use unknown cast for partial mock

    // Create a new Task instance for each test
    task = new Task(mockCassi);

    // Mock the initTask and cleanupTask methods on the Task prototype
    vi.spyOn(Task.prototype, "initTask").mockResolvedValue();
    vi.spyOn(Task.prototype, "cleanupTask").mockResolvedValue();
  });

  afterEach(() => {
    // Restore original implementations
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
        ...methodArgs
      );

      expect(mockTool.invoke).toHaveBeenCalledTimes(1);
      expect(mockTool.invoke).toHaveBeenCalledWith(
        task,
        toolName,
        methodName,
        toolArgs,
        ...methodArgs
      );
      expect(result).toBe(expectedResult);
    });

    it("should propagate errors from cassi.tool.invoke", async () => {
      const testError = new Error("Tool invocation failed");
      (mockTool.invoke as ReturnType<typeof vi.fn>).mockRejectedValue(
        testError
      );

      await expect(
        task.invoke("fs", "writeFile", [], "a.txt", "data")
      ).rejects.toThrow(testError);
    });
  });

  describe("newModel", () => {
    let newInstanceSpy: any;

    beforeEach(() => {
      newInstanceSpy = vi
        .spyOn(mockModel, "newInstance")
        .mockImplementation((modelName: string, taskInstance: Task) => {
          // Pass the mock plugin *initializer* function
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
      // Pass the mock plugin *initializer* function
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
});
