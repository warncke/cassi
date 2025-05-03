#!/usr/bin/env node

import { Command } from "commander";
import path from "node:path";
import { getInterfaces } from "../lib/model/context/getInterfaces.js";
import { FileInfo } from "../lib/file-info/FileInfo.js";
import type { Worktree } from "../lib/repository/Worktree.js"; // Import type only

interface CliOptions {
  repositoryDir: string;
  worktreeDir?: string;
}

const program = new Command();

program
  .name("get-context")
  .description("CLI tool to get context information for the model")
  .option(
    "-r, --repository-dir <path>",
    "Path to the repository root directory",
    process.cwd()
  )
  .option(
    "-w, --worktree-dir <path>",
    "Optional path to the worktree directory"
  )
  .argument(
    "<contextType>",
    "The type of context to retrieve (e.g., getInterfaces)"
  )
  .action(async (contextType: string, options: CliOptions) => {
    const contextFunctions: { [key: string]: Function } = {
      getInterfaces: getInterfaces,
    };

    try {
      const repoDir = path.resolve(options.repositoryDir);
      const worktreeDir = options.worktreeDir
        ? path.resolve(options.worktreeDir)
        : undefined;

      const contextFunction = contextFunctions[contextType];

      if (!contextFunction) {
        console.error(`Error: Unknown context type '${contextType}'`);
        process.exit(1);
      }

      const repoFileInfo = new FileInfo(repoDir);
      const targetDir = worktreeDir || repoDir;
      const targetFileInfo = worktreeDir
        ? new FileInfo(repoDir, worktreeDir, repoFileInfo)
        : repoFileInfo;

      // Create a mock Worktree object with only the properties needed by getInterfaces
      const mockWorktree = {
        worktreeDir: targetDir,
        fileInfo: targetFileInfo,
      } as unknown as Worktree; // Use type assertion

      const result = await contextFunction(mockWorktree);

      console.log(result);
    } catch (error: any) {
      console.error(`\nAn error occurred during ${contextType}:`);
      console.error(error);
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch((err) => {
  console.error("Failed to parse arguments:", err);
  process.exit(1);
});
