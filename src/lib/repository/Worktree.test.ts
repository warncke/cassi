import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "path";
import { Worktree } from "./Worktree.js";
import { Task } from "../task/Task.js";
import { Repository } from "./Repository.js";
import { User } from "../user/User.js";
import { FileInfo } from "../file-info/FileInfo.js";

vi.mock("../file-info/FileInfo.js");

describe("Worktree", () => {
  it("should construct with Repository and Task, setting properties correctly", () => {
    const repositoryDir = "/path/to/repo";
    const taskId = "test-task-id";
    const mockUser = {} as User;
    const mockRepositoryFileInfo = new FileInfo(repositoryDir);
    const mockRepository = {
      repositoryDir,
      fileInfo: mockRepositoryFileInfo,
    } as Repository;
    const mockTask = { taskId } as Task;

    const worktree = new Worktree(
      mockRepository,
      mockTask,
      mockRepositoryFileInfo
    );

    expect(worktree).toBeInstanceOf(Worktree);
    expect(worktree.repository).toBe(mockRepository);
    expect(FileInfo).toHaveBeenCalledWith(
      repositoryDir,
      expect.any(String),
      mockRepositoryFileInfo
    );
    expect(worktree.task).toBe(mockTask);
    expect(worktree.worktreeDir).toBe(
      path.join(repositoryDir, ".cassi", "worktrees", taskId)
    );
  });

  it("should throw an error during construction if taskId is null", () => {
    const repositoryDir = "/path/to/repo";
    const mockUser = {} as User;
    const mockRepositoryFileInfo = new FileInfo(repositoryDir);
    const mockRepository = {
      repositoryDir,
      fileInfo: mockRepositoryFileInfo,
    } as Repository;
    const mockTask = { taskId: null } as Task;

    expect(
      () => new Worktree(mockRepository, mockTask, mockRepositoryFileInfo)
    ).toThrow("Task ID cannot be null when creating a Worktree.");
  });

  describe("init", () => {
    let mockRepository: Repository;
    let mockTask: Task;
    let worktree: Worktree;
    let mockRepositoryFileInfo: FileInfo;
    const repositoryDir = "/test/repo";
    const taskId = "init-test-task";
    const worktreeDir = path.join(repositoryDir, ".cassi", "worktrees", taskId);
    const cwd = "/test/repo/.cassi/worktrees/init-test-task";
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      const mockUser = {} as User;
      mockRepositoryFileInfo = new FileInfo(repositoryDir);
      mockRepository = {
        repositoryDir,
        fileInfo: mockRepositoryFileInfo,
      } as Repository;
      mockTask = {
        taskId: taskId,
        invoke: vi.fn().mockResolvedValue({ stdout: "", stderr: "" }),
        getCwd: vi.fn().mockReturnValue(cwd),
      } as unknown as Task;

      worktree = new Worktree(mockRepository, mockTask, mockRepositoryFileInfo);

      vi.clearAllMocks();

      consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      (mockTask.invoke as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ stdout: "", stderr: "" })
        .mockResolvedValueOnce({ stdout: "", stderr: "" })
        .mockResolvedValueOnce({
          current: "main",
          stdout: "On branch main\nYour branch is up to date...",
          stderr: "",
        });
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
      vi.resetAllMocks();
      consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      mockTask.invoke = vi
        .fn()
        .mockResolvedValueOnce({ stdout: "", stderr: "" })
        .mockResolvedValueOnce({ stdout: "", stderr: "" })
        .mockResolvedValueOnce({
          stdout: "Missing current property",
          stderr: "",
        });

      await expect(worktree.init()).rejects.toThrow(
        "Could not determine repository branch from git status result."
      );
    });

    it("should throw an error if taskId is null when init is called", async () => {
      mockTask.taskId = null;
      const taskWithNullId = {
        taskId: null,
        invoke: vi.fn(),
        getCwd: vi.fn(),
      } as unknown as Task;
      const repo = {
        repositoryDir,
        fileInfo: mockRepositoryFileInfo,
      } as Repository;
      const validTaskForConstruction = { taskId: "temp-id" } as Task;
      const tempWorktree = new Worktree(
        repo,
        validTaskForConstruction,
        mockRepositoryFileInfo
      );
      (tempWorktree as any).task = taskWithNullId;

      await expect(tempWorktree.init()).rejects.toThrow(
        "Task ID cannot be null when initializing a Worktree."
      );
    });
  });

  describe("initRepositoryBranch", () => {
    let mockRepository: Repository;
    let mockTask: Task;
    let worktree: Worktree;
    let mockRepositoryFileInfo: FileInfo;
    const repositoryDir = "/test/repo";
    const taskId = "init-branch-test-task";
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      const mockUser = {} as User;
      mockRepositoryFileInfo = new FileInfo(repositoryDir);
      mockRepository = {
        repositoryDir,
        fileInfo: mockRepositoryFileInfo,
      } as Repository;
      mockTask = {
        taskId: taskId,
        invoke: vi.fn(),
        getCwd: vi.fn(),
      } as unknown as Task;

      worktree = new Worktree(mockRepository, mockTask, mockRepositoryFileInfo);

      vi.clearAllMocks();

      consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
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
      });

      await expect(worktree.initRepositoryBranch()).rejects.toThrow(
        "Could not determine repository branch from git status result."
      );
    });
  });

  describe("delete", () => {
    let mockRepository: Repository;
    let mockTask: Task;
    let worktree: Worktree;
    let mockRepositoryFileInfo: FileInfo;
    const repositoryDir = "/test/repo";
    const taskId = "delete-test-task";
    const worktreeDir = path.join(repositoryDir, ".cassi", "worktrees", taskId);

    beforeEach(() => {
      const mockUser = {} as User;
      mockRepositoryFileInfo = new FileInfo(repositoryDir);
      mockRepository = {
        repositoryDir,
        fileInfo: mockRepositoryFileInfo,
      } as Repository;
      mockTask = {
        taskId: taskId,
        invoke: vi.fn().mockResolvedValue({ stdout: "", stderr: "" }),
        getCwd: vi.fn(),
      } as unknown as Task;

      worktree = new Worktree(mockRepository, mockTask, mockRepositoryFileInfo);

      vi.spyOn(worktree.fileInfo, "deleteCache").mockResolvedValue(undefined);

      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should call fileInfo.deleteCache and task.invoke with correct arguments", async () => {
      await worktree.delete();

      expect(worktree.fileInfo.deleteCache).toHaveBeenCalledTimes(1);
      expect(mockTask.invoke).toHaveBeenCalledTimes(1);
      expect(mockTask.invoke).toHaveBeenCalledWith(
        "git",
        "remWorkTree",
        [],
        [worktreeDir]
      );
    });

    it("should call deleteCache even if task.invoke throws", async () => {
      const testError = new Error("Failed to remove worktree via invoke");
      (mockTask.invoke as ReturnType<typeof vi.fn>).mockRejectedValue(
        testError
      );

      await expect(worktree.delete()).rejects.toThrow(testError);

      expect(worktree.fileInfo.deleteCache).toHaveBeenCalledTimes(1);
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
