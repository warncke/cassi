import { Task } from "../Task.js";
import { Cassi } from "../../cassi/Cassi.js";
import { EvaluateAudioCodePrompt } from "../../model/models/EvaluateAudioCodePrompt.js";
import { GenerateModelOptions } from "../../model/Models.js";
import { Coder } from "./Coder.js";
import { Tester } from "./Tester.js";
import { RequirePassingTests } from "./RequirePassingTests.js";
import { GitCommitMerge } from "./GitCommitMerge.js";
import { gemini20Flash } from "@genkit-ai/googleai";

export class AudioCode extends Task {
  public audioBase64: string;
  public evaluation: any;
  public taskId: string | null = null;

  constructor(cassi: Cassi, parentTask: Task | null, audioBase64: string) {
    super(cassi, parentTask);
    this.audioBase64 = audioBase64;
  }

  private async initFileTask(): Promise<void> {
    this.setTaskId(this.evaluation.summary);

    if (!this.taskId) {
      throw new Error("Task ID was not set");
    }

    await this.initWorktree();

    this.addSubtask(new Coder(this.cassi, this, this.evaluation.transcription));
    this.addSubtask(new Tester(this.cassi, this, ""));
    this.addSubtask(new RequirePassingTests(this.cassi, this));
    this.addSubtask(new GitCommitMerge(this.cassi, this));
  }

  public async initTask(): Promise<void> {
    console.log("[AudioCode Task] Starting initTask");
    const evaluateModel = this.newModel(
      "EvaluateAudioCodePrompt"
    ) as EvaluateAudioCodePrompt;

    const generateOptions = {
      model: gemini20Flash,
      audioBase64: this.audioBase64,
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
    console.log("[AudioCode Task] Finished initTask");
  }

  public async cleanupTask(): Promise<void> {
    if (this.taskId) {
      await this.cassi.repository.remWorktree(this.taskId);
    } else {
      console.log(
        "[AudioCode Task] No taskId found for cleanup, skipping worktree removal."
      );
    }
  }
}
