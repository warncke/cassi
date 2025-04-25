import { User } from "../user/User.js";
import { Config } from "../config/Config.js";
import { Models } from "./Models.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { googleAI } from "@genkit-ai/googleai";
import { ModelReference } from "genkit/model";
import { Task } from "../task/Task.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type ModelConstructor = new (plugin: any, task: Task) => Models;

export class Model {
  public availableModels: Map<string, ModelConstructor> = new Map();

  constructor() {
  }

  async init(): Promise<void> {
    if (this.availableModels.size === 0) {
      console.log("Initializing available models for instance...");
      const modelsDir = path.join(__dirname, "models");
      console.log(`Reading models from directory: ${modelsDir}`);
      try {
        const files = await fs.readdir(modelsDir);
        console.log(`Found files: ${files.join(", ")}`);
        for (const file of files) {
          console.log(`Checking file: ${file}`);
          if (file.endsWith(".js") && !file.endsWith(".test.js")) {
            const modelPath = path.join(modelsDir, file);
            console.log(`Attempting to import model from: ${modelPath}`);
            const modelUrl = `file://${modelPath.replace(/\\/g, "/")}`;
            try {
              const module = await import(modelUrl);
              for (const key in module) {
                const exportedItem = module[key];
                if (
                  typeof exportedItem === "function" &&
                  exportedItem.prototype instanceof Models &&
                  exportedItem !== Models
                ) {
                  this.availableModels.set(
                    exportedItem.name,
                    exportedItem as ModelConstructor
                  );
                  console.log(`Loaded model: ${exportedItem.name}`);
                }
              }
            } catch (importError) {
              console.error(
                `Error importing model from ${modelPath}:`,
                importError
              );
            }
          }
        }
      } catch (err) {
        console.error("Error reading models directory:", err);
      }
    }
  }

  /**
   * Creates a new instance of a specified model class.
   * Requires `init()` to be called first to populate available models.
   * @param modelClassName The name of the model class to instantiate.
   * @param modelClassName The name of the model class to instantiate.
   * @param task The task context for the new model instance.
   * @returns A new instance of the specified model class (which extends Models).
   * @throws Error if the model class is not found in availableModels.
   */
  newInstance(modelClassName: string, task: Task): Models {
    const ModelClass = this.availableModels.get(modelClassName);
    if (!ModelClass) {
      throw new Error(`Model class '${modelClassName}' not found.`);
    }
    return new ModelClass(googleAI(), task);
  }
}
