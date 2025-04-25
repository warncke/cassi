import path from "path";
import crypto from "crypto";
import { Task } from "../Task.js";
import { kebabCase } from "change-case";
import { Cassi } from "../../cassi/Cassi.js";
import { EvaluateCodePrompt } from "../../model/models/EvaluateCodePrompt.js";
import { Coder } from "./Coder.js";
import { gemini20Flash } from "@genkit-ai/googleai";

export class Code extends Task {
  public prompt: string;
  public evaluation: any;
  public taskId: string | null = null;
  public worktreeDir: string | undefined = undefined;

  constructor(cassi: Cassi, parentTask: Task | null, prompt: string) {
    super(cassi, parentTask);
    this.prompt = prompt;
  }

  private async initFileTask(): Promise<void> {
    const repoSlug = kebabCase(this.evaluation.summary);

    const hashInput = `${repoSlug}${Date.now()}`;
    const hash = crypto.createHash("sha256").update(hashInput).digest("base64");

    const alphanumericHash = hash.replace(/[^a-zA-Z0-9]/g, "");
    const id = alphanumericHash.substring(0, 8);

    this.taskId = `${id}-${repoSlug}`;

    this.worktreeDir = path.join(
      this.cassi.repository.repositoryDir,
      ".cassi",
      "workspaces",
      this.taskId
    );

    console.log(`Generated ID for file modification task: ${id}`);
    console.log(`Task ID set to: ${this.taskId}`);
    console.log(`Worktree directory set to: ${this.worktreeDir}`);

    await this.invoke(
      "git",
      "addWorktree",
      [this.cassi.repository.repositoryDir],
      [this.worktreeDir, this.taskId]
    );
    console.log(
      `Added worktree at ${this.worktreeDir} for branch ${this.taskId}`
    );

    await this.invoke("console", "exec", [this.getCwd()], ["npm install"]);
    console.log(
      `Created branch ${
        this.taskId
      } and installed dependencies in ${this.getCwd()}`
    );

    const formattedSteps = this.evaluation.steps
      .map((step: string) => `- ${step}`)
      .join("\n");
    const coderPrompt = `${this.prompt}\n\nSummary: ${this.evaluation.summary}\n\nSteps:\n${formattedSteps}`;
    this.addSubtask(new Coder(this.cassi, this, coderPrompt));
  }

  public async initTask(): Promise<void> {
    console.log("[Code Task] Starting initTask");
    const evaluateModel = this.newModel(
      "EvaluateCodePrompt"
    ) as EvaluateCodePrompt;

    const generateOptions = {
      model: gemini20Flash,
      prompt: this.prompt,
    };

    const evaluationJson = await evaluateModel.generate(generateOptions);

    this.evaluation = JSON.parse(evaluationJson);

    if (this.evaluation.modifiesFiles === true) {
      await this.initFileTask();
    } else {
      console.log(
        "Model response indicates no file modifications. Only file modification tasks are currently supported."
      );
    }
    console.log("[Code Task] Finished initTask");
  }

  public async cleanupTask(): Promise<void> {
    console.log("[Code Task] Starting cleanupTask");
    if (this.worktreeDir) {
      await this.invoke("git", "remWorkTree", [], [this.worktreeDir]);
      // await this.invoke("fs", "deleteDirectory", [], [this.worktreeDir]);
    }
    console.log("[Code Task] Finished cleanupTask");
  }
}
