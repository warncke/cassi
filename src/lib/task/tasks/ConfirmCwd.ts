import path from "path";
import { Cassi } from "../../cassi/Cassi.js";
import { Prompt } from "../../prompt/Prompt.js";
import Confirm from "../../prompt/prompts/Confirm.js";
import { Task } from "../Task.js";

export class ConfirmCwd extends Task {
  constructor(cassi: Cassi, parentTask: Task | null = null) {
    super(cassi, parentTask);
  }

  public async initTask(): Promise<void> {
    const cwd = await this.invoke("fs", "getCurrentWorkingDirectory", []);

    const potentialRepoDir = path.resolve(
      cwd,
      this.cassi.repository.repositoryDir
    );

    const confirmPrompt = new Confirm(
      `Is this the correct repository directory? ${potentialRepoDir}`
    );
    console.log(`[ConfirmCwd] Calling user.prompt...`);
    await this.cassi.user.prompt(new Prompt([confirmPrompt]));

    if (!confirmPrompt.response) {
      console.log("User denied the repository directory.");
      process.exit(1);
    }

    this.cassi.repository.repositoryDir = potentialRepoDir;
  }
}
