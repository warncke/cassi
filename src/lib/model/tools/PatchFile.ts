import { z } from "zod";
import path from "path";
import fs from "fs/promises"; // Import fs.promises
import { Models } from "../Models.js";
import { ModelTool } from "./ModelTool.js";
import { ToolDefinition } from "../../tool/Tool.js";
// No longer need ExecuteCommand directly
// import { ExecuteCommand } from "./ExecuteCommand.js";

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
    const command = `patch ${JSON.stringify(fullPath)}`; // Ensure path is quoted

    try {
      // Invoke the console tool's exec method with stdin data
      const result = (await model.task.invoke(
        "console", // Tool name
        "exec", // Method name
        [], // Tool constructor args (LocalConsole takes cwd, handled by Tool system)
        [command, input.patchContent] // Method args: command, stdinData
      )) as { stdout: string; stderr: string; code: number | null }; // Cast result

      if (result.code !== 0) {
        throw new Error(
          `Patch command failed with exit code ${result.code}. Stderr:\n${result.stderr}`
        );
      }

      // Consider stderr as potential warnings even on success
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
        // Ensure the error directory exists using fs.promises
        await fs.mkdir(errorDir, { recursive: true });

        // Save the patch content using fs.promises
        await fs.writeFile(patchFilePath, input.patchContent);

        // Attempt to read and save the original file content using fs.promises
        try {
          const originalContent = await fs.readFile(fullPath, "utf-8"); // Assuming utf-8
          await fs.writeFile(origFilePath, originalContent);
        } catch (readError: any) {
          // If reading the original file fails, save the read error instead using fs.promises
          await fs.writeFile(
            origFilePath,
            `Error reading original file: ${readError.message}`
          );
        }
      } catch (saveError: any) {
        // Log if saving the error files fails, but still return the original error
        console.error(
          `Failed to save patch error details: ${saveError.message}`
        );
      }

      return `Error applying patch: ${error.message}. Use WRITE_FILE tool to write the entire file instead.`;
    }
  }
}
