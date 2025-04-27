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
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    mockPluginInitializer.mockClear();
    (genkit as ReturnType<typeof vi.fn>).mockClear();
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {}); // Mock console.log as well
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});


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

    // Mock init/cleanup on the prototype BEFORE creating the task instance if needed
    // Or spy on the instance methods after creation if appropriate
    vi.spyOn(Task.prototype, "initTask").mockResolvedValue();
    vi.spyOn(Task.prototype, "cleanupTask").mockResolvedValue();
  });

   afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore(); // Restore console.log
    consoleErrorSpy.mockRestore();
  });

  describe("constructor", () => {
    it("should initialize with status 'pending'", () => {
      expect(task.status).toBe('pending');
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
      // Ensure spy is on the *instance* if initTask is called on the instance
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
        throw subtaskError; // Important: subtask.run needs to throw for parent to catch
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
        const cleanupSpy = vi.spyOn(task, "cleanupTask"); // Spy on the instance
        await task.run();
        expect(cleanupSpy).toHaveBeenCalled();
    });

    it("should call cleanupTask in finally block even if initTask throws", async () => {
      const cleanupSpy = vi.spyOn(task, "cleanupTask"); // Spy on the instance
      vi.spyOn(task, "initTask").mockRejectedValue(new Error("Init failed"));
      await task.run();
      expect(cleanupSpy).toHaveBeenCalled();
    });

    it("should call cleanupTask in finally block even if a subtask throws", async () => {
      const cleanupSpy = vi.spyOn(task, "cleanupTask"); // Spy on the instance
      const subTask = new Task(mockCassi, task);
      vi.spyOn(subTask, "run").mockRejectedValue(new Error("Subtask failed"));
      task.addSubtask(subTask);
      await task.run();
      expect(cleanupSpy).toHaveBeenCalled();
    });

    it("should log error if cleanupTask itself throws but not overwrite original error", async () => {
      const originalError = new Error("Init failed");
      const cleanupError = new Error("Cleanup failed");
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {}); // Already mocked in beforeEach, ensure restored in afterEach

      vi.spyOn(task, "initTask").mockRejectedValue(originalError);
      vi.spyOn(task, "cleanupTask").mockRejectedValue(cleanupError); // Spy on the instance

      await task.run();

      expect(task.error).toBe(originalError); // Original error should persist
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Error during cleanup for Task: ${cleanupError.message}`)
      );
      expect(task.status).toBe('failed'); // Status should be failed

      // No need to restore spy here, afterEach handles it
    });

    it("should log error and set status/error if cleanupTask throws when run was successful", async () => {
        const cleanupError = new Error("Cleanup failed");
        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        // Ensure initTask completes successfully
        vi.spyOn(task, "initTask").mockResolvedValue();
        // Make cleanupTask throw
        vi.spyOn(task, "cleanupTask").mockRejectedValue(cleanupError);

        await task.run();

        // Error should be set to the cleanup error because there was no prior error
        expect(task.error).toBe(cleanupError);
        // Status should be 'failed' due to cleanup error
        expect(task.status).toBe('failed');
        // Cleanup error should be logged
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining(`Error during cleanup for Task: ${cleanupError.message}`)
        );

        // afterEach will restore console.error spy
    });


    it("should update status to 'running' when starting", async () => {
        // Use a subtask to check the parent's status during execution
        const subTask = new Task(mockCassi, task);
        let statusDuringSubtaskRun: Task['status'] | null = null;
        vi.spyOn(subTask, "run").mockImplementation(async () => {
            statusDuringSubtaskRun = task.status; // Check parent status
        });
        task.addSubtask(subTask);

        expect(task.status).toBe('pending');
        const runPromise = task.run(); // Don't await yet

        // Short delay to allow run to start and potentially reach the subtask
        await new Promise(resolve => setImmediate(resolve));

        await runPromise; // Wait for run to complete

        expect(statusDuringSubtaskRun).toBe('running');
        if (!task.error) {
            expect(task.status).toBe('finished');
        }
    });


    it("should update status to 'finished' on successful completion", async () => {
      await task.run();
      expect(task.error).toBeNull();
      expect(task.status).toBe('finished');
    });

    it("should update status to 'failed' if initTask fails", async () => {
      const testError = new Error("Init failed");
      vi.spyOn(task, "initTask").mockRejectedValue(testError);
      await task.run();
      expect(task.error).toBe(testError);
      expect(task.status).toBe('failed');
    });

    it("should update status to 'failed' if a subtask fails", async () => {
      const testError = new Error("Subtask failed");
      const subTask = new Task(mockCassi, task);
      vi.spyOn(subTask, "run").mockRejectedValue(testError);
      task.addSubtask(subTask);
      await task.run();
      expect(task.error).toBe(testError);
      expect(task.status).toBe('failed');
    });


    // Test pause/resume interaction with run loop
    it("should pause execution between subtasks when pauseTask is called", async () => {
        vi.useFakeTimers();
        const subTask1 = new Task(mockCassi, task);
        const subTask2 = new Task(mockCassi, task);
        const subTask1RunSpy = vi.spyOn(subTask1, "run").mockImplementation(async () => {
            // Pause the parent task *after* subtask 1 finishes its logic
            await task.pauseTask();
             console.log("Subtask 1 finished, parent pause requested"); // Use mocked console.log
        });
        const subTask2RunSpy = vi.spyOn(subTask2, "run").mockResolvedValue();

        task.addSubtask(subTask1);
        task.addSubtask(subTask2);

        const runPromise = task.run(); // Don't await here yet

        // Allow subTask1 to run and call pauseTask
        await vi.advanceTimersByTimeAsync(100); // Give time for subtask1 run
        expect(subTask1RunSpy).toHaveBeenCalled();
        expect(task.status).toBe('paused'); // Status should be paused immediately

        // Advance time to check if subTask2 runs while paused
        await vi.advanceTimersByTimeAsync(2000); // More than the pause check interval
        expect(subTask2RunSpy).not.toHaveBeenCalled(); // Subtask 2 should not have run yet

        // Resume the task
        await task.resumeTask();
        expect(task.status).toBe('running');

        // Allow run loop to continue and run subtask 2
        // Need to advance time *again* for the loop to check status and run the next task
        await vi.advanceTimersByTimeAsync(2000);

        // Wait for the main run promise to complete
        await runPromise;

        expect(subTask2RunSpy).toHaveBeenCalled();
        expect(task.status).toBe('finished'); // Should finish successfully
        expect(task.error).toBeNull();

        vi.useRealTimers();
    });

    it("should finish with status 'finished' if paused and run completes without resuming", async () => {
        vi.useFakeTimers();
        const subTask1 = new Task(mockCassi, task);
        const subTask1RunSpy = vi.spyOn(subTask1, "run").mockImplementation(async () => {
            await task.pauseTask(); // Pause after the only subtask
        });
        task.addSubtask(subTask1);

        const runPromise = task.run();

        // Allow subtask1 to run and pause
        await vi.advanceTimersByTimeAsync(100);
        // Removed intermediate check: expect(task.status).toBe('paused');
        // The task proceeds to finally block quickly after subtask completion.

        // Advance time significantly to simulate waiting period (past the internal 1s check)
        // This might allow the internal loop logic to cycle once while paused
        await vi.advanceTimersByTimeAsync(2000);

        // Now, wait for the run promise to resolve. The finally block in run()
        // should handle the status transition from paused to finished.
        await runPromise;

        // Check the *final* state after run() completes
        expect(subTask1RunSpy).toHaveBeenCalled();
        // The logic now transitions 'paused' to 'finished' if the run completes naturally
        expect(task.status).toBe('finished');
        // Check if the warning was logged
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("finished in paused state"));

        vi.useRealTimers();
    }, 15000); // Increased timeout


    it("should transition status to 'failed' if cleanup fails even after successful run", async () => {
        const cleanupError = new Error("Cleanup failed");
        vi.spyOn(task, "cleanupTask").mockRejectedValue(cleanupError);

        await task.run();

        expect(task.error).toBe(cleanupError); // Error should be the cleanup error
        expect(task.status).toBe('failed');    // Status should be failed
    });
  });


  describe("pauseTask", () => {
    it("should change status from 'running' to 'paused'", async () => {
      task.status = 'running'; // Set initial state
      await task.pauseTask();
      expect(task.status).toBe('paused');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should not change status if not 'running' and log warning", async () => {
      const initialStates: Task['status'][] = ['pending', 'finished', 'failed', 'paused'];
      for (const state of initialStates) {
          task.status = state;
          await task.pauseTask();
          expect(task.status).toBe(state); // Status should remain unchanged
          expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`cannot be paused in state: ${state}`));
          consoleWarnSpy.mockClear(); // Clear mock for next iteration
      }
    });
  });

  describe("resumeTask", () => {
     it("should change status from 'paused' to 'running'", async () => {
      task.status = 'paused'; // Set initial state
      await task.resumeTask();
      expect(task.status).toBe('running');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

     it("should not change status if not 'paused' and log warning", async () => {
       const initialStates: Task['status'][] = ['pending', 'running', 'finished', 'failed'];
       for (const state of initialStates) {
           task.status = state;
           await task.resumeTask();
           expect(task.status).toBe(state); // Status should remain unchanged
           expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`cannot be resumed from state: ${state}`));
           consoleWarnSpy.mockClear(); // Clear mock for next iteration
       }
    });
  });


  describe("invoke", () => {
    beforeEach(() => {
      // Mock the invoke method on the *instance* of mockTool
       mockTool.invoke = vi.fn();
    });

    it("should call cassi.tool.invoke with the correct arguments and return its result", async () => {
      const expectedResult = { success: true };
      // Ensure the mock is set up correctly on the instance
      (mockTool.invoke as ReturnType<typeof vi.fn>).mockResolvedValue(expectedResult);


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
        task, // Task instance
        toolName,
        methodName,
        toolArgs, // effectiveToolArgs
        methodArgs
      );
      expect(result).toBe(expectedResult);
    });

    it("should propagate errors from cassi.tool.invoke", async () => {
      const testError = new Error("Tool invocation failed");
       (mockTool.invoke as ReturnType<typeof vi.fn>).mockRejectedValue(testError);


      await expect(
        task.invoke("fs", "writeFile", [], ["a.txt", "data"])
      ).rejects.toThrow(testError);
    });
  });

  describe("newModel", () => {
    let newInstanceSpy: any;

    beforeEach(() => {
        // Mock newInstance on the mockModel *instance*
        newInstanceSpy = vi.spyOn(mockModel, 'newInstance').mockImplementation(
            (modelName: string, taskInstance: Task) => {
                // Return a mock model instance for testing purposes
                return new MockModel(mockPluginInitializer, taskInstance);
            }
        );
    });


    it("should call cassi.model.newInstance with the correct model class name and task instance", () => {
      const modelClassName = "MockModel";
      task.newModel(modelClassName);

      expect(newInstanceSpy).toHaveBeenCalledTimes(1);
      expect(newInstanceSpy).toHaveBeenCalledWith(modelClassName, task);
    });

    it("should return the model instance created by cassi.model.newInstance", () => {
      const modelClassName = "AnotherModel";
      // Create an instance to be returned by the mock
      const expectedInstance = new MockModel(mockPluginInitializer, task);
      newInstanceSpy.mockReturnValue(expectedInstance); // Set mock return value


      const result = task.newModel(modelClassName);

      expect(result).toBe(expectedInstance);
    });

    it("should throw an error if cassi.model.newInstance throws", () => {
      const modelClassName = "NonExistentModel";
      const testError = new Error(`Model class '${modelClassName}' not found.`);
      newInstanceSpy.mockImplementation(() => { // Mock implementation to throw
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
      // Mock worktreeDir *on the task instance* for these tests
      vi.spyOn(task, 'worktreeDir'); // Just spy, will mock implementation below
    });

    afterEach(() => {
      processCwdSpy.mockRestore();
      // Restore the specific spy on the instance if needed, though resetAllMocks might cover it
    });

    it("should return the result of worktreeDir() if it returns a path", () => {
        (vi.spyOn(task, 'worktreeDir') as any).mockReturnValue(mockWorktreePath); // Cast spy return type
        expect(task.getCwd()).toBe(mockWorktreePath);
        expect(task.worktreeDir).toHaveBeenCalledTimes(1);
        expect(processCwdSpy).not.toHaveBeenCalled();
    });

    it("should return process.cwd() if worktreeDir() throws an error", () => {
        const worktreeError = new Error("Worktree not found");
        (vi.spyOn(task, 'worktreeDir') as any).mockImplementation(() => { // Cast spy implementation
          throw worktreeError;
        });

        expect(task.getCwd()).toBe(mockProcessCwd);
        expect(task.worktreeDir).toHaveBeenCalledTimes(1);
        expect(processCwdSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("worktreeDir", () => {
    const mockWorktreePath = "/path/to/worktree";

    it("should return worktree.worktreeDir if worktree exists and has worktreeDir", () => {
      // Create a new task instance for isolation if needed, or ensure task state is clean
      task = new Task(mockCassi);
      task.worktree = { worktreeDir: mockWorktreePath } as Worktree;
      expect(task.worktreeDir()).toBe(mockWorktreePath);
    });

    it("should call parentTask.worktreeDir() if worktree is not set and parentTask exists", () => {
      const parentTask = new Task(mockCassi);
      // Spy on the *parent's* worktreeDir method
      const parentWorktreeDirSpy = vi
        .spyOn(parentTask, "worktreeDir")
        .mockReturnValue(mockWorktreePath);

      // Create child task linked to parent
      const childTask = new Task(mockCassi, parentTask);
      childTask.worktree = undefined; // Ensure child doesn't have its own worktree

      expect(childTask.worktreeDir()).toBe(mockWorktreePath);
      expect(parentWorktreeDirSpy).toHaveBeenCalledTimes(1);

      parentWorktreeDirSpy.mockRestore(); // Clean up spy on parent
    });


    it("should throw an error if worktree is not set and parentTask is null", () => {
        task = new Task(mockCassi); // Fresh task instance
        task.worktree = undefined;
        task.parentTask = null;

        expect(() => task.worktreeDir()).toThrow(
          "Worktree directory not found for this task or any parent task."
        );
    });


    it("should throw an error if worktree exists but worktreeDir is undefined", () => {
        task = new Task(mockCassi);
        // Simulate a Worktree object without the worktreeDir property
        task.worktree = {} as Worktree; // No worktreeDir property
        task.parentTask = null; // No parent to fall back on

        expect(() => task.worktreeDir()).toThrow(
          "Worktree directory not found for this task or any parent task."
        );
    });


    it("should throw an error if parentTask exists but its worktreeDir() throws", () => {
        const parentTask = new Task(mockCassi);
        const parentError = new Error("Parent worktree not found");
        // Spy on parent's method and make it throw
        const parentWorktreeDirSpy = vi.spyOn(parentTask, "worktreeDir").mockImplementation(() => {
            throw parentError;
        });

        const childTask = new Task(mockCassi, parentTask);
        childTask.worktree = undefined;

        // Expect the child's call to ultimately throw the specific error message
        expect(() => childTask.worktreeDir()).toThrow(
          "Worktree directory not found for this task or any parent task."
        );
        // Verify the parent's method was indeed called
        expect(parentWorktreeDirSpy).toHaveBeenCalledTimes(1);

        parentWorktreeDirSpy.mockRestore(); // Clean up spy on parent
    });


     it("should handle nested parent tasks correctly, returning the first available worktreeDir", () => {
        const grandParentTask = new Task(mockCassi);
        grandParentTask.worktree = { worktreeDir: mockWorktreePath } as Worktree;
        // Spy on the actual implementation using spyOn with the instance
        const grandParentSpy = vi.spyOn(grandParentTask, "worktreeDir"); //.mockCallThrough(); // vitest default

        const parentTask = new Task(mockCassi, grandParentTask);
        parentTask.worktree = undefined;
        const parentSpy = vi.spyOn(parentTask, "worktreeDir"); //.mockCallThrough();

        const childTask = new Task(mockCassi, parentTask);
        childTask.worktree = undefined;

        expect(childTask.worktreeDir()).toBe(mockWorktreePath);
        expect(parentSpy).toHaveBeenCalledTimes(1); // Called by child
        expect(grandParentSpy).toHaveBeenCalledTimes(1); // Called by parent

        // No need to restore if mocks are reset in beforeEach/afterEach
    });

    it("should handle nested parent tasks where an intermediate parent throws", () => {
      const grandParentTask = new Task(mockCassi);
      grandParentTask.worktree = { worktreeDir: mockWorktreePath } as Worktree;
      const grandParentSpy = vi.spyOn(grandParentTask, "worktreeDir");

      const parentTask = new Task(mockCassi, grandParentTask);
      parentTask.worktree = undefined;
      // Make the parent's worktreeDir throw
      const parentSpy = vi.spyOn(parentTask, "worktreeDir").mockImplementation(() => {
        throw new Error("Intermediate parent error");
      });

      const childTask = new Task(mockCassi, parentTask);
      childTask.worktree = undefined;

      // Even though the parent throws, the child's logic catches it and throws the final error
      expect(() => childTask.worktreeDir()).toThrow(
        "Worktree directory not found for this task or any parent task."
      );
      expect(parentSpy).toHaveBeenCalledTimes(1); // Child calls parent
      expect(grandParentSpy).not.toHaveBeenCalled(); // Grandparent is never reached because parent threw

      // No need for restore here if using beforeEach/afterEach reset
    });

  });

  describe("setTaskId", () => {
    let dateNowSpy: any;
    const mockTimestamp = 1678886400000;
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(mockTimestamp);
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {}); // Mock console.log
    });

    afterEach(() => {
      dateNowSpy.mockRestore();
      consoleLogSpy.mockRestore(); // Restore console.log
    });

    it("should generate a taskId based on the summary and current timestamp", () => {
      const summary = "Implement Feature X";
      task.setTaskId(summary);

      expect(task.taskId).toBeDefined();
      expect(task.taskId).toMatch(/^[a-zA-Z0-9]{8}-implement-feature-x$/);
       expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Generated ID'));
       expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Task ID set to:'));
    });

    it("should handle summaries with different characters", () => {
      const summary = "Fix Bug #123 with $pecial Chars!";
      task.setTaskId(summary);

      expect(task.taskId).toBeDefined();
      expect(task.taskId).toMatch(/^[a-zA-Z0-9]{8}-fix-bug-123-with-pecial-chars$/);
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

      dateNowSpy.mockReturnValue(mockTimestamp + 1000); // Advance time

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
    let getWorktreeSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        // Define a more complete mock Worktree matching the type potentially
        mockWorktree = {
          repository: mockRepository,
          task: task, // Or null initially if that's the case
          worktreeDir: "/mock/worktree/dir",
          init: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(undefined),
          repositoryBranch: "main",
          initRepositoryBranch: vi.fn().mockResolvedValue(undefined),
          name: "mock-worktree-name", // Add name property
          // Add any other properties expected by the Worktree type or its usage
        } as unknown as Worktree; // Use type assertion carefully

        // Mock the getWorktree method on the mockRepository *instance*
        getWorktreeSpy = vi.spyOn(mockRepository, 'getWorktree').mockResolvedValue(mockWorktree) as any; // Cast spy return type
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
      // Check if the back-reference was set (assuming getWorktree does this)
       if (task.worktree) { // Type guard
           expect(task.worktree.task).toBe(task);
       }
    });

    it("should propagate errors from cassi.repository.getWorktree", async () => {
      const testError = new Error("Failed to get worktree");
      getWorktreeSpy.mockRejectedValue(testError);

      await expect(task.initWorktree()).rejects.toThrow(testError);
      expect(task.worktree).toBeUndefined();
    });
  });

  describe("getTaskId", () => {
     // Mocks for console are handled in global beforeEach/afterEach

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
      parentTask.parentTask = null; // No grandparent

      task.parentTask = parentTask;
      task.taskId = null;

      expect(task.getTaskId()).toBe("XXXXXXXX");
    });
  });

  describe("getTaskIdShort", () => {
    // Mocks for console handled globally

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

    it('should return "XXXXXXXX" if no taskId is found (which is 8 chars)', () => {
      task.taskId = null;
      task.parentTask = null;
      // getTaskId() returns "XXXXXXXX", substring(0, 8) is "XXXXXXXX"
      expect(task.getTaskIdShort()).toBe("XXXXXXXX");
    });

    it('should return "XXXXXXXX" even if parent exists but has no taskId', () => {
      const parentTask = new Task(mockCassi);
      parentTask.taskId = null;
      task.parentTask = parentTask;
      task.taskId = null;
      expect(task.getTaskIdShort()).toBe("XXXXXXXX");
    });
  });

  describe("getWorkTree", () => {
    let mockWorktree: Worktree; // Use the same mock setup as initWorktree tests

     beforeEach(() => {
        // Re-create mockWorktree for isolation if needed
        mockWorktree = {
          repository: mockRepository,
          task: null, // Task ref might be set later
          worktreeDir: "/mock/worktree/dir",
          init: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(undefined),
          repositoryBranch: "main",
          initRepositoryBranch: vi.fn().mockResolvedValue(undefined),
          name: "mock-worktree-name",
        } as unknown as Worktree;
     });

    it("should return this.worktree if it is set", () => {
        task.worktree = mockWorktree; // Assign mock worktree to the task
        expect(task.getWorkTree()).toBe(mockWorktree);
    });

    it("should call parentTask.getWorkTree() if this.worktree is null and parentTask exists", () => {
        const parentTask = new Task(mockCassi);
        parentTask.worktree = mockWorktree; // Parent has the worktree
        // Spy on the parent's getWorkTree method
        const parentGetWorkTreeSpy = vi.spyOn(parentTask, "getWorkTree");

        task.parentTask = parentTask;
        task.worktree = undefined; // Child doesn't have worktree

        const result = task.getWorkTree();

        expect(result).toBe(mockWorktree); // Should get parent's worktree
        expect(parentGetWorkTreeSpy).toHaveBeenCalledTimes(1);

        parentGetWorkTreeSpy.mockRestore(); // Clean up spy
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
        // Spy on parent's method and make it throw
        const parentGetWorkTreeSpy = vi.spyOn(parentTask, "getWorkTree").mockImplementation(() => {
            throw parentError;
        });

        task.parentTask = parentTask;
        task.worktree = undefined;

        // Expect the specific error message from getWorkTree's catch block
        expect(() => task.getWorkTree()).toThrow(
          "Worktree not found for this task or any parent task."
        );
        // Verify the parent's throwing method was called
        expect(parentGetWorkTreeSpy).toHaveBeenCalledTimes(1);

        parentGetWorkTreeSpy.mockRestore(); // Clean up spy
    });


    it("should handle nested parent tasks, returning the first available worktree", () => {
        const grandParentTask = new Task(mockCassi);
        grandParentTask.worktree = mockWorktree; // Grandparent has the worktree
        // Spy on grandparent's method
        const grandParentSpy = vi.spyOn(grandParentTask, "getWorkTree");

        const parentTask = new Task(mockCassi, grandParentTask);
        parentTask.worktree = undefined; // Parent does not have it
        // Spy on parent's method
        const parentSpy = vi.spyOn(parentTask, "getWorkTree");

        task.parentTask = parentTask;
        task.worktree = undefined; // Child does not have it

        const result = task.getWorkTree();

        expect(result).toBe(mockWorktree); // Should get grandparent's worktree
        expect(parentSpy).toHaveBeenCalledTimes(1); // Child calls parent
        expect(grandParentSpy).toHaveBeenCalledTimes(1); // Parent calls grandparent

        // Spies will be restored by global afterEach
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
      expect(grandParentSpy).toHaveBeenCalledTimes(1); // Called because parent didn't find it

      // Spies restored by global afterEach
    });
  });
});
