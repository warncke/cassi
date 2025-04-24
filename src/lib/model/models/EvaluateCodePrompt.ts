import { ModelReference, z } from "genkit";
import { Models } from "../Models.js"; // Import the base class with .js extension
import { prototype } from "events";

const EvaluateCodePromptSchema = z.object({
  summary: z.string(),
  modifiesFiles: z.boolean(),
  steps: z.array(z.string()),
});
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
OUTPUT the following JSON object, substituting in the results of model queries for properties. use the following CONTEXT when generating text for JSON properties:

FILE TREE:

TASK DESCRIPTION:

${promptText}

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
    });

    // Call the text function to get the actual string response
    return text;
  }
}
