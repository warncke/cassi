import path from "path";
import { Task } from "../task/Task.js";
import { Repository } from "./Repository.js";

export class Worktree {
  readonly repository: Repository;
  readonly task: Task;
  readonly worktreeDir: string;

  constructor(repository: Repository, task: Task) {
    if (!task.taskId) {
      throw new Error("Task ID cannot be null when creating a Worktree.");
    }
    this.repository = repository;
    this.task = task;
    this.worktreeDir = path.join(
      repository.repositoryDir,
      ".cassi",
      "worktrees",
      task.taskId
    );
  }

  async init(): Promise<void> {
    if (!this.task.taskId) {
      throw new Error("Task ID cannot be null when initializing a Worktree.");
    }

    console.log(`Worktree directory set to: ${this.worktreeDir}`);

    await this.task.invoke(
      "git",
      "addWorktree",
      [this.repository.repositoryDir],
      [this.worktreeDir, this.task.taskId]
    );
    console.log(
      `Added worktree at ${this.worktreeDir} for branch ${this.task.taskId}`
    );

    await this.task.invoke(
      "console",
      "exec",
      [this.task.getCwd()],
      ["npm install"]
    );
    console.log(
      `Created branch ${
        this.task.taskId
      } and installed dependencies in ${this.task.getCwd()}`
    );
  }

  async delete(): Promise<void> {
    console.log(`[Worktree] Deleting worktree at ${this.worktreeDir}`);
    try {
      await this.repository.remWorktree(this.worktreeDir);
    } catch (e) {
      console.warn(
        `[Worktree] Failed to remove worktree directory ${this.worktreeDir}:`,
        e
      );
    }
    console.log(`[Worktree] Finished deleting worktree at ${this.worktreeDir}`);
  }
}
