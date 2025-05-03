import { z } from "zod";
import path from "path";
import { Models } from "../Models.js";
import { ModelTool } from "./ModelTool.js";
import { ToolDefinition } from "../../tool/Tool.js";

const replaceInFileInputSchema = z.object({
  path: z.string().describe("The path of the file to modify"),
  find: z.string().describe("The exact string to find in the file"),
  replace: z
    .string()
    .describe("The string to replace the first occurrence of `find` with"),
});

export class ReplaceInFile extends ModelTool {
  static toolDefinition: ToolDefinition = {
    name: "REPLACE_IN_FILE",
    description:
      "Request to replace content in an existing file. This tool should be used when you need to make targeted changes to specific parts of a file.",
    inputSchema: replaceInFileInputSchema,
    outputSchema: z.literal("OK").or(z.literal("ERROR")),
  };

  static async toolMethod(
    model: Models,
    input: z.infer<typeof replaceInFileInputSchema>
  ): Promise<string> {
    const fullPath = path.join(model.task.getCwd(), input.path);
    const { find, replace } = input;

    let fileContent: string | null;
    try {
      fileContent = await model.task.invoke("fs", "readFile", [], [fullPath]);
      if (fileContent === null) {
        return "ERROR";
      }
    } catch (error: any) {
      return "ERROR";
    }

    const index = fileContent.indexOf(find);

    if (index === -1) {
      return "ERROR";
    }

    const modifiedContent =
      fileContent.substring(0, index) +
      replace +
      fileContent.substring(index + find.length);

    try {
      await model.task.invoke(
        "fs",
        "writeFile",
        [],
        [fullPath, modifiedContent]
      );
      return "OK";
    } catch (writeError: any) {
      return "ERROR";
    }
  }
}
