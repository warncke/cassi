import process from "node:process";
import { Cassi } from "../cassi/Cassi.js";
import { Model } from "../model/Model.js";
import { Models } from "../model/Models.js";

export class Task {
  public cassi: Cassi;
  public parentTask: Task | null = null;
  public subTasks: Task[] = [];
  public worktreeDir?: string;
  public startedAt: Date | null = null;
  public finishedAt: Date | null = null;
  public error: Error | null = null;

  constructor(cassi: Cassi, parentTask: Task | null = null) {
    this.cassi = cassi;
    this.parentTask = parentTask;
  }

  async initTask(): Promise<void> {
  }

  async cleanupTask(): Promise<void> {
  }

  async run(): Promise<void> {
    console.log(`[Task] Starting task: ${this.constructor.name}`);
    this.startedAt = new Date();
    try {
      console.log(`[Task] Initializing task: ${this.constructor.name}`);
      await this.initTask();
      console.log(
        `[Task] Running subtasks for: ${this.constructor.name}. Count: ${this.subTasks.length}`
      );
      for (const subTask of this.subTasks) {
        console.log(
          `[Task] Running subtask: ${subTask.constructor.name} from parent: ${this.constructor.name}`
        );
        await subTask.run();
        if (subTask.error) {
          console.error(
            `[Task] Subtask ${subTask.constructor.name} failed in parent ${this.constructor.name}. Error: ${subTask.error.message}`
          );
          throw subTask.error;
        }
      }
    } catch (err) {
      this.error = err instanceof Error ? err : new Error(String(err));
    } finally {
      this.finishedAt = new Date();
      try {
        console.log(`[Task] Cleaning up task: ${this.constructor.name}`);
        await this.cleanupTask();
      } catch (cleanupErr) {
        console.error(
          `[Task] Error during cleanup for ${this.constructor.name}: ${
            cleanupErr instanceof Error
              ? cleanupErr.message
              : String(cleanupErr)
          }`
        );
      }
    }
  }

  async invoke(
    toolName: string,
    methodName: string,
    toolArgs?: any[],
    methodArgs: any[] = []
  ): Promise<any> {
    const effectiveToolArgs = toolArgs ?? [];
    return this.cassi.tool.invoke(
      this,
      toolName,
      methodName,
      effectiveToolArgs,
      methodArgs
    );
  }

  /**
   * Creates a new instance of a specified model (which extends Models).
   * Creates a new instance of a specified model (which extends Models).
   * @param modelClassName The name of the model class to instantiate.
   * @returns A new instance of the specified model.
   */
  newModel(modelClassName: string): Models {
    return this.cassi.model.newInstance(modelClassName, this);
  }

  /**
   * Adds a subtask to this task and sets its parent.
   * @param subtask The Task instance to add as a subtask.
   */
  addSubtask(subtask: Task): void {
    subtask.parentTask = this;
    this.subTasks.push(subtask);
  }

  getCwd(): string {
    if (this.worktreeDir) {
      return this.worktreeDir;
    }
    if (this.parentTask) {
      return this.parentTask.getCwd();
    }
    return process.cwd();
  }
}
