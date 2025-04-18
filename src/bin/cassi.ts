#!/usr/bin/env node

import { Command } from "commander";
import { Cassi } from "../lib/cassi/Cassi.js";
import { User } from "../lib/user/User.js";

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

  async function promptFn(prompt: import("../lib/prompt/Prompt.js").Prompt) {
    const { CLIPromptHandler } = await import(
      "../lib/cli-prompt-handler/CLIPromptHandler.js"
    );
    const { Prompt } = await import("../lib/prompt/Prompt.js");
    for (const p of prompt.prompts) {
      const handler = new CLIPromptHandler(new Prompt([p]));
      await handler.handlePrompt();
    }
  }

  const user = new User(initFn, () => {
    return import("../lib/prompt/Prompt.js").then(({ Prompt }) => {
      return promptFn(new Prompt([]));
    });
  });
  const cassi = new Cassi(user, options.configFile, options.repositoryDir);
  await cassi.init();
}

run().catch((error) => {
  console.error(error);
});
