import { Task } from "../Task.js";
import { Cassi } from "../../cassi/Cassi.js";
import { Coder as CoderModel } from "../../model/models/Coder.js";
import { gemini15Flash } from "@genkit-ai/googleai";

export class Coder extends Task {
  public prompt: string;

  constructor(cassi: Cassi, parentTask: Task | null, prompt: string) {
    super(cassi, parentTask);
    this.prompt = prompt;
  }

  public async initTask(): Promise<void> {
    console.log(`Coder task initializing...`);
    const modelInstance = this.newModel("Coder") as CoderModel;

    const generateOptions = {
      model: gemini15Flash,
      prompt: this.prompt,
    };

    const generatedCode = await modelInstance.generate(generateOptions);

    console.log("--- Generated Code ---");
    console.log(generatedCode);
    console.log("----------------------");
  }
}
