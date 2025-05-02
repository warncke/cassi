import {
  genkit,
  GenerateOptions,
  ModelReference,
  GenkitError,
  ToolResponsePart,
  ToolRequestPart,
} from "genkit";
import { Task } from "../task/Task.js";
import { ToolDefinition } from "../tool/Tool.js";

export interface GenerateModelOptions extends GenerateOptions {
  model: ModelReference<any>;
  prompt?: string | any[];
  audioBase64?: string;
}

export abstract class Models {
  public ai: any;
  public task: Task;
  public toolHandlers: Map<string, (input: any) => Promise<any>> = new Map();
  public tools: any[] = [];

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

  protected initializeTools(
    toolDefinitions: [ToolDefinition, (input: any) => Promise<any>][]
  ): void {
    this.toolHandlers = new Map();
    this.tools = toolDefinitions.map(
      (args: [ToolDefinition, (input: any) => Promise<any>]) => {
        const [localToolDefinition, handler] = args;
        if (
          typeof localToolDefinition.name !== "string" ||
          typeof handler !== "function"
        ) {
          throw new Error(
            `Invalid tool definition: ${localToolDefinition.name}`
          );
        }
        this.toolHandlers.set(localToolDefinition.name, handler);
        return this.ai.defineTool(localToolDefinition, handler);
      }
    );
  }

  /**
   * Abstract method for generating content using a specific model.
   * Subclasses must implement this method.
   * @param options - Options for generation, including the prompt and model reference.
   * @returns A promise that resolves with the generated content as a string.
   */
  abstract generate(options: GenerateModelOptions): Promise<string>;

  async generateWithTools(generateOptions: GenerateOptions) {
    let llmResponse;
    let finalUsage;

    while (true) {
      llmResponse = await this.ai.generate(generateOptions);
      finalUsage = llmResponse.usage;

      const toolRequests = llmResponse.toolRequests ?? [];
      if (toolRequests.length < 1) {
        break;
      }

      const toolResponses: ToolResponsePart[] = await Promise.all(
        toolRequests.map(async (part: ToolRequestPart) => {
          const handler = this.toolHandlers.get(part.toolRequest.name);
          if (!handler) {
            console.error(
              `Tool handler not found for: ${part.toolRequest.name}`
            );
            return {
              toolResponse: {
                name: part.toolRequest.name,
                ref: part.toolRequest.ref,
                output: { error: `Tool not found: ${part.toolRequest.name}` },
              },
            };
          }
          try {
            const output = await handler(part.toolRequest.input);
            return {
              toolResponse: {
                name: part.toolRequest.name,
                ref: part.toolRequest.ref,
                output: output,
              },
            };
          } catch (error: any) {
            console.error(
              `Error executing tool ${part.toolRequest.name}:`,
              error
            );
            return {
              toolResponse: {
                name: part.toolRequest.name,
                ref: part.toolRequest.ref,
                output: {
                  error: `Tool execution failed: ${error.message || error}`,
                },
              },
            };
          }
        })
      );

      let nextMessages = llmResponse.messages ? [...llmResponse.messages] : [];
      toolResponses.forEach((toolResponsePart) => {
        nextMessages.push({
          role: "tool",
          content: [toolResponsePart],
        });
      });
      generateOptions.messages = nextMessages;
      generateOptions.prompt = undefined;
    }

    if (finalUsage) {
      console.log("AI Usage:", finalUsage);
    }
  }
}
