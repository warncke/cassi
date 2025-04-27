import { Models } from "../Models.js";
import { ToolDefinition } from "../../tool/Tool.js";

export abstract class ModelTool {
  static toolDefinition: ToolDefinition;

  static async toolMethod(model: Models, ...args: any[]): Promise<any> {
    throw new Error("toolMethod must be implemented by subclasses");
  }

  static modelToolArgs(
    model: Models
  ): [ToolDefinition, (...args: any[]) => Promise<any>] {
    return [
      this.toolDefinition,
      async (...args: any[]) => {
        const argsSize = JSON.stringify(args).length;
        console.log(
          `Calling tool: ${this.toolDefinition.name}, Model: ${model.constructor.name}, Args count: ${args.length}, Args size: ${argsSize}`
        );
        const result = await this.toolMethod(model, ...args);
        let responseLength = 0;
        if (typeof result === "string" || Array.isArray(result)) {
          responseLength = result.length;
        } else if (result !== null && result !== undefined) {
          responseLength = JSON.stringify(result).length;
        }
        console.log(
          `Tool ${this.toolDefinition.name} finished. Response length: ${responseLength}`
        );
        return result;
      },
    ];
  }
}
