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
  });

  it("should construct with an explicit worktreeDir if provided", () => {
    const repositoryDir = "/path/to/repo";
    const taskId = "test-task-id";
    const explicitWorktreeDir = "/path/to/explicit/worktree";
    const mockUser = {} as User;
    const mockRepository = { repositoryDir } as Repository;
    const mockTask = { taskId } as Task;

    const worktree = new Worktree(
      mockRepository,
      mockTask,
      explicitWorktreeDir
    );

    expect(worktree.worktreeDir).toBe(explicitWorktreeDir);
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
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      const mockUser = {} as User;
      mockRepository = { repositoryDir } as Repository;
      mockTask = {
        taskId: taskId,
        invoke: vi.fn().mockResolvedValue({ stdout: "", stderr: "" }), // Default mock
        getCwd: vi.fn().mockReturnValue(cwd),
      } as unknown as Task;

      worktree = new Worktree(mockRepository, mockTask);

      consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Mock specific invocations
      (mockTask.invoke as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ stdout: "", stderr: "" }) // git addWorktree
        .mockResolvedValueOnce({ stdout: "", stderr: "" }) // console exec npm install
        .mockResolvedValueOnce({
          current: "main", // Provide the 'current' property
          stdout: "On branch main\nYour branch is up to date...",
          stderr: "",
        }); // git status
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it("should call invoke with correct arguments for git addWorktree, npm install, and git status", async () => {
      await worktree.init();

      expect(mockTask.invoke).toHaveBeenCalledTimes(3);
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
      expect(mockTask.invoke).toHaveBeenNthCalledWith(
        3,
        "git",
        "status",
        [repositoryDir],
        []
      );
    });

    it("should set the repositoryBranch property based on git status output", async () => {
      await worktree.init();
      expect(worktree.repositoryBranch).toBe("main");
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Repository branch set to: main"
      );
    });

    it("should throw an error if git status result is missing the 'current' property", async () => {
      // Reset mocks for this specific case
      vi.resetAllMocks();
      // Restore console spies as resetAllMocks clears them
      consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      mockTask.invoke = vi
        .fn()
        .mockResolvedValueOnce({ stdout: "", stderr: "" }) // git addWorktree
        .mockResolvedValueOnce({ stdout: "", stderr: "" }) // console exec npm install
        .mockResolvedValueOnce({
          stdout: "Missing current property",
          stderr: "",
        }); // git status (missing 'current')

      await expect(worktree.init()).rejects.toThrow(
        "Could not determine repository branch from git status result."
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

  describe("initRepositoryBranch", () => {
    let mockRepository: Repository;
    let mockTask: Task;
    let worktree: Worktree;
    const repositoryDir = "/test/repo";
    const taskId = "init-branch-test-task";
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      const mockUser = {} as User;
      mockRepository = { repositoryDir } as Repository;
      mockTask = {
        taskId: taskId,
        invoke: vi.fn(),
        getCwd: vi.fn(),
      } as unknown as Task;

      worktree = new Worktree(mockRepository, mockTask);

      consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks(); // Use restoreAllMocks for cleaner state between tests
    });

    it("should call invoke with correct arguments for git status", async () => {
      (mockTask.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        current: "feature-branch",
        stdout: "On branch feature-branch...",
        stderr: "",
      });

      await worktree.initRepositoryBranch();

      expect(mockTask.invoke).toHaveBeenCalledTimes(1);
      expect(mockTask.invoke).toHaveBeenCalledWith(
        "git",
        "status",
        [repositoryDir],
        []
      );
    });

    it("should set the repositoryBranch property based on git status output", async () => {
      const expectedBranch = "feature-branch";
      (mockTask.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        current: expectedBranch,
        stdout: `On branch ${expectedBranch}...`,
        stderr: "",
      });

      await worktree.initRepositoryBranch();

      expect(worktree.repositoryBranch).toBe(expectedBranch);
    });

    it("should throw an error if git status result is null", async () => {
      (mockTask.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      await expect(worktree.initRepositoryBranch()).rejects.toThrow(
        "Could not determine repository branch from git status result."
      );
    });

    it("should throw an error if git status result is missing the 'current' property", async () => {
      (mockTask.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        stdout: "Missing current property",
        stderr: "",
      }); // Missing 'current'

      await expect(worktree.initRepositoryBranch()).rejects.toThrow(
        "Could not determine repository branch from git status result."
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

    beforeEach(() => {
      const mockUser = {} as User;
      mockRepository = {
        repositoryDir,
      } as Repository;
      mockTask = {
        taskId: taskId,
        invoke: vi.fn().mockResolvedValue({ stdout: "", stderr: "" }), // Mock invoke
        getCwd: vi.fn(),
      } as unknown as Task;

      worktree = new Worktree(mockRepository, mockTask);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should call task.invoke with correct arguments for git remWorkTree", async () => {
      await worktree.delete();

      expect(mockTask.invoke).toHaveBeenCalledTimes(1);
      expect(mockTask.invoke).toHaveBeenCalledWith(
        "git",
        "remWorkTree",
        [],
        [worktreeDir]
      );
    });

    it("should still complete if task.invoke throws an error (errors handled by invoke)", async () => {
      const testError = new Error("Failed to remove worktree via invoke");
      (mockTask.invoke as ReturnType<typeof vi.fn>).mockRejectedValue(
        testError
      );

      // Expect the promise to reject because invoke rejects
      await expect(worktree.delete()).rejects.toThrow(testError);

      expect(mockTask.invoke).toHaveBeenCalledTimes(1);
      expect(mockTask.invoke).toHaveBeenCalledWith(
        "git",
        "remWorkTree",
        [],
        [worktreeDir]
      );
    });
  });
});
