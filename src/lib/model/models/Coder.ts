import { defineTool } from "@genkit-ai/ai"; // Keep one defineTool import
import { z } from "zod"; // Assuming zod is used for schema definition
import { Models, GenerateModelOptions } from "../Models.js";
// Removed incorrect import for standalone generate
import { Task } from "../../task/Task.js"; // Import Task

export class Coder extends Models {
  // Extend the base class
  public tools: any[]; // Define the tools property

  constructor(plugin: any, task: Task) {
    // Add task parameter
    // Updated constructor: takes plugin and task
    super(plugin, task); // Pass task to super

    // Define the input schema for the execute_command tool
    const executeCommandInputSchema = z.object({
      command: z.string().describe("The CLI command to execute."),
      requires_approval: z
        .boolean()
        .describe(
          "Whether the command requires explicit user approval before execution."
        ),
    });

    this.tools = [
      this.ai.defineTool(
        {
          name: "execute_command",
          description:
            "Request to execute a CLI command on the system. Use this when you need to perform system operations or run specific commands. Tailor your command to the user's system and provide a clear explanation of what the command does. Commands will be executed in the current working directory.",
          inputSchema: executeCommandInputSchema, // Use the defined schema constant
          outputSchema: z
            .string()
            .describe("The output of the command execution (stdout/stderr)."), // Assuming output is a string for now
        },
        async (input: z.infer<typeof executeCommandInputSchema>) => {
          // Placeholder for the actual command execution logic.
          // This function would typically interact with a system service
          // or library to run the command and capture its output.
          console.log(
            `Placeholder: Would execute command: ${input.command} (Requires Approval: ${input.requires_approval})`
          );
          // Simulate returning some output for now
          return `Simulated output for command: ${input.command}`;
        },
        {} // Pass empty options object as third argument
      ),
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
