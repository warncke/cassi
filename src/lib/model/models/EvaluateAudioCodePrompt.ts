import { z } from "genkit";
import { Models, GenerateModelOptions } from "../Models.js";
import { Task } from "../../task/Task.js";

const EvaluateAudioCodePromptSchema = z.object({
  summary: z.string(),
  modifiesFiles: z.boolean(),
  transcription: z.string(),
});
export class EvaluateAudioCodePrompt extends Models {
  constructor(plugin: any, task: Task) {
    super(plugin, task);
  }

  async generate(
    options: GenerateModelOptions & { audioBase64: string }
  ): Promise<string> {
    const { model, audioBase64, ...restOptions } = options;

    if (typeof audioBase64 !== "string") {
      throw new Error(
        "EvaluateAudioCodePrompt requires a base64 audio string."
      );
    }

    const { text } = await this.ai.generate({
      model: model,
      prompt: [
        {
          text: `
OUTPUT the following JSON object, substituting in the results of model queries for properties. use the audio provided as the CONTEXT (TASK DESCRIPTION) when generating text for JSON properties:
`,
        },
        { media: { url: `data:audio/ogg;base64,${audioBase64}` } },
        {
          text: `
The JSON object to OUTPUT is:
{
    "summary": "(( INSERT a 3-5 word summary of the TASK DESCRIPTION that is as short as possible. do not include an punctuation.))",
    "modifiesFiles" (( INSERT boolean true if the TASK DESCRIPTION involves creating or modifying files or false if it does not)),
     "transcription": "(( INSERT complete transcription of the audio TASK DESCRIPTION))"
}
`,
        },
      ],
      output: { schema: EvaluateAudioCodePromptSchema },
      ...restOptions,
    });

    return text ?? "";
  }
}
