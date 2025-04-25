import { z } from "zod";
import { Models, GenerateModelOptions } from "../Models.js";
import { Task } from "../../task/Task.js";
import { ExecuteCommand } from "../tools/ExecuteCommand.js";
import { ReadFile } from "../tools/ReadFile.js";

export class Coder extends Models {
  public tools: any[];

  constructor(plugin: any, task: Task) {
    super(plugin, task);

    this.tools = [
      this.ai.defineTool(...ExecuteCommand.modelToolArgs(this)),
      this.ai.defineTool(...ReadFile.modelToolArgs(this)),
    ];
  }

  async generate(options: GenerateModelOptions): Promise<string> {
    const { model, prompt, ...restOptions } = options;

    const { text, usage } = await this.ai.generate({
      model: model,
      prompt: `
You are CASSI, you specialize in developing typescript programs to run on node.js.

You have tools available to complete your tasks.

Take the original PROMPT, with its summary and suggested steps, evaluate each of those steps.

For each step evaluate what files may need to be changed in order to complete the step.

Use the EXECUTE_COMMAND to execute linux system commands in a bash shell to get information about the files and directories in the project.

PROMPT: ${prompt}
      
`, // Pass the prompt
      tools: this.tools,
      ...restOptions,
    });

    if (usage) {
      console.log("AI Usage:", usage);
    }

    if (!text) {
      console.warn("AI response did not contain text content.");
      return "";
    }
    return text;
  }
}
