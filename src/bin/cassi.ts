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

  const user = new User(initFn, () => {
    // The promptFn now handles the sequence, so just pass the Prompt object
    return import("../lib/prompt/Prompt.js").then(({ Prompt }) => {
      // Example: Create a Prompt sequence if needed, or pass an existing one
      // For now, assuming the User class expects a function that returns a promise
      // and the actual prompt sequence is determined elsewhere or is empty initially.
      // If the intention is to always prompt with an empty sequence here, it remains the same.
      // If a specific sequence should be prompted, it needs to be created here.
      const initialPromptSequence = new Prompt([]); // Example: empty sequence
      return promptFn(initialPromptSequence);
    });
  });
  const cassi = new Cassi(user, options.configFile, options.repositoryDir);
  await cassi.init();
}

run().catch((error) => {
  console.error(error);
});
