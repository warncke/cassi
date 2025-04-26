import { Task } from "../task/Task.js";

export class Invocation {
  public toolName: string;
  public toolImplementationName: string;
  public method: string;
  public toolMethod: Function;
  public toolInstance: any;
  public task: Task;
  public toolArgs: any[];
  public methodArgs: any[];
  public startTime: number | null = null;
  public endTime: number | null = null;
  public error: Error | null = null;

  constructor(
    task: Task,
    toolName: string,
    implementationName: string,
    methodName: string,
    toolMethod: Function,
    toolInstance: any,
    toolArgs: any[],
    methodArgs: any[]
  ) {
    this.task = task;
    this.toolName = toolName;
    this.toolImplementationName = implementationName;
    this.method = methodName;
    this.toolMethod = toolMethod;
    this.toolInstance = toolInstance;
    this.toolArgs = toolArgs;
    this.methodArgs = methodArgs;
  }

  /**
   * Executes the tool method associated with this invocation using the stored arguments.
   * @returns The result of the invoked tool method.
   */
  async invoke(): Promise<any> {
    if (typeof this.toolMethod !== "function") {
      throw new Error(
        `Invocation error: toolMethod for "${this.toolName}.${this.method}" is not a function.`
      );
    }
    this.startTime = Date.now();
    try {
      const result = await this.toolMethod.apply(this.toolInstance, [
        ...this.methodArgs,
      ]);
      return result;
    } catch (e: any) {
      this.error = e instanceof Error ? e : new Error(String(e));
      throw e;
    } finally {
      this.endTime = Date.now();
    }
  }
}
