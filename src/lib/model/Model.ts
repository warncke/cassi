import { User } from "../user/User.js";
import { Config } from "../config/Config.js";
import { Models } from "./Models.js"; // Corrected import path
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { googleAI } from "@genkit-ai/googleai"; // Keep one googleAI import
import { ModelReference } from "genkit/model"; // Kept import for type usage elsewhere if needed
import { Task } from "../task/Task.js"; // Re-add Task import

// Helper to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the expected constructor signature for models stored in the map
type ModelConstructor = new (plugin: any, task: Task) => Models; // Keep task here as Models subclasses need it

export class Model {
  public availableModels: Map<string, ModelConstructor> = new Map(); // Use updated ModelConstructor
  // Task property removed

  constructor() {
    // Task parameter removed
    // No user/config needed here anymore
  }

  // Initialize available models for this instance
  async init(): Promise<void> {
    // Initialize models if the map is empty for this instance
    if (this.availableModels.size === 0) {
      console.log("Initializing available models for instance..."); // Updated log
      const modelsDir = path.join(__dirname, "models");
      console.log(`Reading models from directory: ${modelsDir}`); // Kept log
      try {
        const files = await fs.readdir(modelsDir);
        console.log(`Found files: ${files.join(", ")}`); // Added log
        for (const file of files) {
          console.log(`Checking file: ${file}`); // Added log
          // Look for .js files instead of .ts, excluding .test.js
          if (file.endsWith(".js") && !file.endsWith(".test.js")) {
            const modelPath = path.join(modelsDir, file);
            console.log(`Attempting to import model from: ${modelPath}`); // Added log
            // Convert file path to file URL for dynamic import
            const modelUrl = `file://${modelPath.replace(/\\/g, "/")}`;
            try {
              const module = await import(modelUrl);
              for (const key in module) {
                const exportedItem = module[key];
                // Check if it's a class, extends Models, and is not Models itself
                if (
                  typeof exportedItem === "function" &&
                  exportedItem.prototype instanceof Models && // Check against Models
                  exportedItem !== Models // Check against Models
                ) {
                  // Use instance property this.availableModels, casting to ModelConstructor
                  this.availableModels.set(
                    exportedItem.name,
                    exportedItem as ModelConstructor
                  );
                  console.log(`Loaded model: ${exportedItem.name}`); // Kept log
                }
              }
            } catch (importError) {
              console.error(
                // Keep existing error log
                `Error importing model from ${modelPath}:`,
                importError
              );
            }
          }
        }
      } catch (err) {
        console.error("Error reading models directory:", err);
        // Handle the error appropriately, maybe throw or log
      }
    }
  }

  /**
   * Creates a new instance of a specified model class.
   * Requires `init()` to be called first to populate available models.
   * @param modelClassName The name of the model class to instantiate.
   * @param modelClassName The name of the model class to instantiate.
   * @param task The task context for the new model instance. // Add task param doc
   * @returns A new instance of the specified model class (which extends Models).
   * @throws Error if the model class is not found in availableModels.
   */
  newInstance(modelClassName: string, task: Task): Models {
    // Add task parameter
    // Return Models
    const ModelClass = this.availableModels.get(modelClassName);
    if (!ModelClass) {
      throw new Error(`Model class '${modelClassName}' not found.`);
    }
    // Instantiate using the updated constructor signature (plugin and task)
    return new ModelClass(googleAI(), task); // Pass plugin and the provided task
  }
}
