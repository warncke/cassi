import { z } from "zod";
import path from "path";
import { Models } from "../Models.js";
import { ModelTool } from "./ModelTool.js";
import { ToolDefinition } from "../../tool/Tool.js";

const readFileInputSchema = z.object({
  path: z
    .string()
    .describe(
      "The path of the file to read (relative to the current working directory)"
    ),
});

export class ReadFile extends ModelTool {
  static toolDefinition: ToolDefinition = {
    name: "ReadFile",
    description:
      "Request to read the contents of a file at the specified path. Use this when you need to examine the contents of an existing file you do not know the contents of, for example to analyze code, review text files, or extract information from configuration files. Automatically extracts raw text from PDF and DOCX files. May not be suitable for other types of binary files, as it returns the raw content as a string.",
    inputSchema: readFileInputSchema,
    outputSchema: z.string(),
  };

  static async toolMethod(
    model: Models,
    input: z.infer<typeof readFileInputSchema>
  ): Promise<string> {
    const fullPath = path.join(model.task.getCwd(), input.path);
    try {
      const content = await model.task.invoke("fs", "readFile", [], [fullPath]);
      return content ?? "File read successfully, but it was empty.";
    } catch (error: any) {
      if (
        error instanceof Error &&
        error.message.includes("ENOENT: no such file or directory")
      ) {
        return "File does not exist";
      }
      throw error;
    }
  }
}
