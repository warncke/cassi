#!/usr/bin/env node

import { Command } from "commander";
import { Cassi } from "../lib/cassi/Cassi.js";
import { User } from "../lib/user/User.js";
import Input from "../lib/prompt/prompts/Input.js";
import { Prompt } from "../lib/prompt/Prompt.js";

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
  cassi.newTask("InitializeRepository");

  while (true) {
    await cassi.runTasks();
    const inputPrompt = new Input("Enter your next request:");
    const promptSequence = new Prompt([inputPrompt]);
    await cassi.user.prompt(promptSequence);
    if (inputPrompt.response) {
      cassi.newTask("Code", undefined, inputPrompt.response);
    } else {
      console.log("No input received, exiting.");
      break;
    }
  }
}

run().catch((error) => {
  console.error(error);
});
