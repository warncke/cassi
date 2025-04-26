import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "path";
import { Worktree } from "./Worktree.js";
import { Task } from "../task/Task.js";
import { Repository } from "./Repository.js";
import { User } from "../user/User.js"; // Assuming User is needed for Repository mock

describe("Worktree", () => {
  it("should construct with Repository and Task, setting properties correctly", () => {
    const repositoryDir = "/path/to/repo";
    const taskId = "test-task-id";
    // Mock Repository and Task
    const mockUser = {} as User; // Minimal mock for User if needed by Repository
    const mockRepository = { repositoryDir } as Repository;
    const mockTask = { taskId } as Task;

    const worktree = new Worktree(mockRepository, mockTask);

    expect(worktree).toBeInstanceOf(Worktree);
    expect(worktree.repository).toBe(mockRepository);
    expect(worktree.task).toBe(mockTask);
    expect(worktree.worktreeDir).toBe(
      path.join(repositoryDir, ".cassi", "worktrees", taskId)
    );
    // The Worktree constructor no longer sets task.worktreeDir
  });

  it("should throw an error during construction if taskId is null", () => {
    const repositoryDir = "/path/to/repo";
    const mockUser = {} as User;
    const mockRepository = { repositoryDir } as Repository;
    const mockTask = { taskId: null } as Task;

    expect(() => new Worktree(mockRepository, mockTask)).toThrow(
      "Task ID cannot be null when creating a Worktree."
    );
  });

  describe("init", () => {
    let mockRepository: Repository; // No need for remWorktree mock here
    let mockTask: Task;
    let worktree: Worktree;
    const repositoryDir = "/test/repo";
    const taskId = "init-test-task";
    const worktreeDir = path.join(repositoryDir, ".cassi", "worktrees", taskId);
    const cwd = "/test/repo/.cassi/worktrees/init-test-task";

    beforeEach(() => {
      const mockUser = {} as User;
      mockRepository = { repositoryDir } as Repository;
      mockTask = {
        taskId: taskId,
        invoke: vi.fn().mockResolvedValue(""),
        getCwd: vi.fn().mockReturnValue(cwd),
        // worktreeDir property removed from Task
      } as unknown as Task;

      worktree = new Worktree(mockRepository, mockTask);
    });

    it("should call invoke with correct arguments for git addWorktree and npm install", async () => {
      await worktree.init();

      expect(mockTask.invoke).toHaveBeenCalledTimes(2);
      expect(mockTask.invoke).toHaveBeenNthCalledWith(
        1,
        "git",
        "addWorktree",
        [repositoryDir],
        [worktreeDir, taskId]
      );
      expect(mockTask.invoke).toHaveBeenNthCalledWith(
        2,
        "console",
        "exec",
        [cwd],
        ["npm install"]
      );
    });

    it("should throw an error if taskId is null when init is called", async () => {
      // Override taskId for this specific test case
      mockTask.taskId = null;
      // Re-create worktree with null taskId for init check (constructor check is separate)
      const taskWithNullId = {
        taskId: null,
        invoke: vi.fn(),
        getCwd: vi.fn(),
        // worktreeDir property removed from Task
      } as unknown as Task;
      // Need a valid repo mock
      const repo = { repositoryDir } as Repository;
      // Construction should still fail if we tried here, but we test init directly
      // We need a way to create a Worktree instance bypassing the constructor check
      // or modify the instance after creation. Let's modify the instance.
      const validTaskForConstruction = { taskId: "temp-id" } as Task;
      const tempWorktree = new Worktree(repo, validTaskForConstruction);
      // Now assign the task with null ID to test init
      (tempWorktree as any).task = taskWithNullId; // Use 'as any' to bypass type checks for testing

      await expect(tempWorktree.init()).rejects.toThrow(
        "Task ID cannot be null when initializing a Worktree."
      );
    });
  });

  describe("delete", () => {
    let mockRepository: Repository;
    let mockTask: Task;
    let worktree: Worktree;
    const repositoryDir = "/test/repo";
    const taskId = "delete-test-task";
    const worktreeDir = path.join(repositoryDir, ".cassi", "worktrees", taskId);
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      const mockUser = {} as User;
      // Create a partial mock for Repository focusing on delete's needs
      mockRepository = {
        repositoryDir,
        remWorktree: vi.fn(), // Initialize remWorktree as a mock function
      } as unknown as Repository; // Assert as Repository, acknowledging it's partial
      mockTask = {
        taskId: taskId,
        getCwd: vi.fn(),
      } as unknown as Task;

      worktree = new Worktree(mockRepository, mockTask);

      // Spy on console methods
      consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      // Restore console spies
      consoleLogSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it("should call repository.remWorktree with the correct worktree directory", async () => {
      // Configure mock for this test case
      (
        mockRepository.remWorktree as ReturnType<typeof vi.fn>
      ).mockResolvedValue(undefined);

      await worktree.delete();

      expect(mockRepository.remWorktree).toHaveBeenCalledTimes(1);
      expect(mockRepository.remWorktree).toHaveBeenCalledWith(worktreeDir);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        `[Worktree] Deleting worktree at ${worktreeDir}` // Updated log message
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        `[Worktree] Finished deleting worktree at ${worktreeDir}` // Updated log message
      );
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should log a warning if repository.remWorktree throws an error", async () => {
      const testError = new Error("Failed to remove worktree");
      // Configure mock for this test case
      (
        mockRepository.remWorktree as ReturnType<typeof vi.fn>
      ).mockRejectedValue(testError);

      await worktree.delete();

      expect(mockRepository.remWorktree).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        `[Worktree] Deleting worktree at ${worktreeDir}` // Updated log message
      );
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `[Worktree] Failed to remove worktree directory ${worktreeDir}:`, // Updated log message
        testError
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        `[Worktree] Finished deleting worktree at ${worktreeDir}` // Updated log message
      );
    });
  });
});
