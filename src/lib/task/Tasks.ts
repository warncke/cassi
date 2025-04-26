import fs from "fs/promises";
import path from "path";
import { Task } from "./Task.js";
import type { Cassi } from "../cassi/Cassi.js";

export class Tasks {
  public availableTasks: Map<string, typeof Task> = new Map();

  async init(tasksDir: string = path.join(__dirname, "tasks")): Promise<void> {
    this.availableTasks.clear();
    const files = await fs.readdir(tasksDir);

    for (const file of files) {
      if (file.endsWith(".ts") && !file.endsWith(".test.ts")) {
        const filePath = path.join(tasksDir, file);
        try {
          const module = await import(filePath);
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
          console.error(`Error loading task from ${filePath}:`, error);
        }
      }
    }
  }

  newTask(taskName: string, cassi: Cassi, parentTask?: Task): Task {
    const TaskClass = this.availableTasks.get(taskName);
    if (!TaskClass) {
      throw new Error(`Task "${taskName}" not found.`);
    }
    return new TaskClass(cassi, parentTask);
  }
}
