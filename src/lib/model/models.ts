import { genkit, ModelReference } from "genkit";

export class Models {
  protected ai: any; // Consider defining a more specific type if possible
  protected model: ModelReference<any>; // Store the model

  constructor(plugin: any, model: ModelReference<any>) {
    // Use 'any' for plugin type
    // Initialize genkit with the provided plugin
    this.ai = genkit({ plugins: [plugin] });
    this.model = model; // Store the model passed in constructor
  }
}
