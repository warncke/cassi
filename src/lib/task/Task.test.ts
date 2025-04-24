import { Task } from "./Task.js";
import { Cassi } from "../cassi/Cassi.js";
import { User } from "../user/User.js";
import { Model } from "../model/Model.js"; // Keep for error test case
import { Models } from "../model/Models.js"; // Import Models
import { ModelReference } from "genkit/model"; // Import ModelReference

import { describe, expect, test, beforeEach, vi } from "vitest";

// Mock plugin and model reference for Models constructor
// Change mockPlugin to be a function as expected by genkit
const mockPlugin = () => "mockPluginFunction";
const mockModelRef = { name: "mockModelRef" } as ModelReference<any>;

// Mock Model class for testing, now extending Models
class MockModel extends Models {
  constructor() {
    // Call super with mock plugin and model reference
    super(mockPlugin, mockModelRef);
  }
  // Add any methods needed for testing if necessary
}

// Mock Cassi instance
const mockUser = new User(); // Create a mock User
const mockConfigFile = "mock-config.json";
const mockRepoDir = "/mock/repo/dir";
const mockCassi = new Cassi(mockUser, mockConfigFile, mockRepoDir); // Create a mock Cassi instance

describe("Task", () => {
  let task: Task;

  beforeEach(() => {
    // Pass the mock Cassi instance to the Task constructor
    task = new Task(mockCassi);
  });

  test("should create an instance of Task", () => {
    expect(task).toBeInstanceOf(Task);
  });

  test("should have an empty subTasks array by default", () => {
    expect(task.subTasks).toBeInstanceOf(Array);
    expect(task.subTasks).toHaveLength(0);
  });

  test("should have null startedAt by default", () => {
    expect(task.startedAt).toBeNull();
  });

  test("should have null finishedAt by default", () => {
    expect(task.finishedAt).toBeNull();
  });

  test("should have null error by default", () => {
    expect(task.error).toBeNull();
  });

  test("should have null parentTask by default", () => {
    expect(task.parentTask).toBeNull();
  });

  test("should correctly assign parentTask when provided", () => {
    const parent = new Task(mockCassi);
    const childTask = new Task(mockCassi, parent);
    expect(childTask.parentTask).toBe(parent);
  });

  describe("initTask", () => {
    test("should exist and run without error", async () => {
      expect(task.initTask).toBeInstanceOf(Function);
      await expect(task.initTask()).resolves.toBeUndefined();
    });
  });

  describe("cleanupTask", () => {
    test("should exist and run without error", async () => {
      expect(task.cleanupTask).toBeInstanceOf(Function);
      await expect(task.cleanupTask()).resolves.toBeUndefined();
    });
  });

  describe("run", () => {
    test("should call initTask before running subtasks", async () => {
      const initTaskSpy = vi.spyOn(task, "initTask");
      const subTask1 = new Task(mockCassi); // Pass mock Cassi
      const subTaskRunSpy = vi.spyOn(subTask1, "run");
      task.subTasks.push(subTask1);

      await task.run();

      expect(initTaskSpy).toHaveBeenCalledOnce();
      // Ensure initTask is called before subTask.run
      // Vitest spies don't easily track cross-spy call order,
      // but the structure of the run method ensures this.
      // We can verify initTask was called before finishedAt is set.
      expect(initTaskSpy).toHaveBeenCalledBefore(subTaskRunSpy); // Check call order
    });

    test("should set startedAt and finishedAt dates", async () => {
      expect(task.startedAt).toBeNull();
      expect(task.finishedAt).toBeNull();
      await task.run();
      expect(task.startedAt).toBeInstanceOf(Date);
      expect(task.finishedAt).toBeInstanceOf(Date);
      // startedAt should be less than or equal to finishedAt
      expect(task.startedAt!.getTime()).toBeLessThanOrEqual(
        task.finishedAt!.getTime()
      );
    });

    test("should run subtasks sequentially after initTask", async () => {
      const initTaskSpy = vi.spyOn(task, "initTask");
      const subTask1 = new Task(mockCassi); // Pass mock Cassi
      const subTask2 = new Task(mockCassi); // Pass mock Cassi
      const runSpy1 = vi.spyOn(subTask1, "run");
      const runSpy2 = vi.spyOn(subTask2, "run");

      task.subTasks.push(subTask1, subTask2);

      await task.run();

      expect(initTaskSpy).toHaveBeenCalledOnce(); // Ensure initTask was called
      expect(runSpy1).toHaveBeenCalledOnce();
      expect(runSpy2).toHaveBeenCalledOnce();

      // Ensure initTask runs before subtasks, and subtasks run sequentially
      expect(initTaskSpy).toHaveBeenCalledBefore(runSpy1);
      expect(runSpy1).toHaveBeenCalledBefore(runSpy2);

      // We can check the timestamps if the mocks were more complex,
      // but checking call order with spies is sufficient here.
      // Vitest spies don't directly track call order easily across different spies,
      // but the await ensures sequential execution.
      // We can also check that the parent task's finishedAt is after subtasks' finishedAt.
      expect(subTask1.finishedAt).toBeInstanceOf(Date);
      expect(subTask2.finishedAt).toBeInstanceOf(Date);
      expect(task.finishedAt!.getTime()).toBeGreaterThanOrEqual(
        subTask1.finishedAt!.getTime()
      );
      expect(task.finishedAt!.getTime()).toBeGreaterThanOrEqual(
        subTask2.finishedAt!.getTime()
      );
    });

    test("should set error property if initTask throws", async () => {
      const testError = new Error("Init failed");
      vi.spyOn(task, "initTask").mockRejectedValue(testError);

      await task.run();

      expect(task.error).toBe(testError);
      expect(task.startedAt).toBeInstanceOf(Date);
      expect(task.finishedAt).toBeInstanceOf(Date); // finally block should still run
    });

    test("should set error property if a subtask throws", async () => {
      const testError = new Error("Subtask failed");
      const subTask1 = new Task(mockCassi); // Pass mock Cassi
      const subTask2 = new Task(mockCassi); // Pass mock Cassi
      const runSpy1 = vi.spyOn(subTask1, "run").mockRejectedValue(testError);
      const runSpy2 = vi.spyOn(subTask2, "run"); // This should not be called

      task.subTasks.push(subTask1, subTask2);

      await task.run();

      expect(task.error).toBe(testError);
      expect(runSpy1).toHaveBeenCalledOnce();
      expect(runSpy2).not.toHaveBeenCalled(); // Ensure second subtask doesn't run
      expect(task.startedAt).toBeInstanceOf(Date);
      expect(task.finishedAt).toBeInstanceOf(Date); // finally block should still run
      expect(subTask1.finishedAt).toBeNull(); // Subtask didn't finish successfully
    });

    test("should set error property if a subtask sets its error property", async () => {
      const testError = new Error("Subtask internal failure");
      const subTask1 = new Task(mockCassi); // Pass mock Cassi
      const subTask2 = new Task(mockCassi); // Pass mock Cassi
      // Mock run to set the error property instead of throwing
      const runSpy1 = vi.spyOn(subTask1, "run").mockImplementation(async () => {
        subTask1.startedAt = new Date();
        subTask1.error = testError; // Simulate failure within the subtask
        subTask1.finishedAt = new Date();
      });
      const runSpy2 = vi.spyOn(subTask2, "run"); // This should not be called

      task.subTasks.push(subTask1, subTask2);

      await task.run();

      expect(task.error).toBe(testError); // Parent task should capture the error
      expect(runSpy1).toHaveBeenCalledOnce();
      expect(runSpy2).not.toHaveBeenCalled(); // Ensure second subtask doesn't run
      expect(task.startedAt).toBeInstanceOf(Date);
      expect(task.finishedAt).toBeInstanceOf(Date); // finally block should still run
      expect(subTask1.error).toBe(testError);
      expect(subTask1.finishedAt).toBeInstanceOf(Date);
    });

    test("should handle non-Error objects thrown", async () => {
      const testErrorString = "Something went wrong";
      vi.spyOn(task, "initTask").mockRejectedValue(testErrorString);

      await task.run();

      expect(task.error).toBeInstanceOf(Error);
      expect(task.error?.message).toBe(testErrorString);
      expect(task.startedAt).toBeInstanceOf(Date);
      expect(task.finishedAt).toBeInstanceOf(Date);
    });

    test("should call cleanupTask in finally block on success", async () => {
      const cleanupTaskSpy = vi.spyOn(task, "cleanupTask");
      await task.run();
      expect(cleanupTaskSpy).toHaveBeenCalledOnce();
      expect(task.error).toBeNull(); // Ensure no error was set
    });

    test("should call cleanupTask in finally block even if initTask throws", async () => {
      const testError = new Error("Init failed");
      vi.spyOn(task, "initTask").mockRejectedValue(testError);
      const cleanupTaskSpy = vi.spyOn(task, "cleanupTask");

      await task.run();

      expect(task.error).toBe(testError);
      expect(cleanupTaskSpy).toHaveBeenCalledOnce();
    });

    test("should call cleanupTask in finally block even if a subtask throws", async () => {
      const testError = new Error("Subtask failed");
      const subTask1 = new Task(mockCassi);
      vi.spyOn(subTask1, "run").mockRejectedValue(testError);
      task.subTasks.push(subTask1);
      const cleanupTaskSpy = vi.spyOn(task, "cleanupTask");

      await task.run();

      expect(task.error).toBe(testError);
      expect(cleanupTaskSpy).toHaveBeenCalledOnce();
    });

    test("should log error if cleanupTask itself throws, but not overwrite original error", async () => {
      const initError = new Error("Init failed");
      const cleanupError = new Error("Cleanup failed");
      vi.spyOn(task, "initTask").mockRejectedValue(initError);
      const cleanupTaskSpy = vi
        .spyOn(task, "cleanupTask")
        .mockRejectedValue(cleanupError);
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {}); // Suppress console output for test

      await task.run();

      expect(task.error).toBe(initError); // Original error should be preserved
      expect(cleanupTaskSpy).toHaveBeenCalledOnce();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `[Task] Error during cleanup for Task: ${cleanupError.message}`
        )
      );

      consoleErrorSpy.mockRestore(); // Restore console.error
    });

    test("should log error if cleanupTask throws when run was successful", async () => {
      const cleanupError = new Error("Cleanup failed");
      const cleanupTaskSpy = vi
        .spyOn(task, "cleanupTask")
        .mockRejectedValue(cleanupError);
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {}); // Suppress console output for test

      await task.run();

      expect(task.error).toBeNull(); // No error during main execution
      expect(cleanupTaskSpy).toHaveBeenCalledOnce();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `[Task] Error during cleanup for Task: ${cleanupError.message}`
        )
      );

      consoleErrorSpy.mockRestore(); // Restore console.error
    });
  });

  describe("invoke", () => {
    test("should call cassi.tool.invoke with the correct arguments and return its result", async () => {
      const mockToolName = "fs";
      const mockMethodName = "readFile";
      const mockToolArgs: any[] = []; // Define toolArgs for the test
      const mockArgs = ["/path/to/file.txt"];
      const mockResult = "file content";

      // Mock cassi.tool.invoke
      const invokeSpy = vi
        .spyOn(mockCassi.tool, "invoke")
        .mockResolvedValue(mockResult);

      // Call the task's invoke method
      const result = await task.invoke(
        mockToolName,
        mockMethodName,
        mockToolArgs, // Pass toolArgs
        ...mockArgs
      );

      // Assertions
      expect(invokeSpy).toHaveBeenCalledOnce();
      expect(invokeSpy).toHaveBeenCalledWith(
        task, // Should pass the task instance itself
        mockToolName,
        mockMethodName,
        mockToolArgs, // Expect toolArgs
        ...mockArgs
      );
      expect(result).toBe(mockResult); // Should return the result from cassi.tool.invoke

      // Restore the spy
      invokeSpy.mockRestore();
    });

    test("should propagate errors from cassi.tool.invoke", async () => {
      const mockToolName = "fs";
      const mockMethodName = "writeFile";
      const mockToolArgs: any[] = ["someToolArg"]; // Define toolArgs for the test
      const mockArgs = ["/path/to/file.txt", "content"];
      const mockError = new Error("Failed to write file");

      // Mock cassi.tool.invoke to throw an error
      const invokeSpy = vi
        .spyOn(mockCassi.tool, "invoke")
        .mockRejectedValue(mockError);

      // Call the task's invoke method and expect it to reject
      await expect(
        task.invoke(mockToolName, mockMethodName, mockToolArgs, ...mockArgs) // Pass toolArgs
      ).rejects.toThrow(mockError);

      // Assertions
      expect(invokeSpy).toHaveBeenCalledOnce();
      expect(invokeSpy).toHaveBeenCalledWith(
        task,
        mockToolName,
        mockMethodName,
        mockToolArgs, // Expect toolArgs
        ...mockArgs
      );

      // Restore the spy
      invokeSpy.mockRestore();
    });
  });

  describe("newModel", () => {
    // Renamed describe block
    let newInstanceSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      // Spy on the newInstance method, casting to 'any' to resolve TS error
      newInstanceSpy = vi.spyOn(mockCassi.model, "newInstance" as any);
    });

    test("should call cassi.model.newInstance with the correct model class name", () => {
      const modelClassName = "MockModel";
      const mockModelInstance = new MockModel();
      newInstanceSpy.mockReturnValue(mockModelInstance); // Mock the return value

      task.newModel(modelClassName); // Use newModel (removed type argument)

      expect(newInstanceSpy).toHaveBeenCalledOnce();
      expect(newInstanceSpy).toHaveBeenCalledWith(modelClassName);
    });

    test("should return the model instance created by cassi.model.newInstance", () => {
      const modelClassName = "MockModel";
      const mockModelInstance = new MockModel();
      newInstanceSpy.mockReturnValue(mockModelInstance); // Mock the return value

      const result = task.newModel(modelClassName); // Use newModel (removed type argument)

      expect(result).toBeInstanceOf(MockModel); // This assertion should still work
      expect(result).toBe(mockModelInstance);
    });

    test("should throw an error if cassi.model.newInstance throws", () => {
      const modelClassName = "NonExistentModel";
      const testError = new Error(`Model class '${modelClassName}' not found.`);
      newInstanceSpy.mockImplementation(() => {
        throw testError; // Mock throwing an error
      });

      // Use MockModel which extends Models to satisfy the constraint
      expect(() => task.newModel(modelClassName)).toThrow(
        // Use newModel (removed type argument)
        testError
      );
      expect(newInstanceSpy).toHaveBeenCalledOnce();
      expect(newInstanceSpy).toHaveBeenCalledWith(modelClassName);
    });
  });
});
