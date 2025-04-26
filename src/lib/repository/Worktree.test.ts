import { describe, it, expect, vi } from "vitest";
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

  it("should throw an error if taskId is null", () => {
    const repositoryDir = "/path/to/repo";
    // Mock Repository and Task with null taskId
    const mockUser = {} as User;
    const mockRepository = { repositoryDir } as Repository;
    const mockTask = { taskId: null } as Task;

    expect(() => new Worktree(mockRepository, mockTask)).toThrow(
      "Task ID cannot be null when creating a Worktree."
    );
  });
});
