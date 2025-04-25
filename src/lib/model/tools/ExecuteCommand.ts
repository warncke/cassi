import { z } from "zod";
import { Models } from "../Models.js";
import { ModelTool } from "./ModelTool.js";
import { ToolDefinition } from "../../tool/Tool.js";

const executeCommandInputSchema = z.object({
  command: z.string().describe("The CLI command to execute."),
  requires_approval: z
    .boolean()
    .describe(
      "Whether the command requires explicit user approval before execution."
    ),
});

export class ExecuteCommand extends ModelTool {
  static toolDefinition: ToolDefinition = {
    name: "EXECUTE_COMMAND",
    description:
      "Request to execute a CLI command on the system. Use this when you need to perform system operations or run specific commands. Tailor your command to the user's system and provide a clear explanation of what the command does. Commands will be executed in the current working directory.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The CLI command to execute.",
        },
        requires_approval: {
          type: "boolean",
          description:
            "Whether the command requires explicit user approval before execution.",
        },
      },
      required: ["command", "requires_approval"],
    },
  };

  static async toolMethod(
    model: Models,
    input: z.infer<typeof executeCommandInputSchema>
  ): Promise<string> {
    const result = await model.task.invoke(
      "console",
      "exec",
      [model.task.getCwd()],
      [input.command]
    );

    let output = "";
    if (result.stdout) {
      output += `STDOUT:\n${result.stdout}\n`;
    }
    if (result.stderr) {
      output += `STDERR:\n${result.stderr}\n`;
    }
    return output.trim() || "Command executed successfully with no output.";
  }
}
