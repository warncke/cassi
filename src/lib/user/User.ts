export class User {
  initFn: () => Promise<void>;
  promptFn: () => Promise<void>;

  constructor(
    initFn: () => Promise<void> = async () => {},
    promptFn: () => Promise<void> = async () => {}
  ) {
    this.initFn = initFn;
    this.promptFn = promptFn;
  }

  async init(): Promise<void> {
    await this.initFn();
  }
}
