import { Task } from "../Task.js";
import { Cassi } from "../../cassi/Cassi.js";
import { Coder as CoderModel } from "../../model/models/Coder.js"; // Import Coder model
import { gemini15Flash } from "@genkit-ai/googleai"; // Import the specific model reference

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
    const modelInstance = this.newModel("Coder") as CoderModel; // Renamed variable for clarity

    // Prepare options for the generate method
    const generateOptions = {
      model: gemini15Flash, // Use the imported model reference
      prompt: this.prompt,
      // Add any other GenerateOptions if needed, e.g., temperature, maxOutputTokens
      // config: { temperature: 0.7 } // Example
    };

    // Generate the response using the model and the prepared options
    const generatedCode = await modelInstance.generate(generateOptions); // Pass the options object

    // Log the generated code
    console.log("--- Generated Code ---");
    console.log(generatedCode);
    console.log("----------------------");
    // TODO: Implement logic to apply the generated code (e.g., write to files)
  }
}
