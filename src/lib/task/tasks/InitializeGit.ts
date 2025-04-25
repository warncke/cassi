import { Task } from "../Task.js";
import { Cassi } from "../../cassi/Cassi.js";
import Confirm from "../../prompt/prompts/Confirm.js";
import { Prompt } from "../../prompt/Prompt.js"; // Import Prompt container

export class InitializeGit extends Task {
  // No constructor needed if it just calls super(cassi)
  // constructor(cassi: Cassi) {
  //   super(cassi); // Pass only cassi to the base constructor
  // }

  async initTask(): Promise<void> {
    // No try/catch needed here, let the base class handle errors
    const status = await this.invoke(
      "git",
      "status",
      [], // Keep empty toolArgs
      [this.cassi.repository.repositoryDir] // Pass repositoryDir inside methodArgs array
    );

    if (!status.isClean()) {
      console.error(
        "Git repository is not clean. Please commit or stash changes before proceeding."
      );
      process.exit(1);
    }

    // Create the specific prompt
    const confirmPrompt = new Confirm(
      `Current branch is '${status.current}'. Continue?`
    );
    // Create the prompt container and add the prompt
    const promptContainer = new Prompt([confirmPrompt]);

    // Call the user's prompt handler with the container
    await this.cassi.user.prompt(promptContainer);

    // Access the response from the specific prompt instance
    if (!confirmPrompt.response) {
      console.log("Operation cancelled by user.");
      process.exit(0); // Exit gracefully if user cancels
    }
    // No complete() or fail() methods exist on Task base class
  }
}
