import { Task } from "../Task.js";
import { StatusResult } from "simple-git";
import { CommitMessage } from "../../model/models/CommitMessage.js";
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

    await this.invoke("git", "commitAll", [this.getCwd()], [commitMessage]);
  }
}
