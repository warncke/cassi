import { z } from "zod";
import path from "path";
import { Models } from "../Models.js";
import { ModelTool } from "./ModelTool.js";
import { ToolDefinition } from "../../tool/Tool.js";
import { Config } from "../../config/Config.js";

const runTestFileInputSchema = z.object({
  path: z
    .string()
    .describe(
      "The path of the test file to run (relative to the current working directory)"
    ),
});

export class RunTestFile extends ModelTool {
  static toolDefinition: ToolDefinition = {
    name: "RUN_TEST_FILE",
    description: "Runs tests for a specific file",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "The path of the test file to run (relative to the current working directory)",
        },
      },
      required: ["path"],
    },
  };

  static async toolMethod(
    model: Models,
    input: z.infer<typeof runTestFileInputSchema>
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

    const testFilePath = input.path;
    const fullTestCommand = `${testCommand} -- --reporter=tap ${testFilePath}`;

    try {
      const result = await model.task.invoke(
        "console",
        "exec",
        [model.task.getCwd()],
        [fullTestCommand]
      );

      return result.stdout + "\n" + result.stderr;
    } catch (error: any) {
      return `Error executing test command "${fullTestCommand}": ${
        error.message || error
      }`;
    }
  }
}
