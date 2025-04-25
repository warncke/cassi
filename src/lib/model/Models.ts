import { genkit, GenerateOptions, ModelReference, GenkitError } from "genkit";
import { Task } from "../task/Task.js";

export interface GenerateModelOptions extends GenerateOptions {
  model: ModelReference<any>;
  prompt: string | any[];
}

export abstract class Models {
  public ai: any;
  public task: Task;

  constructor(plugin: any, task: Task) {
    if (!plugin) {
      throw new GenkitError({
        source: "Models",
        status: "INVALID_ARGUMENT",
        message: "Genkit plugin must be provided to Models constructor.",
      });
    }
    this.ai = genkit({ plugins: [plugin] });
    this.task = task;
  }

  /**
   * Abstract method for generating content using a specific model.
   * Subclasses must implement this method.
   * @param options - Options for generation, including the prompt and model reference.
   * @returns A promise that resolves with the generated content as a string.
   */
  abstract generate(options: GenerateModelOptions): Promise<string>;
}
