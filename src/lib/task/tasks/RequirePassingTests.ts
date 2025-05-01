import { Task } from "../Task.js";
import { Cassi } from "../../cassi/Cassi.js";
import Confirm from "../../prompt/prompts/Confirm.js";
import { Prompt } from "../../prompt/Prompt.js";

export class RequirePassingTests extends Task {
  async initTask(): Promise<void> {
    const cassi = this.cassi;
    const configData = cassi.config.configData;

    if (!configData) {
      throw new Error("Configuration data not found.");
    }

    const commands = configData.commands;
    if (!commands) {
      throw new Error("Commands configuration not found.");
    }

    const testCommand = commands.test;
    if (!testCommand) {
      throw new Error("Test command not found in configuration.");
    }

    while (true) {
      const result = await this.invoke(
        "console",
        "exec",
        [this.getCwd()],
        [testCommand + " -- --reporter=tap"]
      );

      if (result.stdout.includes("not ok")) {
        const confirmPrompt = new Confirm(
          `Tests not passing in ${this.getCwd()}. Fix and press y to continue`
        );
        await cassi.user.prompt(confirmPrompt);

        if (confirmPrompt.response === false) {
          throw new Error("Task aborted by user.");
        }
      } else {
        break;
      }
    }
  }
}
