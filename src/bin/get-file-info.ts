#!/usr/bin/env node

import { Command } from "commander";
import path from "node:path";
import { FileInfo } from "../lib/file-info/FileInfo.js";

interface CliOptions {
  repositoryDir: string;
  worktreeDir?: string;
}

const program = new Command();

program
  .name("get-file-info")
  .description(
    "CLI tool to get cached or extracted file information using FileInfo"
  )
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
    "<infoType>",
    "The type of information to retrieve (e.g., ast, interface)"
  )
  .argument(
    "<fileName>",
    "Relative path to the file within the repository or worktree"
  )
  .action(async (infoType: string, fileName: string, options: CliOptions) => {
    try {
      const repoDir = path.resolve(options.repositoryDir);
      const worktreeDir = options.worktreeDir
        ? path.resolve(options.worktreeDir)
        : undefined;

      console.log(`Repository Dir: ${repoDir}`);
      if (worktreeDir) {
        console.log(`Worktree Dir:   ${worktreeDir}`);
      }
      console.log(`Info Type:      ${infoType}`);
      console.log(`File Name:      ${fileName}\n`);

      const repoFileInfo = new FileInfo(repoDir);

      let targetFileInfo: FileInfo;

      if (worktreeDir) {
        targetFileInfo = new FileInfo(repoDir, worktreeDir, repoFileInfo);
        console.log(`Requesting info from Worktree context...`);
      } else {
        targetFileInfo = repoFileInfo;
        console.log(`Requesting info from Repository context...`);
      }

      const result = await targetFileInfo.getInfo(infoType, fileName);

      if (result === null) {
        console.log(
          `\nResult: null (Info type '${infoType}' not found or provider returned null for '${fileName}')`
        );
      } else {
        console.log(`\nResult for '${infoType}' on '${fileName}':`);
        console.dir(result, { depth: null });
      }
    } catch (error: any) {
      console.error("\nAn error occurred:");
      console.error(error);
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch((err) => {
  console.error("Failed to parse arguments:", err);
  process.exit(1);
});
