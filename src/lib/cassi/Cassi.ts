import { Config } from "../config/Config.js";
import { Repository } from "../repository/Repository.js";
import { User } from "../user/User.js";
import { Tool } from "../tool/Tool.js";
import { Task } from "../task/Task.js";

export class Cassi {
  config: Config;
  repository: Repository;
  user: User;
  tool: Tool; // Tool needs to be instantiated
  tasks: Task[] = [];

  constructor(user: User, configFile: string, repositoryDir: string) {
    this.user = user;
    this.config = new Config(configFile, user);
    this.repository = new Repository(repositoryDir, user);
    // Instantiate Tool with user and config
    this.tool = new Tool(this.user, this.config);
  }

  async init() {
    await this.user.init();
    await this.config.init();
    // Call init on the Tool instance
    await this.tool.init();
    await this.repository.init();
  }

  newTask(task: Task) {
    this.tasks.push(task);
  }

  async runTasks() {
    console.log(`[Cassi] Running tasks. Task count: ${this.tasks.length}`); // Log task count
    for (const task of this.tasks) {
      if (task.startedAt === null) {
        console.log(`[Cassi] Running task: ${task.constructor.name}`); // Log which task is running
        await task.run();
        // Optional: Handle task errors if needed, e.g., stop processing further tasks
        if (task.error) {
          console.error(`Task failed with error: ${task.error.message}`);
          // Decide if you want to break the loop or continue with other tasks
          // break;
        }
      }
    }
  }
}
