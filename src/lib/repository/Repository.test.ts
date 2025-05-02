import { Repository } from "./Repository.js";
import { User } from "../user/User.js";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { rimraf } from "rimraf";
import { Task } from "../task/Task.js";
import { Worktree } from "./Worktree.js";
import { Cassi } from "../cassi/Cassi.js";

import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";

describe("Repository", () => {
  let repository: Repository;
  let user: User;
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "cassi-repo-test-"));
    user = new User();
    repository = new Repository(testDir, user);
  });

  afterEach(async () => {
    await rimraf(testDir);
  });

  test("should create an instance of Repository", () => {
    expect(repository).toBeInstanceOf(Repository);
  });

  test("init() should create .cassi/worktrees directory", async () => {
    await repository.init();
    const worktreesDir = path.join(testDir, ".cassi", "worktrees");
    let stats;
    try {
      stats = await fs.stat(worktreesDir);
    } catch (error) {}
    expect(stats).toBeDefined();
    expect(stats?.isDirectory()).toBe(true);
  });

  test("getWorktree() should create and return a new Worktree", async () => {
    const mockInvoke = vi
      .fn()
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockResolvedValueOnce({
        current: "main",
        stdout: "On branch main\nYour branch is up to date...",
        stderr: "",
      });
    const mockGetCwd = vi
      .fn()
      .mockReturnValue(
        path.join(testDir, ".cassi", "worktrees", "test-task-id")
      );
    const mockCassi = {
      tool: { invoke: mockInvoke },
      model: { newInstance: vi.fn() },
    } as unknown as Cassi;
    const mockTask = new Task(mockCassi);
    mockTask.taskId = "test-task-id";
    mockTask.invoke = mockInvoke;
    mockTask.getCwd = mockGetCwd;

    await repository.init();
    const worktree = await repository.getWorktree(mockTask);

    expect(worktree).toBeInstanceOf(Worktree);
    expect(worktree.task).toBe(mockTask);
    expect(worktree.repository).toBe(repository);
    expect(worktree.worktreeDir).toBe(
      path.join(testDir, ".cassi", "worktrees", "test-task-id")
    );

    expect(mockInvoke).toHaveBeenCalledTimes(3);
    expect(mockInvoke).toHaveBeenNthCalledWith(
      1,
      "git",
      "addWorktree",
      [testDir],
      [worktree.worktreeDir, mockTask.taskId]
    );
    expect(mockInvoke).toHaveBeenNthCalledWith(
      2,
      "console",
      "exec",
      [mockTask.getCwd()],
      ["npm install"]
    );
    expect(mockInvoke).toHaveBeenNthCalledWith(
      3,
      "git",
      "status",
      [testDir],
      []
    );

    expect(repository.worktrees.get("test-task-id")).toBe(worktree);
    expect(worktree.repositoryBranch).toBe("main");
  });

  test("getWorktree() should throw if task.taskId is null", async () => {
    const mockCassi = {
      tool: { invoke: vi.fn() },
      model: { newInstance: vi.fn() },
    } as unknown as Cassi;
    const mockTask = new Task(mockCassi);
    mockTask.taskId = null;

    await repository.init();

    await expect(repository.getWorktree(mockTask)).rejects.toThrow(
      "Task ID is required to get or create a worktree."
    );
  });

  test("getWorktree() should return existing worktree if called again with the same taskId", async () => {
    const mockInvoke = vi
      .fn()
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockResolvedValueOnce({
        current: "main",
        stdout: "On branch main\nYour branch is up to date...",
        stderr: "",
      });
    const mockGetCwd = vi
      .fn()
      .mockReturnValue(
        path.join(testDir, ".cassi", "worktrees", "test-task-id")
      );
    const mockCassi = {
      tool: { invoke: mockInvoke },
      model: { newInstance: vi.fn() },
    } as unknown as Cassi;
    const mockTask = new Task(mockCassi);
    mockTask.taskId = "test-task-id";
    mockTask.invoke = mockInvoke;
    mockTask.getCwd = mockGetCwd;

    await repository.init();

    const worktree1 = await repository.getWorktree(mockTask);
    expect(worktree1).toBeInstanceOf(Worktree);
    expect(mockInvoke).toHaveBeenCalledTimes(3);
    expect(repository.worktrees.get("test-task-id")).toBe(worktree1);

    mockInvoke.mockClear();

    const worktree2 = await repository.getWorktree(mockTask);
    expect(worktree2).toBe(worktree1);
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(repository.worktrees.size).toBe(1);
  });

  test("remWorktree() should remove the worktree from the map", async () => {
    const taskId = "task-to-remove";
    const mockWorktree = {
      delete: vi.fn().mockResolvedValue(undefined),
    } as unknown as Worktree;

    repository.worktrees.set(taskId, mockWorktree);
    expect(repository.worktrees.has(taskId)).toBe(true);

    await repository.remWorktree(taskId);

    expect(repository.worktrees.has(taskId)).toBe(false);
  });

  test("remWorktree() should call worktree.delete()", async () => {
    const taskId = "task-to-delete";
    const mockWorktree = {
      delete: vi.fn().mockResolvedValue(undefined),
    } as unknown as Worktree;

    repository.worktrees.set(taskId, mockWorktree);
    expect(repository.worktrees.has(taskId)).toBe(true);

    await repository.remWorktree(taskId);

    expect(mockWorktree.delete).toHaveBeenCalledTimes(1);
    expect(repository.worktrees.has(taskId)).toBe(false);
  });

  test("remWorktree() should not throw if the taskId does not exist", async () => {
    const taskId = "non-existent-task";
    expect(repository.worktrees.has(taskId)).toBe(false);

    await expect(repository.remWorktree(taskId)).resolves.not.toThrow();
    expect(repository.worktrees.has(taskId)).toBe(false);
  });

  describe("addWorktree", () => {
    test("should add a valid worktree to the map", () => {
      const mockCassi = {} as unknown as Cassi;
      const mockTask = new Task(mockCassi);
      mockTask.taskId = "valid-task-id";
      const mockWorktree = new Worktree(repository, mockTask);

      repository.addWorktree(mockWorktree);

      expect(repository.worktrees.has("valid-task-id")).toBe(true);
      expect(repository.worktrees.get("valid-task-id")).toBe(mockWorktree);
    });

    test("should throw an error if the worktree task has a null taskId", () => {
      const mockCassi = {} as unknown as Cassi;
      const mockTask = new Task(mockCassi);
      mockTask.taskId = "temp-valid-id";
      const mockWorktree = new Worktree(repository, mockTask);

      mockWorktree.task.taskId = null;

      expect(() => repository.addWorktree(mockWorktree)).toThrow(
        "Task ID cannot be null when adding a Worktree."
      );
      expect(repository.worktrees.size).toBe(0);
    });
  });
});
