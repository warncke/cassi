import { ToolDefinition } from "../../tool/Tool.js";
import { z } from "zod";
import { Models } from "../Models.js";
import { ModelTool } from "./ModelTool.js";
import { GlobOptions } from "glob";

export class ListFiles extends ModelTool {
  static parametersSchema = z.object({});

  static toolDefinition: ToolDefinition = {
    name: "ListFiles",
    description:
      "Lists all *.ts and *.json files within the current working directory.",
    inputSchema: ListFiles.parametersSchema,
    outputSchema: z.string(),
  };

  static async toolMethod(model: Models): Promise<string> {
    const cwd = model.task.getCwd();
    const pattern = "**/*.{ts,json}";

    const options: GlobOptions = {
      cwd: cwd,
      nodir: true,
      ignore: ["node_modules/**", ".cassi/**", "dist/**"],
    };

    try {
      const files = (await model.task.invoke(
        "fs",
        "glob",
        [],
        [pattern, options]
      )) as string[];

      if (!Array.isArray(files)) {
        return "Error: Expected an array of file paths but received something else.";
      }
      if (files.length === 0) {
        return "Error: No Files Found";
      }
      return files.join("\n");
    } catch (error: any) {
      console.error("Error executing glob pattern:", error);
      return `Error executing glob pattern '${pattern}' in ${cwd}: ${error.message}`;
    }
  }
}
