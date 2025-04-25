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
      (...args: any[]) => this.toolMethod(model, ...args),
    ];
  }
}
