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
    const rawResponse = await model.generate(this.prompt);

    try {
      // Parse the JSON response
      const response = JSON.parse(rawResponse);

      // Check the modifiesFiles property
      if (response.modifiesFiles === true) {
        // TODO: Implement file modification logic here
        // For now, just log that it's proceeding
        console.log("Model indicates file modifications. Proceeding...");
      } else {
        // Log that only file modification tasks are supported
        console.log(
          "Model response indicates no file modifications. Only file modification tasks are currently supported."
        );
        // Potentially throw an error or handle this case appropriately
      }
    } catch (error) {
      console.error("Failed to parse model response:", error);
      // Handle JSON parsing error
      // Maybe throw an error or log a more specific message
      throw new Error(`Failed to parse model response: ${rawResponse}`);
    }
  }
}
