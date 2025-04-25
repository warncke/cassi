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

    if (!status.isClean()) {
      console.error(
        "Git repository is not clean. Please commit or stash changes before proceeding."
      );
      process.exit(1);
    }

    const confirmPrompt = new Confirm(
      `Current branch is '${status.current}'. Continue?`
    );
    const promptContainer = new Prompt([confirmPrompt]);

    await this.cassi.user.prompt(promptContainer);

    if (!confirmPrompt.response) {
      console.log("Operation cancelled by user.");
      process.exit(0);
    }
  }
}
