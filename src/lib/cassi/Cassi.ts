import { Config } from "../config/Config.js";
import { Repository } from "../repository/Repository.js";
import { User } from "../user/User.js";
import { Tool } from "../tool/Tool.js";
import { Task } from "../task/Task.js";
import { Model } from "../model/Model.js";

export class Cassi {
  config: Config;
  repository: Repository;
  user: User;
  tool: Tool;
  model: Model;
  tasks: Task[] = [];

  constructor(user: User, configFile: string, repositoryDir: string) {
    this.user = user;
    this.config = new Config(configFile, user);
    this.repository = new Repository(repositoryDir, user);
    this.tool = new Tool(this.user, this.config);
    this.model = new Model();
  }

  async init() {
    await this.user.init();
    await this.config.init();
    await this.tool.init();
    await this.model.init();
    await this.repository.init();
  }

  newTask(task: Task) {
    this.tasks.push(task);
  }

  async runTasks() {
    console.log(`[Cassi] Running tasks. Task count: ${this.tasks.length}`);
    for (const task of this.tasks) {
      if (task.startedAt === null) {
        console.log(`[Cassi] Running task: ${task.constructor.name}`);
        await task.run();
        if (task.error) {
          console.error(
            "[Cassi] Task Failed with Error:",
            JSON.stringify({
              message: task.error.message,
              stack: task.error.stack,
            })
          );
        }
      }
    }
  }
}
