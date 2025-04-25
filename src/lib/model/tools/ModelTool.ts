import { Models } from "../Models.js"; // Change import from Model to Models
import { ToolDefinition } from "../../tool/Tool.js";

export abstract class ModelTool {
  static toolDefinition: ToolDefinition;

  static async toolMethod(model: Models, ...args: any[]): Promise<any> {
    // Change type to Models
    throw new Error("toolMethod must be implemented by subclasses");
  }

  static modelToolArgs(
    model: Models // Change type to Models
  ): [ToolDefinition, (...args: any[]) => Promise<any>] {
    return [
      this.toolDefinition,
      (...args: any[]) => this.toolMethod(model, ...args),
    ];
  }
}
