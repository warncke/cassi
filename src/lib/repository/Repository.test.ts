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
    const mockInvoke = vi.fn().mockResolvedValue("");
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
    expect(mockInvoke).toHaveBeenCalledTimes(2);
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

    expect(repository.worktrees.get("test-task-id")).toBe(worktree);
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
      "Task ID cannot be null when creating a Worktree."
    );
  });

  test("remWorktree() should remove the worktree from the map", async () => {
    const taskId = "task-to-remove";
    const mockWorktree = {} as Worktree; // Minimal mock needed

    // Manually add a worktree to the map for testing removal
    repository.worktrees.set(taskId, mockWorktree);
    expect(repository.worktrees.has(taskId)).toBe(true);

    repository.remWorktree(taskId);

    expect(repository.worktrees.has(taskId)).toBe(false);
  });

  test("remWorktree() should not throw if the taskId does not exist", () => {
    const taskId = "non-existent-task";
    expect(repository.worktrees.has(taskId)).toBe(false);

    expect(() => repository.remWorktree(taskId)).not.toThrow();
    expect(repository.worktrees.has(taskId)).toBe(false); // Still false
  });
});
