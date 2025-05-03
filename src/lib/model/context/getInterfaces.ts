import { glob } from "glob";
import path from "path";
import { Worktree } from "../../repository/Worktree.js";
import { FileInfo } from "../../file-info/FileInfo.js";

export async function getInterfaces(worktree: Worktree): Promise<string> {
  const files = await glob("**/*.ts", {
    cwd: worktree.worktreeDir,
    ignore: ["node_modules/**", ".cassi/**", "dist/**"],
    absolute: true,
  });

  const interfacePrompts: string[] = [];

  for (const file of files) {
    const relativePath = path.relative(worktree.worktreeDir, file);
    if (relativePath.endsWith(".test.ts")) {
      continue;
    }

    try {
      const fileInfo = worktree.fileInfo;
      const interfacePrompt = await fileInfo.getInfo<string>(
        "interfacePrompt",
        relativePath
      );
      if (interfacePrompt) {
        interfacePrompts.push(interfacePrompt);
      }
    } catch (error) {
      console.error(`Error processing file ${relativePath}:`, error);
      // Optionally re-throw or handle specific errors
    }
  }

  if (interfacePrompts.length === 0) {
    return ""; // Return empty string if no interfaces found
  }

  return `===== BEGIN FILE_INTERFACES =====\n${interfacePrompts.join(
    "\n\n--- FILE_SEPARATOR ---\n\n"
  )}\n===== END FILE_INTERFACES =====`;
}
