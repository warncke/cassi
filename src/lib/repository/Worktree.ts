import path from "node:path";
import { Task } from "../task/Task.js";
import { Repository } from "./Repository.js";
import { FileInfo } from "../file-info/FileInfo.js";

export class Worktree {
  public readonly repository: Repository;
  public readonly task: Task;
  public readonly worktreeDir: string;
  public readonly fileInfo: FileInfo;
  public repositoryBranch!: string;

  constructor(
    repository: Repository,
    task: Task,
    repositoryFileInfo: FileInfo
  ) {
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
    this.fileInfo = new FileInfo(
      repository.repositoryDir,
      this.worktreeDir,
      repositoryFileInfo
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

    await this.initRepositoryBranch();
  }

  public async initRepositoryBranch(): Promise<void> {
    const statusResult = await this.task.invoke(
      "git",
      "status",
      [this.repository.repositoryDir],
      []
    );

    if (!statusResult || !statusResult.current) {
      throw new Error(
        "Could not determine repository branch from git status result."
      );
    }
    this.repositoryBranch = statusResult.current;
    console.log(`Repository branch set to: ${this.repositoryBranch}`);
  }

  async delete(): Promise<void> {
    await this.fileInfo.deleteCache();

    await this.task.invoke("git", "remWorkTree", [], [this.worktreeDir]);
    console.log(`Removed worktree and cache for ${this.task.taskId}`);
  }
}
