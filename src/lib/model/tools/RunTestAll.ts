import { z } from "zod";
import { Models } from "../Models.js";
import { ModelTool } from "./ModelTool.js";
import { ToolDefinition } from "../../tool/Tool.js";
import { Config } from "../../config/Config.js";

const runTestAllInputSchema = z.object({});

export class RunTestAll extends ModelTool {
  static toolDefinition: ToolDefinition = {
    name: "RUN_TEST_ALL",
    description: "Runs all tests for project",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  };

  static async toolMethod(
    model: Models,
    input: z.infer<typeof runTestAllInputSchema>
  ): Promise<string> {
    const configData = model.task.cassi.config.configData;
    if (!configData) {
      return "Error: Configuration data not found.";
    }
    const commands = configData.commands;
    if (!commands) {
      return "Error: Commands configuration not found.";
    }
    const testCommand = commands.test;

    if (!testCommand) {
      return "Error: Test command not found in configuration.";
    }

    try {
      const result = await model.task.invoke(
        "console",
        "exec",
        [model.task.getCwd()],
        [testCommand + " -- --reporter=dot --silent"]
      );

      return result.stderr || "OK";
    } catch (error: any) {
      return `Error executing test command "${testCommand}": ${
        error.message || error
      }`;
    }
  }
}
