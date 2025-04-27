import process from "node:process";
import crypto from "crypto";
import { kebabCase } from "change-case";
import { Cassi } from "../cassi/Cassi.js";
import { Model } from "../model/Model.js"; // Note: This import seems unused in the original, keeping it for now.
import { Models } from "../model/Models.js";
import { Worktree } from "../repository/Worktree.js";

export class Task {
  public cassi: Cassi;
  public parentTask: Task | null = null;
  public subTasks: Task[] = [];
  public worktree?: Worktree;
  public startedAt: Date | null = null;
  public finishedAt: Date | null = null;
  public error: Error | null = null;
  public taskId: string | null = null;
  public status: 'pending' | 'running' | 'paused' | 'finished' | 'failed' = 'pending'; // Added status property

  constructor(cassi: Cassi, parentTask: Task | null = null, ...args: any[]) {
    this.cassi = cassi;
    this.parentTask = parentTask;
  }

  async initTask(): Promise<void> {}

  async cleanupTask(): Promise<void> {}

  async initWorktree(): Promise<void> {
    this.worktree = await this.cassi.repository.getWorktree(this);
  }

  setTaskId(summary: string): void {
    const repoSlug = kebabCase(summary);
    const hashInput = `${repoSlug}${Date.now()}`;
    const hash = crypto.createHash("sha256").update(hashInput).digest("base64");
    const alphanumericHash = hash.replace(/[^a-zA-Z0-9]/g, "");
    const id = alphanumericHash.substring(0, 8);
    this.taskId = `${id}-${repoSlug}`;
    console.log(`Generated ID for file modification task: ${id}`);
    console.log(`Task ID set to: ${this.taskId}`);
  }

  async run(): Promise<void> {
    if (this.status !== 'pending') {
        console.warn(`[Task] Task ${this.constructor.name} already started (status: ${this.status}). Skipping run.`);
        return;
    }
    console.log(`[Task] Starting task: ${this.constructor.name}`);
    this.status = 'running'; // Set status to running
    this.startedAt = new Date();
    try {
      console.log(`[Task] Initializing task: ${this.constructor.name}`);
      await this.initTask();
      console.log(
        `[Task] Running subtasks for: ${this.constructor.name}. Count: ${this.subTasks.length}`
      );
      for (const subTask of this.subTasks) {
        // Check if paused before running each subtask
        while ((this.status as string) === 'paused') { // Cast for TS2367
          console.log(`[Task] Task ${this.constructor.name} is paused. Waiting...`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second before checking again
        }

        // Check status *after* the pause loop, before running the subtask
        if ((this.status as string) === 'failed') { // Cast for TS2367
             console.error(`[Task] Task ${this.constructor.name} marked as failed while paused or before subtask check. Aborting subtask execution.`);
             throw this.error || new Error(`Task ${this.constructor.name} failed.`);
        }
        if ((this.status as string) === 'finished') { // Cast for TS2367
             console.log(`[Task] Task ${this.constructor.name} marked as finished while paused or before subtask check. Stopping subtask execution.`);
             break;
        }
        // Ensure the status is still 'running' after potentially pausing
        if (this.status !== 'running') {
             // This case might occur if the status was changed externally (e.g., to finished/failed) while waiting
             console.warn(`[Task] Task ${this.constructor.name} is no longer running (status: ${this.status}) before executing subtask. Aborting subtask loop.`);
             break; // Exit the subtask loop
        }

        console.log(
          `[Task] Running subtask: ${subTask.constructor.name} from parent: ${this.constructor.name}`
        );
        // Run the subtask
        await subTask.run();

        // Check subtask for errors *after* it runs
        if (subTask.error) {
          console.error(
            `[Task] Subtask ${subTask.constructor.name} failed in parent ${this.constructor.name}. Error: ${subTask.error.message}`
          );
          throw subTask.error; // Propagate error, which will set parent status to 'failed'
        }

         // Post-subtask pause check removed; handled by finally block
        // and pre-subtask check. If subtask failed, the error is thrown above.
      }
    } catch (err) {
      this.error = err instanceof Error ? err : new Error(String(err));
      this.status = 'failed'; // Set status to failed on error
    } finally {
      this.finishedAt = new Date();
      // Set final status only if not already failed
      if (this.status !== 'failed') {
         // If the task ended while paused or running, mark it as finished.
         if ((this.status as string) === 'paused') { // Cast for TS2367
             console.warn(`[Task] Task ${this.constructor.name} finished in paused state. Marking as finished.`);
             this.status = 'finished';
         } else if (this.status === 'running') {
             // This is the normal successful completion case
             this.status = 'finished';
         }
         // If status is already 'finished' (e.g., marked externally while paused/running), leave it as is.
      }
      // --- Cleanup ---
      try {
        // Check status before cleanup - should we cleanup if failed/paused?
        // For now, let's always attempt cleanup.
        console.log(`[Task] Cleaning up task: ${this.constructor.name} (Status: ${this.status})`);
        await this.cleanupTask();
      } catch (cleanupErr) {
        console.error(
          `[Task] Error during cleanup for ${this.constructor.name}: ${
            cleanupErr instanceof Error
              ? cleanupErr.message
              : String(cleanupErr)
          }`
        );
        // If cleanup fails, mark as failed regardless of previous status
        this.status = 'failed';
        // Record the cleanup error only if there wasn't a prior error.
        // The cleanup error itself is already logged.
        if (!this.error) {
          this.error = cleanupErr instanceof Error ? cleanupErr : new Error(String(cleanupErr));
        }
        // If there was a prior error, this.error remains unchanged, preserving the original failure.
      }
       console.log(`[Task] Finished task: ${this.constructor.name} with final status: ${this.status}`);
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

  worktreeDir(): string {
    if (this.worktree?.worktreeDir) {
      return this.worktree.worktreeDir;
    }
    if (this.parentTask) {
      try {
        return this.parentTask.worktreeDir();
      } catch (e) {}
    }
    throw new Error(
      "Worktree directory not found for this task or any parent task."
    );
  }

  getCwd(): string {
    try {
      return this.worktreeDir();
    } catch (e) {
      return process.cwd();
    }
  }

  getTaskId(): string {
    if (this.taskId) {
      return this.taskId;
    }
    if (this.parentTask) {
      return this.parentTask.getTaskId();
    }
    return "XXXXXXXX";
  }

  getTaskIdShort(): string {
    return this.getTaskId().substring(0, 8);
  }

  getWorkTree(): Worktree {
    if (this.worktree) {
      return this.worktree;
    }
    if (this.parentTask) {
      try {
        return this.parentTask.getWorkTree();
      } catch (e) {}
    }
    throw new Error("Worktree not found for this task or any parent task.");
  }

  async pauseTask(): Promise<void> {
    // Only allow pausing if currently running
    if (this.status === 'running') {
      this.status = 'paused';
      console.log(`[Task] Pausing task: ${this.constructor.name}`);
      // More sophisticated pause logic might be needed for ongoing async operations
      // within the task itself, beyond stopping the subtask loop.
    } else {
      // Log a warning if attempting to pause from any other state
      console.warn(`[Task] Task ${this.constructor.name} cannot be paused in state: ${this.status}`);
    }
  }

  async resumeTask(): Promise<void> {
    // Only allow resuming if currently paused
    if (this.status === 'paused') {
      this.status = 'running';
      console.log(`[Task] Resuming task: ${this.constructor.name}`);
      // The run loop will automatically pick up from where it left off.
    } else {
      // Log a warning if attempting to resume from any other state
      console.warn(`[Task] Task ${this.constructor.name} cannot be resumed from state: ${this.status}`);
    }
  }
}
