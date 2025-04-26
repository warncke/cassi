import * as fs from "fs/promises";
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
    task.worktreeDir = this.worktreeDir;
  }

  async init(): Promise<void> {
    await fs.mkdir(this.worktreeDir, { recursive: true });
  }
}
