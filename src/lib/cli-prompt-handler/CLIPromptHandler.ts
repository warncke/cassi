import { Prompt } from "../prompt/Prompt.js"; // Import the container class
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export class CLIPromptHandler {
  private promptSequence: Prompt; // Rename internal property

  constructor(promptSequence: Prompt) {
    // Accept the container Prompt object
    this.promptSequence = promptSequence;
  }

  async handlePrompt(): Promise<void> {
    const rl = readline.createInterface({ input, output });

    for (const prompt of this.promptSequence.prompts) {
      switch (prompt.type) {
        case "input": {
          const answer = await rl.question(`${prompt.message} `);
          prompt.response = answer;
          break;
        }
        case "confirm": {
          const answer = await rl.question(`${prompt.message} (y/N) `);
          prompt.response = /^[yY](es)?$/.test(answer);
          break;
        }
        default:
          // Optional: Handle unknown prompt types if necessary
          console.warn(
            `Unknown prompt type encountered: ${(prompt as any).type}`
          );
          break;
      }
    }
    rl.close();
  }
}
