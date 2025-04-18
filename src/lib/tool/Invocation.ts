export class Invocation {
  public toolName: string;
  public toolImplementationName: string;
  public method: string;
  public startTime: number;

  constructor(
    toolName: string,
    implementationName: string,
    methodName: string
  ) {
    this.toolName = toolName;
    this.toolImplementationName = implementationName;
    this.method = methodName;
    this.startTime = Date.now();
  }
}
