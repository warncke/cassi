import { Prompt } from "../prompt/Prompt.js";

export class CLIPromptHandler {
  private prompt: Prompt;

  constructor(prompt: Prompt) {
    this.prompt = prompt;
  }

  async handlePrompt(): Promise<void> {}
}
