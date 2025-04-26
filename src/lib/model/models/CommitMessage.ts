import { Models, GenerateModelOptions } from "../Models.js";
import { Task } from "../../task/Task.js";

export class CommitMessage extends Models {
  constructor(plugin: any, task: Task) {
    super(plugin, task);
  }

  async generate(options: GenerateModelOptions): Promise<string> {
    const { model, prompt, ...restOptions } = options;

    if (typeof prompt !== "string") {
      throw new Error("CommitMessage requires a string prompt.");
    }

    const { text } = await this.ai.generate({
      model: model,
      prompt: `
<GIT_DIFF>
${prompt}
</GIT_DIFF>

Create a summary git commit message with a maximum 80 character description and a maximum of 5 bullet points to describe the GIT_DIFF as succinctly as possible, highlighting key changes in the commit. Do not include any "prefix:" like "feat:" or "bug:" on summary. Add bullet points with "*" and a single space after the "*" before the text for the bullet point.
`,
      ...restOptions,
    });

    return text ?? "";
  }
}
