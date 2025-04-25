import { Task } from "../Task.js";
import { Cassi } from "../../cassi/Cassi.js";
import { Coder as CoderModel } from "../../model/models/Coder.js"; // Import Coder model

export class Coder extends Task {
  public prompt: string; // Added prompt property based on Code class

  // Constructor with the same signature as Code class
  constructor(cassi: Cassi, parentTask: Task | null, prompt: string) {
    super(cassi, parentTask); // Pass arguments to super()
    this.prompt = prompt; // Initialize prompt property
  }

  public async initTask(): Promise<void> {
    console.log(`Coder task initializing...`);
    // Instantiate the Coder model
    const model = this.newModel("Coder") as CoderModel;
    // Generate the response using the model and the task's prompt
    const generatedCode = await model.generate(this.prompt);
    // Log the generated code
    console.log("--- Generated Code ---");
    console.log(generatedCode);
    console.log("----------------------");
    // TODO: Implement logic to apply the generated code (e.g., write to files)
  }
}
