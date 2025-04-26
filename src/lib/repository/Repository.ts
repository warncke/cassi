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
    const worktree = new Worktree(this, task);
    this.worktrees.set(task.taskId!, worktree);
    await worktree.init();
    return worktree;
  }

  remWorktree(taskId: string): void {
    this.worktrees.delete(taskId);
  }
}
