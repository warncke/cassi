import { z } from "genkit";
import { Models, GenerateModelOptions } from "../Models.js";
import { Task } from "../../task/Task.js";

const EvaluateCodePromptSchema = z.object({
  summary: z.string(),
  modifiesFiles: z.boolean(),
});
export class EvaluateCodePrompt extends Models {
  constructor(plugin: any, task: Task) {
    super(plugin, task);
  }

  async generate(options: GenerateModelOptions): Promise<string> {
    const { model, prompt, ...restOptions } = options;

    if (typeof prompt !== "string") {
      throw new Error("EvaluateCodePrompt requires a string prompt.");
    }

    const { text } = await this.ai.generate({
      model: model,
      prompt: `
OUTPUT the following JSON object, substituting in the results of model queries for properties. use the following CONTEXT when generating text for JSON properties:

FILE TREE:

TASK DESCRIPTION:

${prompt}

The JSON object to OUTPUT is:
{
    "summary": "(( INSERT a 3-5 word summary of the TASK DESCRIPTION that is as short as possible. do not include an punctuation.))",
    "modifiesFiles" (( INSERT boolean true if the TASK DESCRIPTION involves creating or modifying files or false if it does not)),
}            
`,
      output: { schema: EvaluateCodePromptSchema },
      ...restOptions,
    });

    return text ?? "";
  }
}
