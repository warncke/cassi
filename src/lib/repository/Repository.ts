import { User } from "../user/User.js";
import * as fs from "fs/promises";
import * as path from "path";

export class Repository {
  repositoryDir: string;
  user: User;

  constructor(repositoryDir: string, user: User) {
    this.repositoryDir = repositoryDir;
    this.user = user;
  }

  async init(): Promise<void> {
    const worktreesDir = path.join(this.repositoryDir, ".cassi", "worktrees");
    await fs.mkdir(worktreesDir, { recursive: true });
  }
}
