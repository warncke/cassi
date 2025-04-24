import { Task } from "../task/Task.js";

export class Invocation {
  public toolName: string;
  public toolImplementationName: string;
  public method: string;
  public toolMethod: Function; // The actual method function
  public toolInstance: any; // The instance the method belongs to
  public task: Task; // Added task property
  public toolArgs: any[]; // Arguments for the tool constructor
  public methodArgs: any[]; // Renamed from args
  public startTime: number | null = null;
  public endTime: number | null = null; // Added endTime property
  public error: Error | null = null; // Added error property

  constructor(
    task: Task, // Add task parameter
    toolName: string,
    implementationName: string,
    methodName: string,
    toolMethod: Function,
    toolInstance: any,
    toolArgs: any[], // Accept toolArgs in constructor
    methodArgs: any[] // Renamed from args
  ) {
    this.task = task; // Store task
    this.toolName = toolName;
    this.toolImplementationName = implementationName;
    this.method = methodName;
    this.toolMethod = toolMethod;
    this.toolInstance = toolInstance;
    this.toolArgs = toolArgs; // Store toolArgs
    this.methodArgs = methodArgs; // Renamed from args
  }

  /**
   * Executes the tool method associated with this invocation using the stored arguments.
   * @returns The result of the invoked tool method.
   */
  async invoke(): Promise<any> {
    // Remove task parameter
    // Ensure toolMethod is actually a function before calling apply
    if (typeof this.toolMethod !== "function") {
      // This should ideally not happen if constructor validation is proper,
      // but it's a good safeguard.
      throw new Error(
        `Invocation error: toolMethod for "${this.toolName}.${this.method}" is not a function.`
      );
    }
    this.startTime = Date.now(); // Set startTime before invocation
    try {
      // Call the method on the specific tool instance with the stored task and arguments
      const result = await this.toolMethod.apply(this.toolInstance, [
        this.task, // Use stored task
        ...this.methodArgs, // Renamed from args
      ]);
      return result;
    } catch (e: any) {
      this.error = e instanceof Error ? e : new Error(String(e)); // Set error if caught
      throw e; // Re-throw the error after capturing it
    } finally {
      this.endTime = Date.now(); // Set endTime regardless of success or failure
    }
  }
}
