#!/usr/bin/env node

import { Command } from "commander";
import { Cassi } from "../lib/cassi/Cassi.js";
import { User } from "../lib/user/User.js";
import Input from "../lib/prompt/prompts/Input.js";
import { Prompt } from "../lib/prompt/Prompt.js";
import { Server } from "../lib/server/Server.js";

const program = new Command();

program
  .option("-r, --repository-dir <path>", "repository directory", ".")
  .option("-c, --config-file <file>", "config file", "cassi.json")
  .option("-s, --server", "run in server mode");

program.parse(process.argv);

const options = program.opts<{
  repositoryDir: string;
  configFile: string;
  server?: boolean;
}>();

async function runCli() {
  async function initFn() {
    console.log("cassi cli starting");
  }

  async function promptFn(prompt: Prompt) {
    const { CLIPromptHandler } = await import(
      "../lib/cli-prompt-handler/CLIPromptHandler.js"
    );
    const handler = new CLIPromptHandler(prompt);
    await handler.handlePrompt();
  }

  const user = new User(initFn, promptFn);
  const cassi = new Cassi(user, options.configFile, options.repositoryDir);
  await cassi.init();
  cassi.newTask("InitializeRepository");

  while (true) {
    await cassi.runTasks();
    const inputPrompt = new Input("Enter your next request:");
    await cassi.user.prompt(inputPrompt);
    if (inputPrompt.response) {
      cassi.newTask("Code", undefined, inputPrompt.response);
    } else {
      console.log("No input received, exiting.");
      break;
    }
  }
}

async function runServer() {
  console.log("cassi server starting");
  const server = new Server();

  async function initFn() {}

  async function promptFn(prompt: Prompt) {
    server.addPrompt(prompt);
  }

  const user = new User(initFn, promptFn);
  const cassi = new Cassi(user, options.configFile, options.repositoryDir);
  await cassi.init();
  await server.init(cassi);
}

if (options.server) {
  runServer().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
} else {
  runCli().catch((error) => {
    console.error("CLI error:", error);
    process.exit(1);
  });
}
