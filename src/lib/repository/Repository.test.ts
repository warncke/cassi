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
      // Mock the sequence of calls within worktree.init()
      .mockResolvedValueOnce({ stdout: "", stderr: "" }) // git addWorktree
      .mockResolvedValueOnce({ stdout: "", stderr: "" }) // console exec npm install
      .mockResolvedValueOnce({
        current: "main", // Add the 'current' property
        stdout: "On branch main\nYour branch is up to date...",
        stderr: "",
      }); // git status
    const mockGetCwd = vi
      .fn()
      .mockReturnValue(
        path.join(testDir, ".cassi", "worktrees", "test-task-id")
      );
    const mockCassi = {
      tool: { invoke: mockInvoke }, // Use the mock function here
      model: { newInstance: vi.fn() },
    } as unknown as Cassi;
    const mockTask = new Task(mockCassi);
    mockTask.taskId = "test-task-id";
    // Mock the methods directly on the task instance
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

    // Verify that worktree.init (which calls task.invoke) was called
    expect(mockInvoke).toHaveBeenCalledTimes(3); // Now expects 3 calls
    expect(mockInvoke).toHaveBeenNthCalledWith(
      1,
      "git",
      "addWorktree",
      [testDir], // repositoryDir
      [worktree.worktreeDir, mockTask.taskId]
    );
    expect(mockInvoke).toHaveBeenNthCalledWith(
      2,
      "console",
      "exec",
      [mockTask.getCwd()],
      ["npm install"]
    );
    // Add check for the 3rd call (git status)
    expect(mockInvoke).toHaveBeenNthCalledWith(
      3,
      "git",
      "status",
      [testDir], // repositoryDir
      []
    );

    expect(repository.worktrees.get("test-task-id")).toBe(worktree);
    expect(worktree.repositoryBranch).toBe("main"); // Check if branch was set
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
      "Task ID is required to get or create a worktree." // Updated error message
    );
  });

  test("getWorktree() should return existing worktree if called again with the same taskId", async () => {
    const mockInvoke = vi
      .fn()
      // Mock the sequence of calls within worktree.init()
      .mockResolvedValueOnce({ stdout: "", stderr: "" }) // git addWorktree
      .mockResolvedValueOnce({ stdout: "", stderr: "" }) // console exec npm install
      .mockResolvedValueOnce({
        current: "main",
        stdout: "On branch main\nYour branch is up to date...",
        stderr: "",
      }); // git status
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

    // First call - should create and init
    const worktree1 = await repository.getWorktree(mockTask);
    expect(worktree1).toBeInstanceOf(Worktree);
    expect(mockInvoke).toHaveBeenCalledTimes(3); // Init calls
    expect(repository.worktrees.get("test-task-id")).toBe(worktree1);

    // Reset mock call count for the next assertion
    mockInvoke.mockClear();

    // Second call - should return existing worktree, no init
    const worktree2 = await repository.getWorktree(mockTask);
    expect(worktree2).toBe(worktree1); // Should be the same instance
    expect(mockInvoke).not.toHaveBeenCalled(); // worktree.init should not be called again
    expect(repository.worktrees.size).toBe(1); // Still only one worktree in the map
  });

  test("remWorktree() should remove the worktree from the map", async () => {
    const taskId = "task-to-remove";
    // Add a mock delete function to the mock worktree
    const mockWorktree = {
      delete: vi.fn().mockResolvedValue(undefined),
    } as unknown as Worktree;

    // Manually add a worktree to the map for testing removal
    repository.worktrees.set(taskId, mockWorktree);
    expect(repository.worktrees.has(taskId)).toBe(true);

    await repository.remWorktree(taskId); // Now async

    expect(repository.worktrees.has(taskId)).toBe(false);
  });

  test("remWorktree() should call worktree.delete()", async () => {
    const taskId = "task-to-delete";
    const mockWorktree = {
      delete: vi.fn().mockResolvedValue(undefined), // Mock the delete method
    } as unknown as Worktree;

    repository.worktrees.set(taskId, mockWorktree);
    expect(repository.worktrees.has(taskId)).toBe(true);

    await repository.remWorktree(taskId);

    expect(mockWorktree.delete).toHaveBeenCalledTimes(1);
    expect(repository.worktrees.has(taskId)).toBe(false); // Also verify removal
  });

  test("remWorktree() should not throw if the taskId does not exist", async () => {
    // Add async here
    const taskId = "non-existent-task";
    expect(repository.worktrees.has(taskId)).toBe(false);

    // remWorktree is now async, so we need to await it
    await expect(repository.remWorktree(taskId)).resolves.not.toThrow();
    expect(repository.worktrees.has(taskId)).toBe(false); // Still false
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
      mockTask.taskId = "temp-valid-id"; // Start with a valid ID for constructor
      const mockWorktree = new Worktree(repository, mockTask);

      // Now set the taskId to null *after* Worktree creation
      mockWorktree.task.taskId = null;

      expect(() => repository.addWorktree(mockWorktree)).toThrow(
        "Task ID cannot be null when adding a Worktree."
      );
      expect(repository.worktrees.size).toBe(0); // Ensure nothing was added
    });
  });
});
