import { Task } from "../Task.js";
import { StatusResult } from "simple-git";
import { CommitMessage } from "../../model/models/CommitMessage.js";
import { Prompt } from "../../prompt/Prompt.js";
import Confirm from "../../prompt/prompts/Confirm.js"; // Default import
import { gemini25FlashPreview0417 } from "@genkit-ai/googleai"; // Import the requested model

export class GitCommitMerge extends Task {
  async initTask(): Promise<void> {
    console.log("[GitCommitMerge Task] Starting initTask");
    const status = (await this.invoke("git", "status", [
      this.getCwd(),
    ])) as StatusResult;

    if (status.isClean()) {
      console.log("No changes to commit");
      return;
    }

    const diff = (await this.invoke("git", "diff", [this.getCwd()])) as string;

    const commitMessageModel = this.newModel("CommitMessage") as CommitMessage;

    const generateOptions = {
      model: gemini25FlashPreview0417, // Use the requested model reference
      prompt: diff,
    };

    const text = await commitMessageModel.generate(generateOptions);

    const commitMessage = this.getTaskIdShort() + ": " + text;
    console.log("Generated Commit Message:", commitMessage);

    // Prompt user for confirmation
    const confirmPrompt = new Confirm(
      `Do you want to commit the following changes with the message below?\n\nDiff:\n${diff}\n\nCommit Message:\n${commitMessage}`
    );
    // Send the prompt to the user. Assume the prompt handler (e.g., CLIPromptHandler)
    // will throw an error or exit if the user denies the confirmation.
    await this.cassi.user.prompt(confirmPrompt);

    // If prompt didn't throw/exit, proceed with commit
    console.log(
      "Commit confirmed by user (or prompt handler allows proceeding). Committing..."
    );
    await this.invoke("git", "commitAll", [this.getCwd()], [commitMessage]);

    try {
      const rebaseResult = await this.invoke(
        "git",
        "rebase",
        [this.getCwd()],
        [this.getWorkTree().repositoryBranch]
      );
    } catch (error) {
      throw new Error(
        `Error during rebase for ${this.getCwd()}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    await this.invoke("git", "merge", [], [this.getTaskId()]);
  }
}
