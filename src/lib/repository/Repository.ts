import { User } from "../user/User.js";
import * as fs from "fs/promises";
import * as path from "path";
import { Worktree } from "./Worktree.js";
import { Task } from "../task/Task.js";

export class Repository {
  repositoryDir: string;
  user: User;
  worktrees: Map<string, Worktree> = new Map();

  constructor(repositoryDir: string, user: User) {
    this.repositoryDir = repositoryDir;
    this.user = user;
  }

  async init(): Promise<void> {
    const worktreesDir = path.join(this.repositoryDir, ".cassi", "worktrees");
    await fs.mkdir(worktreesDir, { recursive: true });
  }

  async getWorktree(task: Task): Promise<Worktree> {
    if (!task.taskId) {
      throw new Error("Task ID is required to get or create a worktree.");
    }

    let worktree = this.worktrees.get(task.taskId);

    if (worktree) {
      return worktree;
    }

    worktree = new Worktree(this, task);
    this.worktrees.set(task.taskId, worktree);
    await worktree.init();
    return worktree;
  }

  addWorktree(worktree: Worktree): void {
    if (!worktree.task.taskId) {
      throw new Error("Task ID cannot be null when adding a Worktree.");
    }
    this.worktrees.set(worktree.task.taskId, worktree);
  }

  async remWorktree(taskId: string): Promise<void> {
    const worktree = this.worktrees.get(taskId);
    if (worktree) {
      await worktree.delete();
      this.worktrees.delete(taskId);
    }
  }
}
