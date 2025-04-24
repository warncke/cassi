import path from "path";
import { Cassi } from "../../cassi/Cassi.js";
import { Prompt } from "../../prompt/Prompt.js";
import Confirm from "../../prompt/prompts/Confirm.js";
import { Task } from "../Task.js";

export class ConfirmCwd extends Task {
  constructor(cassi: Cassi, parentTask: Task | null = null) {
    super(cassi, parentTask); // Pass parentTask to super
  }

  public async initTask(): Promise<void> {
    // Invoke the fs tool to get the current working directory, passing the task context
    const cwd = await this.cassi.tool.invoke(
      this, // Pass the current task instance
      "fs",
      "getCurrentWorkingDirectory"
    );

    // Resolve the potential repository directory against the current working directory
    const potentialRepoDir = path.resolve(
      cwd,
      this.cassi.repository.repositoryDir
    );

    const confirmPrompt = new Confirm(
      `Is this the correct repository directory? ${potentialRepoDir}`
    );
    console.log(`[ConfirmCwd] Calling user.prompt...`); // Log before calling prompt
    await this.cassi.user.prompt(new Prompt([confirmPrompt]));

    if (!confirmPrompt.response) {
      // TODO: Handle the case where the user denies the directory
      console.log("User denied the repository directory.");
      process.exit(1); // Or handle differently
    }

    // Set the repository directory to the confirmed absolute path
    this.cassi.repository.repositoryDir = potentialRepoDir;
  }
}
