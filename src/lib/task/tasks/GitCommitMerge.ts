import { Task } from "../Task.js";
import { StatusResult } from "simple-git";
import { CommitMessage } from "../../model/models/CommitMessage.js";
import { Prompt } from "../../prompt/Prompt.js";
import Confirm from "../../prompt/prompts/Confirm.js";
import { gemini25FlashPreview0417 } from "@genkit-ai/googleai";

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
      model: gemini25FlashPreview0417,
      prompt: diff,
    };

    const text = await commitMessageModel.generate(generateOptions);

    const commitMessage = this.getTaskIdShort() + ": " + text;
    console.log("Generated Commit Message:", commitMessage);

    const confirmPrompt = new Confirm(
      `Do you want to commit the following changes with the message below?\n\nDiff:\n${diff}\n\nCommit Message:\n${commitMessage}`
    );
    await this.cassi.user.prompt(confirmPrompt);

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
