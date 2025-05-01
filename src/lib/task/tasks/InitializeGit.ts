import { Task } from "../Task.js";
import { Cassi } from "../../cassi/Cassi.js";
import Confirm from "../../prompt/prompts/Confirm.js";
import { Prompt } from "../../prompt/Prompt.js";

export class InitializeGit extends Task {
  async initTask(): Promise<void> {
    const status = await this.invoke(
      "git",
      "status",
      [],
      [this.cassi.repository.repositoryDir]
    );

    const confirmPrompt = new Confirm(
      `Current branch is '${status.current}'. Continue?`
    );

    await this.cassi.user.prompt(confirmPrompt);

    if (!confirmPrompt.response) {
      console.log("Operation cancelled by user.");
      process.exit(0);
    }
  }
}
