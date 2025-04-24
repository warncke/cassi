import { ModelReference } from "genkit";
import { Models } from "../Models.js"; // Import the base class with .js extension
import { prototype } from "events";

export class EvaluateCodePrompt extends Models {
  // Extend the base class
  constructor(plugin: any, model: ModelReference<any>) {
    super(plugin, model); // Call the base class constructor
  }

  // Example method showing how to use the inherited ai and model properties
  async generate(promptText: string) {
    // Model is now stored in the instance
    const { text } = await this.ai.generate({
      // Store the full response
      model: this.model, // Use the stored model
      prompt: `
Output the following JSON object, substituting in the results of model queries for properties. use the following text for context when generating text for JSON properties:

${promptText}

The JSON object to output is:
{
    "summary": "(( INSERT a 3-5 word summary that is as short as possible. do not include an punctuation.))",
    "modifiesFiles" (( INSERT boolean true if the task described involves creating or modifying files or false if it does not)),
    "steps": [
          "(( BREAK down the described task into steps and insert a step string for each step in the task. do not include tasks for writing tests or committing changes.))"
     ]
}            
`,
    });

    return text; // Call the text() function
  }
}
