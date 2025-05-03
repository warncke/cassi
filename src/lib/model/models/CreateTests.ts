import { z } from "zod";
import { Models, GenerateModelOptions } from "../Models.js";
import { Task } from "../../task/Task.js";
import { GenerateOptions, ToolResponsePart, ToolRequestPart } from "genkit";
import { ToolDefinition } from "../../tool/Tool.js";
import { ExecuteCommand } from "../tools/ExecuteCommand.js";
import { ReadFile } from "../tools/ReadFile.js";
import { WriteFile } from "../tools/WriteFile.js";
import { ReplaceInFile } from "../tools/ReplaceInFile.js";
import { RunBuild } from "../tools/RunBuild.js";
import { ListFiles } from "../tools/ListFiles.js";
import { getInterfaces } from "../context/getInterfaces.js";

export class CreateTests extends Models {
  constructor(plugin: any, task: Task) {
    super(plugin, task);

    this.initializeTools([
      ExecuteCommand.modelToolArgs(this),
      ReadFile.modelToolArgs(this),
      WriteFile.modelToolArgs(this),
      ReplaceInFile.modelToolArgs(this),
      RunBuild.modelToolArgs(this),
      ListFiles.modelToolArgs(this),
    ]);
  }

  async generate(options: GenerateModelOptions): Promise<string> {
    const {
      model,
      prompt,
      messages: initialMessages,
      ...restOptions
    } = options;

    const generateOptions: GenerateOptions = {
      model: model,
      prompt: `
You are an expert senior TypeScript developer assigned to modify an existing codebase based on a user request. Your primary goal is to implement the required changes accurately, efficiently, and according to enterprise-level coding standards using the provided tools. You must ensure the code remains type-safe and the project builds successfully after your modifications.\n\nINPUTS:\n\nFile Interfaces:\n${getInterfaces(this.task.getWorkTree())}\n\nUser Request:\n${prompt}\n\nAVAILABLE TOOLS:\nExecuteCommand, ReadFile, WriteFile, ReplaceInFile, RunBuild, ListFiles\n\nINSTRUCTIONS:\n\nThoroughly analyze the User Request ({USER_PROMPT}) and the provided File Interfaces ({FILE_INTERFACES}). Identify the specific files that need modification and understand the relationships between them (imports/exports).\n\nPlan the necessary changes. Determine which tools are most appropriate for each modification.\n\nFor files requiring changes:\na. Use the ReadFile tool to get the current content of the file before making modifications.\nb. To make specific, targeted changes within a file (e.g., updating a function signature, adding an import line, renaming a variable within a limited scope), prefer the ReplaceInFile tool. Provide clear, unambiguous patterns or line ranges for replacement to minimize unintended side effects.\nc. For creating new files, deleting files (if explicitly and safely requested), or performing extensive rewrites of existing files where ReplaceInFile is impractical, use the WriteFile tool. Be precise and careful when overwriting files.\nd. Ensure all code modifications strictly adhere to professional TypeScript development practices: enforce strong typing (avoid \'any\' unless absolutely necessary and justified), ensure code clarity and maintainability, follow idiomatic TypeScript patterns, and maintain consistency with the existing module structure (imports/exports).\n\nDo NOT write or modify any unit tests, integration tests, or end-to-end tests. Test creation is outside the scope of this task.\n\nAfter applying all necessary code changes using the WriteFile and/or ReplaceInFile tools, execute the RunBuild tool to compile the project and perform type checking.\n\nAnalyze the output of the RunBuild tool.\na. If the build succeeds, the task is complete. Report success.\nb. If the build fails, analyze the error messages carefully. Use ReadFile to examine the problematic code sections. Formulate corrections based on the errors and apply fixes using ReplaceInFile or WriteFile. Repeat step 5 (RunBuild) until the build passes.\n\nUse the ListFiles tool only if the provided File Interfaces are insufficient to understand the context needed to fulfill the User Request safely. Rely primarily on the provided interfaces.\n\nIf the User Request is unclear, ambiguous, or seems potentially detrimental to the codebase stability, ask for clarification before proceeding with potentially destructive actions like file deletion or major refactoring.\n\nProvide a summary of the actions taken (files modified, tools used) and confirm that the RunBuild command completed successfully as the final output. Do not output the full content of the modified files unless the User Request explicitly asked for it.\n\nProceed with implementing the changes described in the User Request using the available tools and adhering to these instructions.\n`,
      tools: this.tools,
      returnToolRequests: true,
      messages: initialMessages ?? [],
      ...restOptions,
    };

    await this.generateWithTools(generateOptions);

    return "";
  }
}
