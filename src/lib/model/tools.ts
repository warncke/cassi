import { Model } from "./Model.js";
import { ToolDefinition } from "../tool/Tool.js";

export abstract class ModelTool {
  static toolDefinition: ToolDefinition;

  static async toolMethod(model: Model, ...args: any[]): Promise<any> {
    throw new Error("toolMethod must be implemented by subclasses");
  }

  static modelToolArgs(model: Model): [
    {
      toolDefinition: ToolDefinition;
      toolMethod: (...args: any[]) => Promise<any>;
    }
  ] {
    return [
      {
        toolDefinition: this.toolDefinition,
        toolMethod: (...args: any[]) => this.toolMethod(model, ...args),
      },
    ];
  }
}
