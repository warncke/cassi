import { z } from "zod";
import path from "path";
import { Models } from "../Models.js";
import { ModelTool } from "./ModelTool.js";
import { ToolDefinition } from "../../tool/Tool.js";

const replaceInFileInputSchema = z.object({
  path: z
    .string()
    .describe(
      "The path of the file to modify (relative to the current working directory)"
    ),
  diff: z.string()
    .describe(`One or more SEARCH/REPLACE blocks following this exact format:
\`\`\`
<<<<<<< SEARCH
[exact content to find]
=======
[new content to replace with]
>>>>>>> REPLACE
\`\`\`
Critical rules:
1. SEARCH content must match the associated file section to find EXACTLY:
   * Match character-for-character including whitespace, indentation, line endings
   * Include all comments, docstrings, etc.
2. SEARCH/REPLACE blocks will ONLY replace the first match occurrence.
   * Including multiple unique SEARCH/REPLACE blocks if you need to make multiple changes.
   * Include *just* enough lines in each SEARCH section to uniquely match each set of lines that need to change.
   * When using multiple SEARCH/REPLACE blocks, list them in the order they appear in the file.
3. Keep SEARCH/REPLACE blocks concise:
   * Break large SEARCH/REPLACE blocks into a series of smaller blocks that each change a small portion of the file.
   * Include just the changing lines, and a few surrounding lines if needed for uniqueness.
   * Do not include long runs of unchanging lines in SEARCH/REPLACE blocks.
   * Each line must be complete. Never truncate lines mid-way through as this can cause matching failures.
4. Special operations:
   * To move code: Use two SEARCH/REPLACE blocks (one to delete from original + one to insert at new location)
   * To delete code: Use empty REPLACE section`),
});

export class ReplaceInFile extends ModelTool {
  static toolDefinition: ToolDefinition = {
    name: "REPLACE_IN_FILE",
    description:
      "Request to replace sections of content in an existing file using SEARCH/REPLACE blocks that define exact changes to specific parts of the file. This tool should be used when you need to make targeted changes to specific parts of a file.",
    inputSchema: replaceInFileInputSchema,
  };

  static async toolMethod(
    model: Models,
    input: z.infer<typeof replaceInFileInputSchema>
  ): Promise<string> {
    const fullPath = path.join(model.task.getCwd(), input.path);
    const diffBlocks = input.diff.split(
      /(<<<<<<< SEARCH\n[\s\S]*?\n=======[\s\S]*?\n>>>>>>> REPLACE)/g
    );

    let fileContent: string | null;
    try {
      fileContent = await model.task.invoke("fs", "readFile", [], [fullPath]);
      if (fileContent === null) {
        return `ERROR: REPLACE_IN_FILE failed. use WRITE_FILE with the full file contents instead`;
      }
    } catch (error: any) {
      return `ERROR: REPLACE_IN_FILE failed. use WRITE_FILE with the full file contents instead`;
    }

    let modifiedContent = fileContent as string;
    let replacementsMade = 0;
    let blockIndex = 0;

    for (const block of diffBlocks) {
      if (!block.trim()) continue;

      blockIndex++;

      const match = block.match(
        /^<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n?>>>>>>> REPLACE$/ // Make final newline optional
      );

      if (!match) {
        return `ERROR: REPLACE_IN_FILE failed. use WRITE_FILE with the full file contents instead`;
      }

      const searchContent = match[1];
      const replaceContent = match[2];

      const index = modifiedContent.indexOf(searchContent);

      if (index === -1) {
        return `ERROR: REPLACE_IN_FILE failed. use WRITE_FILE with the full file contents instead`;
      }

      modifiedContent =
        modifiedContent.substring(0, index) +
        replaceContent +
        modifiedContent.substring(index + searchContent.length);
      replacementsMade++;
    }

    if (modifiedContent === fileContent) {
      return `Warning: No effective changes resulted from the replacements in ${input.path}. File content remains identical.`;
    }

    try {
      await model.task.invoke(
        "fs",
        "writeFile",
        [],
        [fullPath, modifiedContent]
      );
      return modifiedContent;
    } catch (writeError: any) {
      return `ERROR: REPLACE_IN_FILE failed. use WRITE_FILE with the full file contents instead`;
    }
  }
}
