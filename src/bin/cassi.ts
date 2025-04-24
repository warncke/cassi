#!/usr/bin/env node

import { Command } from "commander";
import { Cassi } from "../lib/cassi/Cassi.js";
import { User } from "../lib/user/User.js";
import { InitializeRepository } from "../lib/task/tasks/InitializeRepository.js";
import Input from "../lib/prompt/prompts/Input.js";
import { Prompt } from "../lib/prompt/Prompt.js";
import { Code } from "../lib/task/tasks/Code.js";

const program = new Command();

program
  .option("-r, --repository-dir <path>", "repository directory", ".")
  .option("-c, --config-file <file>", "config file", "cassi.json");

program.parse(process.argv);

const options = program.opts();

async function run() {
  async function initFn() {
    console.log("cassi starting");
  }

  // Updated promptFn to handle the entire Prompt sequence at once
  async function promptFn(
    promptSequence: import("../lib/prompt/Prompt.js").Prompt
  ) {
    const { CLIPromptHandler } = await import(
      "../lib/cli-prompt-handler/CLIPromptHandler.js"
    );
    // Create one handler for the whole sequence
    const handler = new CLIPromptHandler(promptSequence);
    await handler.handlePrompt(); // Handle all prompts within the sequence
  }

  const user = new User(initFn, promptFn);
  const cassi = new Cassi(user, options.configFile, options.repositoryDir);
  await cassi.init();
  await cassi.newTask(new InitializeRepository(cassi));

  while (true) {
    await cassi.runTasks();
    const inputPrompt = new Input("Enter your next request:");
    const promptSequence = new Prompt([inputPrompt]);
    await cassi.user.prompt(promptSequence);
    if (inputPrompt.response) {
      await cassi.newTask(new Code(cassi, null, inputPrompt.response));
    } else {
      console.log("No input received, exiting.");
      break; // Exit the loop if no input is provided
    }
  }
}

run().catch((error) => {
  console.error(error);
});
