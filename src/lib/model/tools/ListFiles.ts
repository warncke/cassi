import path from "path";
import { Models } from "../Models.js";
import { ModelTool } from "./ModelTool.js";
import { ToolDefinition } from "../../tool/Tool.js";
import { z } from "zod";
import * as fs from "fs/promises"; // Import fs promises for types

export class ListFiles extends ModelTool {
  static parametersSchema = z.object({
    path: z.string().describe("The path of the directory to list contents for"),
    recursive: z
      .boolean()
      .optional()
      .describe(
        "Whether to list files recursively. Use true for recursive listing, false or omit for top-level only."
      ),
  });

  static toolDefinition: ToolDefinition = {
    name: "list_files",
    description:
      "Lists files and directories within the specified directory. If recursive is true, it lists recursively.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The path of the directory to list contents for",
        },
        recursive: {
          type: "boolean",
          description:
            "Whether to list files recursively. Use true for recursive listing, false or omit for top-level only.",
        },
      },
      required: ["path"],
    },
  };

  static async toolMethod(
    model: Models,
    params: z.infer<typeof ListFiles.parametersSchema>
  ): Promise<string> {
    // Use empty string if params.path is undefined, resolving to cwd
    const targetPath = path.resolve(model.task.getCwd(), params.path || "");
    // Use inline type for options matching LocalFS.listDirectory signature
    const options:
      | {
          encoding?: BufferEncoding | null | undefined;
          withFileTypes?: false | undefined;
          recursive?: boolean | undefined;
        }
      | BufferEncoding
      | null
      | undefined = params.recursive ? { recursive: true } : undefined;

    console.log(
      "ListFiles toolMethod cwd:",
      model.task.getCwd(),
      "params.path:",
      params.path,
      "targetPath:",
      targetPath,
      "options:",
      options
    );

    try {
      // Note: listDirectory returns Promise<string[] | fs.Dirent[]>
      // We are casting to string[] based on the assumption that withFileTypes is not true in options.
      // If withFileTypes: true is needed later, this handling needs adjustment.
      const entries = (await model.task.invoke(
        "fs",
        "listDirectory",
        [],
        [targetPath, options]
      )) as string[];

      if (!Array.isArray(entries)) {
        return "Error: Expected an array of file/directory names but received something else.";
      }
      return entries.join("\n");
    } catch (error: any) {
      console.error("Error listing files/directories:", error);
      return `Error listing files/directories in ${targetPath}: ${error.message}`;
    }
  }
}
