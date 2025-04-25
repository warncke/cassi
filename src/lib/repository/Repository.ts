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
    const workspacesDir = path.join(this.repositoryDir, ".cassi", "workspaces");
    await fs.mkdir(workspacesDir, { recursive: true });
  }
}
