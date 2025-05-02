import { Config } from "../config/Config.js";
import { Repository } from "../repository/Repository.js";
import { User } from "../user/User.js";
import { Tool } from "../tool/Tool.js";
import { Task } from "../task/Task.js";
import { Tasks } from "../task/Tasks.js";
import { Model } from "../model/Model.js";

export type Foo = {
  bar: string;
};

export const bam: string = "BAR";

export class Cassi {
  config: Config;
  repository: Repository;
  user: User;
  tool: Tool;
  model: Model;
  task: Tasks;
  tasks: Task[] = [];

  constructor(user: User, configFile: string, repositoryDir: string) {
    this.user = user;
    this.config = new Config(configFile, user);
    this.repository = new Repository(repositoryDir, user);
    this.tool = new Tool(this.user, this.config);
    this.model = new Model();
    this.task = new Tasks(this);
  }

  async init() {
    await this.user.init();
    await this.config.init();
    await this.tool.init();
    await this.model.init();
    await this.repository.init();
    await this.task.init();
  }

  newTask(taskName: string, parentTask?: Task, ...args: any[]): Task {
    const newTask = this.task.newTask(taskName, parentTask, ...args);
    this.tasks.push(newTask);
    return newTask;
  }

  async runTasks() {
    for (const task of this.tasks) {
      if (task.startedAt === null && task.finishedAt === null) {
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
