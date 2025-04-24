import { ModelReference } from "genkit";
import { Models } from "../Models.js"; // Import the base class with .js extension

export class EvaluateCodePrompt extends Models {
  // Extend the base class
  constructor(plugin: any, model: ModelReference<any>) {
    super(plugin, model); // Call the base class constructor
  }

  // Example method showing how to use the inherited ai and model properties
  async generate(promptText: string) {
    // Model is now stored in the instance
    const response = await this.ai.generate({
      // Store the full response
      model: this.model, // Use the stored model
      prompt: promptText,
    });
    return response.text(); // Call the text() function
  }
}
