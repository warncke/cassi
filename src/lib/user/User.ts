import { Prompt } from "../prompt/Prompt.js";

export class User {
  initFn: () => Promise<void>;
  promptFn: (promptSequence: Prompt) => Promise<void>;

  constructor(
    initFn: () => Promise<void> = async () => {},
    promptFn: (promptSequence: Prompt) => Promise<void> = async () => {}
  ) {
    this.initFn = initFn;
    this.promptFn = promptFn;
  }

  async init(): Promise<void> {
    await this.initFn();
  }

  async prompt(prompt: Prompt): Promise<void> {
    await this.promptFn(prompt);
  }
}
