import { z } from "zod";
import path from "path";
import { Models } from "../Models.js";
import { ModelTool } from "./ModelTool.js";
import { ToolDefinition } from "../../tool/Tool.js";

const writeFileInputSchema = z.object({
  path: z
    .string()
    .describe(
      "The path of the file to write to (relative to the current working directory)"
    ),
  content: z
    .string()
    .describe(
      "The content to write to the file. ALWAYS provide the COMPLETE intended content of the file, without any truncation or omissions. You MUST include ALL parts of the file, even if they haven't been modified."
    ),
});

export class WriteFile extends ModelTool {
  static toolDefinition: ToolDefinition = {
    name: "WRITE_FILE",
    description:
      "Request to write content to a file at the specified path. If the file exists, it will be overwritten with the provided content. If the file doesn't exist, it will be created. This tool will automatically create any directories needed to write the file.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "The path of the file to write to (relative to the current working directory)",
        },
        content: {
          type: "string",
          description:
            "The content to write to the file. ALWAYS provide the COMPLETE intended content of the file, without any truncation or omissions. You MUST include ALL parts of the file, even if they haven't been modified.",
        },
      },
      required: ["path", "content"],
    },
  };

  static async toolMethod(
    model: Models,
    input: z.infer<typeof writeFileInputSchema>
  ): Promise<string> {
    const fullPath = path.join(model.task.getCwd(), input.path);
    await model.task.invoke("fs", "writeFile", [], [fullPath, input.content]);

    return input.content;
  }
}
