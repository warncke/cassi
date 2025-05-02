import fs from "fs/promises";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { Task } from "./Task.js";
import type { Cassi } from "../cassi/Cassi.js";

export class Tasks {
  public availableTasks: Map<string, typeof Task> = new Map();
  public cassi: Cassi;

  constructor(cassi: Cassi) {
    this.cassi = cassi;
  }

  async init(tasksDir?: string): Promise<void> {
    if (!tasksDir) {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      tasksDir = path.join(__dirname, "tasks");
    }
    this.availableTasks.clear();
    const files = await fs.readdir(tasksDir);
    const fileExtension = import.meta.url.endsWith(".ts") ? ".ts" : ".js";

    for (const file of files) {
      if (file.endsWith(fileExtension) && !file.includes(".test.")) {
        const filePathUrl = new URL(path.join(tasksDir, file), import.meta.url)
          .href;
        try {
          const module = await import(filePathUrl);
          for (const key in module) {
            const exportedItem = module[key];
            if (
              typeof exportedItem === "function" &&
              exportedItem.prototype instanceof Task &&
              !exportedItem.name.endsWith("Test")
            ) {
              this.availableTasks.set(
                exportedItem.name,
                exportedItem as typeof Task
              );
            }
          }
        } catch (error) {
          console.error(`Error loading task from ${filePathUrl}:`, error);
        }
      }
    }
  }

  newTask(taskName: string, parentTask?: Task, ...args: any[]): Task {
    const TaskClass = this.availableTasks.get(taskName);
    if (!TaskClass) {
      throw new Error(`Task "${taskName}" not found.`);
    }
    return new TaskClass(this.cassi, parentTask, ...args);
  }
}
