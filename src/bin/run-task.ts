#!/usr/bin/env node

import { Command } from "commander";
import * as fs from "fs";
import path from "path";
import { Cassi } from "../lib/cassi/Cassi.js";
import { User } from "../lib/user/User.js";
import { Task } from "../lib/task/Task.js";
import { Worktree } from "../lib/repository/Worktree.js";

const program = new Command();

program
  .option("-r, --repository-dir <path>", "repository directory", ".")
  .option("-w, --worktree-dir <path>", "worktree directory")
  .option("-c, --config-file <file>", "config file", "cassi.json");

program.parse(process.argv);

const options = program.opts();

async function run() {
  if (!options.worktreeDir) {
    throw new Error("worktree-dir is required");
  }

  let absoluteWorktreeDir = options.worktreeDir;
  if (!path.isAbsolute(absoluteWorktreeDir)) {
    absoluteWorktreeDir = path.join(
      options.repositoryDir,
      ".cassi",
      "worktrees",
      options.worktreeDir
    );
  }

  const taskId = path.basename(absoluteWorktreeDir);

  if (!fs.existsSync(absoluteWorktreeDir)) {
    throw new Error(
      `Worktree directory does not exist: ${absoluteWorktreeDir}`
    );
  }

  async function initFn() {
    console.log("cassi starting");
  }

  async function promptFn(
    promptSequence: import("../lib/prompt/Prompt.js").Prompt
  ) {
    const { CLIPromptHandler } = await import(
      "../lib/cli-prompt-handler/CLIPromptHandler.js"
    );
    const handler = new CLIPromptHandler(promptSequence);
    await handler.handlePrompt();
  }

  const user = new User(initFn, promptFn);
  const cassi = new Cassi(user, options.configFile, options.repositoryDir);
  await cassi.init();

  const task = new Task(cassi);
  task.taskId = taskId;

  const worktree = new Worktree(cassi.repository, task, absoluteWorktreeDir);
  task.worktree = worktree;

  await cassi.repository.addWorktree(worktree);

  console.log(
    `Cassi initialized for worktree: ${absoluteWorktreeDir} (Task ID: ${taskId})`
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
