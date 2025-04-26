import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import { Models } from "../Models.js";
import { ModelTool } from "./ModelTool.js";
import { ToolDefinition } from "../../tool/Tool.js";

const patchFileInputSchema = z.object({
  path: z
    .string()
    .describe(
      "The path of the file to patch (relative to the current working directory)"
    ),
  patchContent: z
    .string()
    .describe("The patch content, formatted as a standard .patch file diff."),
});

export class PatchFile extends ModelTool {
  static toolDefinition: ToolDefinition = {
    name: "PATCH_FILE",
    description:
      "Request to apply a patch to a file at the specified path using the Linux 'patch' command. The patch content should be provided as a string in the standard .patch format.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "The path of the file to patch (relative to the current working directory)",
        },
        patchContent: {
          type: "string",
          description:
            "The patch content, formatted as a standard .patch file diff.",
        },
      },
      required: ["path", "patchContent"],
    },
  };

  static async toolMethod(
    model: Models,
    input: z.infer<typeof patchFileInputSchema>
  ): Promise<string> {
    const fullPath = path.join(model.task.getCwd(), input.path);
    const command = `patch ${JSON.stringify(fullPath)}`;

    try {
      const result = (await model.task.invoke(
        "console",
        "exec",
        [],
        [command, input.patchContent]
      )) as { stdout: string; stderr: string; code: number | null };

      if (result.code !== 0) {
        throw new Error(
          `Patch command failed with exit code ${result.code}. Stderr:\n${result.stderr}`
        );
      }

      let outputMessage = `Patch applied successfully to ${input.path}.`;
      if (result.stdout) {
        outputMessage += `\nStdout:\n${result.stdout}`;
      }
      if (result.stderr) {
        outputMessage += `\nStderr:\n${result.stderr}`;
      }
      return outputMessage;
    } catch (error: any) {
      const errorDir = path.join(
        model.task.cassi.repository.repositoryDir,
        ".cassi",
        "errors",
        "patch"
      );
      const patchFilePath = path.join(errorDir, "patch.file");
      const origFilePath = path.join(errorDir, "orig.file");

      try {
        await fs.mkdir(errorDir, { recursive: true });

        await fs.writeFile(patchFilePath, input.patchContent);

        try {
          const originalContent = await fs.readFile(fullPath, "utf-8");
          await fs.writeFile(origFilePath, originalContent);
        } catch (readError: any) {
          await fs.writeFile(
            origFilePath,
            `Error reading original file: ${readError.message}`
          );
        }
      } catch (saveError: any) {
        console.error(
          `Failed to save patch error details: ${saveError.message}`
        );
      }

      return `Error applying patch: ${error.message}. Use WRITE_FILE tool to write the entire file instead.`;
    }
  }
}
