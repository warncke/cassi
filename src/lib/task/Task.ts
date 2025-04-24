import { Cassi } from "../cassi/Cassi.js";
// Remove unused imports if Tool and Invocation are not directly used here anymore
// import { Tool } from "../tool/Tool.js";
// import { Invocation } from "../tool/Invocation.js";

export class Task {
  public cassi: Cassi;
  public parentTask: Task | null = null; // Added parentTask property
  public subTasks: Task[] = [];
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
    }
  }

  async invoke(
    toolName: string,
    methodName: string,
    ...args: any[]
  ): Promise<any> {
    // Return type matches Cassi.tool.invoke
    // Invoke the tool using Cassi's tool invoker, passing this task instance
    return this.cassi.tool.invoke(this, toolName, methodName, ...args);
  }
}
