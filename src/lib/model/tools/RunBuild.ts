import { z } from "zod";
import { Models } from "../Models.js";
import { ModelTool } from "./ModelTool.js";
import { ToolDefinition } from "../../tool/Tool.js";
import { Config } from "../../config/Config.js";

const runBuildInputSchema = z.object({});

export class RunBuild extends ModelTool {
  static toolDefinition: ToolDefinition = {
    name: "RunBuild",
    description: "Runs the build command specified in the cassi configuration.",
    inputSchema: runBuildInputSchema,
    outputSchema: z.string(),
  };

  static async toolMethod(
    model: Models,
    input: z.infer<typeof runBuildInputSchema>
  ): Promise<string> {
    const configData = model.task.cassi.config.configData;
    if (!configData) {
      return "Error: Configuration data not found.";
    }
    const commands = configData.commands;
    if (!commands) {
      return "Error: Commands configuration not found.";
    }
    const buildCommand = commands.build;

    if (!buildCommand) {
      return "Error: Build command not found in configuration.";
    }

    try {
      const result = await model.task.invoke(
        "console",
        "exec",
        [model.task.getCwd()],
        [buildCommand]
      );

      let baseMessage = `Build command "${buildCommand}" executed successfully.`;
      let outputDetails = "";
      if (result.stdout) {
        outputDetails += `\nSTDOUT:\n${result.stdout}`;
      }
      if (result.stderr) {
        outputDetails += `\nSTDERR:\n${result.stderr}`;
      }
      if (!outputDetails) {
        baseMessage = `Build command "${buildCommand}" executed successfully with no output.`;
      }
      return (baseMessage + outputDetails).trim();
    } catch (error: any) {
      return `Error executing build command "${buildCommand}": ${
        error.message || error
      }`;
    }
  }
}
