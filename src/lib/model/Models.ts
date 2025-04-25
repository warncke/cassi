import { genkit, GenerateOptions, ModelReference, GenkitError } from "genkit"; // Import GenkitError from main package

// Define a standard structure for generate options, including the model
export interface GenerateModelOptions extends GenerateOptions {
  model: ModelReference<any>;
  prompt: string | any[]; // Allow string or structured prompt
}

export abstract class Models {
  protected ai: any; // Consider defining a more specific type if possible

  constructor(plugin: any) {
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
  }

  /**
   * Abstract method for generating content using a specific model.
   * Subclasses must implement this method.
   * @param options - Options for generation, including the prompt and model reference.
   * @returns A promise that resolves with the generated content as a string.
   */
  abstract generate(options: GenerateModelOptions): Promise<string>;
}
