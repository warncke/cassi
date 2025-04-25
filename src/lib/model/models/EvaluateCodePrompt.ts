import { z } from "genkit"; // ModelReference is not needed directly here anymore
import { Models, GenerateModelOptions } from "../Models.js"; // Import the base class and options type
// Removed unused import 'prototype' from 'events'

const EvaluateCodePromptSchema = z.object({
  summary: z.string(),
  modifiesFiles: z.boolean(),
  steps: z.array(z.string()),
});
export class EvaluateCodePrompt extends Models {
  // Extend the base class
  constructor(plugin: any) {
    // Updated constructor: only takes plugin
    super(plugin); // Call the base class constructor with only the plugin
  }

  // Implement the abstract generate method from Models
  async generate(options: GenerateModelOptions): Promise<string> {
    const { model, prompt, ...restOptions } = options; // Destructure options

    // Ensure prompt is a string for this specific model's logic
    if (typeof prompt !== "string") {
      throw new Error("EvaluateCodePrompt requires a string prompt.");
    }

    const response = await this.ai.generate({
      model: model, // Use the model from options
      prompt: `
OUTPUT the following JSON object, substituting in the results of model queries for properties. use the following CONTEXT when generating text for JSON properties:

FILE TREE:

TASK DESCRIPTION:

${prompt}

The JSON object to OUTPUT is:
{
    "summary": "(( INSERT a 3-5 word summary of the TASK DESCRIPTION that is as short as possible. do not include an punctuation.))",
    "modifiesFiles" (( INSERT boolean true if the TASK DESCRIPTION involves creating or modifying files or false if it does not)),
    "steps": [
          "(( BREAK down the TASK DESCRIPTION into steps and insert a step string for each step in the task. do not include tasks for writing tests or committing changes.))"
     ]
}            
`,
      output: { schema: EvaluateCodePromptSchema },
      ...restOptions, // Pass any other generation options
    });

    // Extract and return the text content
    const text = response.text();
    if (!text) {
      console.warn("EvaluateCodePrompt response did not contain text content.");
      console.log("Full AI Response:", response.toJSON());
      return ""; // Or throw an error
    }
    return text;
  }
}
