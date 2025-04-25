import process from "node:process";
import { Cassi } from "../cassi/Cassi.js";
import { Model } from "../model/Model.js"; // Keep Model for the class itself
import { Models } from "../model/Models.js"; // Import Models type for instances
// Remove unused imports if Tool and Invocation are not directly used here anymore
// import { Tool } from "../tool/Tool.js";
// import { Invocation } from "../tool/Invocation.js";

export class Task {
  public cassi: Cassi;
  public parentTask: Task | null = null; // Added parentTask property
  public subTasks: Task[] = [];
  public worktreeDir?: string; // Added optional worktreeDir for tasks
  public startedAt: Date | null = null;
  public finishedAt: Date | null = null;
  public error: Error | null = null;

  constructor(cassi: Cassi, parentTask: Task | null = null) {
    // Added parentTask parameter
    this.cassi = cassi;
    this.parentTask = parentTask; // Assign parentTask
  }

  async initTask(): Promise<void> {
    // Base implementation is empty, subclasses can override
  }

  async cleanupTask(): Promise<void> {
    // Base implementation is empty, subclasses can override
  }

  async run(): Promise<void> {
    console.log(`[Task] Starting task: ${this.constructor.name}`); // Log task start
    this.startedAt = new Date();
    try {
      console.log(`[Task] Initializing task: ${this.constructor.name}`); // Log initTask call
      await this.initTask(); // Call initTask before running subtasks
      console.log(
        `[Task] Running subtasks for: ${this.constructor.name}. Count: ${this.subTasks.length}`
      ); // Log subtask execution start
      for (const subTask of this.subTasks) {
        console.log(
          `[Task] Running subtask: ${subTask.constructor.name} from parent: ${this.constructor.name}`
        ); // Log specific subtask run
        await subTask.run();
        // If a subtask fails, stop processing subsequent subtasks in this task
        if (subTask.error) {
          console.error(
            `[Task] Subtask ${subTask.constructor.name} failed in parent ${this.constructor.name}. Error: ${subTask.error.message}`
          ); // Log subtask error
          throw subTask.error;
        }
      }
    } catch (err) {
      this.error = err instanceof Error ? err : new Error(String(err));
    } finally {
      this.finishedAt = new Date();
      try {
        console.log(`[Task] Cleaning up task: ${this.constructor.name}`); // Log cleanupTask call
        await this.cleanupTask();
      } catch (cleanupErr) {
        console.error(
          `[Task] Error during cleanup for ${this.constructor.name}: ${
            cleanupErr instanceof Error
              ? cleanupErr.message
              : String(cleanupErr)
          }`
        );
        // Optionally decide how to handle cleanup errors, e.g., log or aggregate
      }
    }
  }

  async invoke(
    toolName: string,
    methodName: string,
    toolArgs?: any[], // Keep toolArgs optional
    methodArgs: any[] = [] // Add methodArgs, default to empty array
  ): Promise<any> {
    // Return type matches Cassi.tool.invoke
    const effectiveToolArgs = toolArgs ?? []; // Default to empty array if undefined
    // Invoke the tool using Cassi's tool invoker, passing task, toolName, methodName, toolArgs, and methodArgs
    return this.cassi.tool.invoke(
      this,
      toolName,
      methodName,
      effectiveToolArgs, // Pass the effective tool args
      methodArgs // Pass methodArgs
    );
  }

  /**
   * Creates a new instance of a specified model (which extends Models).
   * Creates a new instance of a specified model (which extends Models).
   * @param modelClassName The name of the model class to instantiate.
   * @returns A new instance of the specified model.
   */
  newModel(modelClassName: string): Models {
    // Removed generic, changed return type to Models
    // Call newInstance which returns Models directly, passing the current task instance
    return this.cassi.model.newInstance(modelClassName, this); // Pass 'this' as the task context
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
      // Check task's own worktreeDir first
      return this.worktreeDir;
    }
    if (this.parentTask) {
      // Fallback to parent's cwd
      return this.parentTask.getCwd(); // Call method on parent
    }
    return process.cwd();
  }
}
