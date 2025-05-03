import { Task } from "../Task.js";
import { Cassi } from "../../cassi/Cassi.js";
import { EvaluateCodePrompt } from "../../model/models/EvaluateCodePrompt.js";
import { GenerateModelOptions } from "../../model/Models.js";
import { Coder } from "./Coder.js";
import { Tester } from "./Tester.js";
import { RequirePassingTests } from "./RequirePassingTests.js";
import { GitCommitMerge } from "./GitCommitMerge.js";
import { gemini20Flash } from "@genkit-ai/googleai";

export class Code extends Task {
  public prompt: string;
  public evaluation: any;
  public taskId: string | null = null;

  constructor(cassi: Cassi, parentTask: Task | null, prompt: string) {
    super(cassi, parentTask);
    this.prompt = prompt;
  }

  private async initFileTask(): Promise<void> {
    this.setTaskId(this.evaluation.summary);

    if (!this.taskId) {
      throw new Error("Task ID was not set");
    }

    await this.initWorktree();

    this.addSubtask(new Coder(this.cassi, this, this.prompt));
    this.addSubtask(new Tester(this.cassi, this, ""));
    this.addSubtask(new RequirePassingTests(this.cassi, this));
    this.addSubtask(new GitCommitMerge(this.cassi, this));
  }

  public async initTask(): Promise<void> {
    console.log("[Code Task] Starting initTask");
    const evaluateModel = this.newModel(
      "EvaluateCodePrompt"
    ) as EvaluateCodePrompt;

    const generateOptions: GenerateModelOptions = {
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
    if (this.taskId) {
      await this.cassi.repository.remWorktree(this.taskId);
    } else {
      console.log(
        "[Code Task] No taskId found for cleanup, skipping worktree removal."
      );
    }
  }
}
