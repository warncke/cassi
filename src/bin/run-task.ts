#!/usr/bin/env node

import { Command } from "commander";
import * as fs from "fs";
import path from "path";
import { Cassi } from "../lib/cassi/Cassi.js";
import { User } from "../lib/user/User.js";
import { Task } from "../lib/task/Task.js";
import { Worktree } from "../lib/repository/Worktree.js";
import { Prompt } from "../lib/prompt/Prompt.js"; // Added Prompts import

const program = new Command();

program
  .option("-r, --repository-dir <path>", "repository directory", ".")
  .option("-w, --worktree-dir <path>", "worktree directory")
  .option("-c, --config-file <file>", "config file", "cassi.json")
  .argument("<taskName>", "name of the task to run")
  .argument("[taskArgs...]", "arguments for the task");

program.parse(process.argv);

const options = program.opts();
const [taskName, ...taskArgs] = program.args;

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

  async function promptFn(prompt: Prompt) {
    // Updated type here
    const { CLIPromptHandler } = await import(
      "../lib/cli-prompt-handler/CLIPromptHandler.js"
    );
    const handler = new CLIPromptHandler(prompt); // Updated variable name
    await handler.handlePrompt();
  }

  const user = new User(initFn, promptFn);
  const cassi = new Cassi(user, options.configFile, options.repositoryDir);
  await cassi.init();

  const task = new Task(cassi);
  task.taskId = taskId;

  const worktree = new Worktree(cassi.repository, task, absoluteWorktreeDir);
  await worktree.initRepositoryBranch();
  task.worktree = worktree;
  cassi.repository.addWorktree(worktree);

  console.log(
    `Cassi initialized for worktree: ${absoluteWorktreeDir} (Task ID: ${taskId})`
  );

  const newTask = cassi.task.newTask(taskName, task, ...taskArgs);
  task.addSubtask(newTask); // Add the new task as a subtask
  await task.run(); // Run the main task (which will run the subtask)
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
