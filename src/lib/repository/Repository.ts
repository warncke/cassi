import { User } from "../user/User.js";

export class Repository {
  repositoryDir: string;
  user: User;

  constructor(repositoryDir: string, user: User) {
    this.repositoryDir = repositoryDir;
    this.user = user;
    // Initialize repository
  }

  async init(): Promise<void> {
    // Async initialization logic here
  }
}
