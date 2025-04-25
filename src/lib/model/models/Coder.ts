import { z } from "zod"; // Assuming zod is used for schema definition
import { Models, GenerateModelOptions } from "../Models.js";
import { Task } from "../../task/Task.js"; // Import Task
import { ExecuteCommand } from "../tools/ExecuteCommand.js"; // Import the new tool class

export class Coder extends Models {
  // Extend the base class
  public tools: any[]; // Define the tools property

  constructor(plugin: any, task: Task) {
    // Add task parameter
    // Updated constructor: takes plugin and task
    super(plugin, task); // Pass task to super

    this.tools = [
      this.ai.defineTool(...ExecuteCommand.modelToolArgs(this)),
      // Add other tool definitions here as needed
    ];
  }

  // Implement the abstract generate method from Models
  // Implement the abstract generate method from Models
  async generate(options: GenerateModelOptions): Promise<string> {
    const { model, prompt, ...restOptions } = options; // Destructure options

    // Use this.ai.generate which is initialized in the base class
    // Destructure text and usage directly from the response
    const { text, usage } = await this.ai.generate({
      model: model, // Pass the model reference
      prompt: `
You are CASSI, you specialize in developing typescript programs to run on node.js.

You have tools available to complete your tasks.

Take the original PROMPT, with its summary and suggested steps, evaluate each of those steps.

For each step evaluate what files may need to be changed in order to complete the step.

PROMPT: ${prompt}
      
`, // Pass the prompt
      tools: this.tools, // Pass the tools defined in this class
      ...restOptions, // Pass any other generation options
    });

    // text is now directly available

    // Log usage information if available
    if (usage) {
      console.log("AI Usage:", usage); // Log the destructured usage
      // TODO: Implement proper cost tracking based on usage
    }

    if (!text) {
      // Handle cases where the response might not have text (e.g., tool call)
      console.warn("AI response did not contain text content.");
      // Consider how to handle this - maybe return an empty string or throw an error
      // Cannot log full response anymore as 'response' variable is gone.
      return ""; // Or throw new Error("No text content in AI response");
    }
    return text;
  }
}
