import { Task } from "../Task.js";
import { Cassi } from "../../cassi/Cassi.js";
import { Coder as CoderModel } from "../../model/models/Coder.js";
import { gemini25ProPreview0325 } from "@genkit-ai/googleai";

export class Coder extends Task {
  public prompt: string;

  constructor(cassi: Cassi, parentTask: Task | null, prompt: string) {
    super(cassi, parentTask);
    this.prompt = prompt;
  }

  public async initTask(): Promise<void> {
    const modelInstance = this.newModel("Coder") as CoderModel;

    const generateOptions = {
      model: gemini25ProPreview0325,
      prompt: this.prompt,
    };

    await modelInstance.generate(generateOptions);
  }
}
