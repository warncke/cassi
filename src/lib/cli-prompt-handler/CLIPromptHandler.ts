import { Prompt } from "../prompt/Prompt.js"; // Updated import
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import Input from "../prompt/prompts/Input.js"; // Keep specific types if needed
import Confirm from "../prompt/prompts/Confirm.js"; // Keep specific types if needed

export class CLIPromptHandler {
  private prompt: Prompt; // Renamed property and updated type

  constructor(prompt: Prompt) {
    // Updated constructor parameter type
    this.prompt = prompt;
  }

  async handlePrompt(): Promise<void> {
    const rl = readline.createInterface({ input, output });
    const prompt = this.prompt;

    if (prompt instanceof Input) {
      const answer = await rl.question(`${prompt.message} `);
      prompt.response = answer;
    } else if (prompt instanceof Confirm) {
      const answer = await rl.question(`${prompt.message} (y/N) `);
      prompt.response = /^[yY](es)?$/.test(answer);
    } else {
      // Handle unexpected prompt types
      console.warn(
        `Unknown prompt type encountered: ${
          Object.getPrototypeOf(prompt)?.constructor?.name
        }`
      );
    }

    rl.close();
  }
}
