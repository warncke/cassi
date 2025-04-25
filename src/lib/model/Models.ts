import { genkit, GenerateOptions, ModelReference, GenkitError } from "genkit";
import { Task } from "../task/Task.js"; // Import Task type with .js extension

// Define a standard structure for generate options, including the model
export interface GenerateModelOptions extends GenerateOptions {
  model: ModelReference<any>;
  prompt: string | any[]; // Allow string or structured prompt
}

export abstract class Models {
  public ai: any; // Consider defining a more specific type if possible
  public task: Task; // Add task property

  constructor(plugin: any, task: Task) {
    // Add task parameter
    // Use 'any' for plugin type
    // Initialize genkit with the provided plugin
    if (!plugin) {
      // Add a check for the plugin
      throw new GenkitError({
        source: "Models",
        status: "INVALID_ARGUMENT",
        message: "Genkit plugin must be provided to Models constructor.",
      });
    }
    this.ai = genkit({ plugins: [plugin] });
    this.task = task; // Assign task property
  }

  /**
   * Abstract method for generating content using a specific model.
   * Subclasses must implement this method.
   * @param options - Options for generation, including the prompt and model reference.
   * @returns A promise that resolves with the generated content as a string.
   */
  abstract generate(options: GenerateModelOptions): Promise<string>;
}
