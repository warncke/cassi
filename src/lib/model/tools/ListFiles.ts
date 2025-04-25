import { ToolDefinition } from "../../tool/Tool.js";
import { z } from "zod";
import { Models } from "../Models.js";
import { ModelTool } from "./ModelTool.js";
import { GlobOptions } from "glob";

export class ListFiles extends ModelTool {
  static parametersSchema = z.object({
    pattern: z
      .string()
      .describe(
        "The glob pattern to match files against (e.g., 'src/**/*.ts', '**/*.ts'). Defaults to '*'."
      )
      .optional()
      .default("*"),
  });

  static toolDefinition: ToolDefinition = {
    name: "LIST_FILES",
    description:
      "Lists files matching a glob pattern within the current working directory.",
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description:
            "The glob pattern to match files against (e.g., 'src/**/*.ts', '**/*.ts'). Defaults to '*'.",
        },
      },
      required: [], // pattern is optional with a default
    },
  };

  static async toolMethod(
    model: Models,
    params: z.infer<typeof ListFiles.parametersSchema>
  ): Promise<string> {
    const cwd = model.task.getCwd();
    let pattern = params.pattern;

    // Check if the pattern is a simple file extension pattern like *.ts
    const simplePatternRegex = /^\*\.\w+$/;
    if (simplePatternRegex.test(pattern)) {
      pattern = `**/${pattern}`; // Prepend **/ to search recursively
    }

    const options: GlobOptions = {
      cwd: cwd,
      nodir: true, // Usually, we want to list files, not directories
      ignore: ["node_modules/**", ".cassi/**", "dist/**"],
    };

    console.log(
      "ListFiles toolMethod cwd:",
      cwd,
      "pattern:",
      pattern,
      "options:",
      options
    );

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
