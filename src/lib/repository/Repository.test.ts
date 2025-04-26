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
    const mockCassi = {
      tool: { invoke: vi.fn() },
      model: { newInstance: vi.fn() },
    } as unknown as Cassi;
    const mockTask = new Task(mockCassi);
    mockTask.taskId = "test-task-id";

    await repository.init();
    const worktree = await repository.getWorktree(mockTask);

    expect(worktree).toBeInstanceOf(Worktree);
    expect(worktree.task).toBe(mockTask);
    expect(worktree.repository).toBe(repository);
    expect(worktree.worktreeDir).toBe(
      path.join(testDir, ".cassi", "worktrees", "test-task-id")
    );

    const worktreeDirStats = await fs.stat(worktree.worktreeDir);
    expect(worktreeDirStats.isDirectory()).toBe(true);

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
});
