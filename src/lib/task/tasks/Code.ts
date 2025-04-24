import { Task } from "../Task.js";
// Removed unused Prompt import
// import { Prompt } from "../../prompt/Prompt.js";
// Removed unused Input import
// import Input from "../../prompt/prompts/Input.js"; // Changed to default import
import { Cassi } from "../../cassi/Cassi.js"; // Import Cassi
import { EvaluateCodePrompt } from "../../model/models/EvaluateCodePrompt.js"; // Import EvaluateCodePrompt

export class Code extends Task {
  public prompt: string; // Added prompt property

  // Added cassi and parentTask to constructor
  constructor(cassi: Cassi, parentTask: Task | null, prompt: string) {
    super(cassi, parentTask); // Pass arguments to super()
    this.prompt = prompt; // Initialize prompt property
  }

  public async initTask(): Promise<void> {
    // Instantiate the EvaluateCodePrompt model and assert its type
    const model = this.newModel("EvaluateCodePrompt") as EvaluateCodePrompt;
    // Generate the response using the model and the provided prompt
    const response = await model.generate(this.prompt);
    // Log the response
    console.log("Model response:", response);
  }
}
