import { z } from "zod";
import { Models, GenerateModelOptions } from "../Models.js";
import { Task } from "../../task/Task.js";
import { ExecuteCommand } from "../tools/ExecuteCommand.js";
import { ReadFile } from "../tools/ReadFile.js";
import { WriteFile } from "../tools/WriteFile.js";
import { PatchFile } from "../tools/PatchFile.js";
import { RunBuild } from "../tools/RunBuild.js";
import { ListFiles } from "../tools/ListFiles.js";

export class Coder extends Models {
  public tools: any[];

  constructor(plugin: any, task: Task) {
    super(plugin, task);

    this.tools = [
      this.ai.defineTool(...ExecuteCommand.modelToolArgs(this)),
      this.ai.defineTool(...ReadFile.modelToolArgs(this)),
      this.ai.defineTool(...WriteFile.modelToolArgs(this)),
      this.ai.defineTool(...PatchFile.modelToolArgs(this)),
      this.ai.defineTool(...RunBuild.modelToolArgs(this)),
      this.ai.defineTool(...ListFiles.modelToolArgs(this)),
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

Use the LIST_FILES tool to run a glob to list all files. Use an optional pattern argument to the LIST_FILES tool to limit the types of files to return. Use the results of LIST_FILE to determine which files may need to be modified and use the READ_FILE tool to read individual files. When using file path from LIST_FILES be sure to include the original path argument from the call to LIST_FILES for constructing the path for calling READ_FILE, WRITE_FILE, and PATCH_FILE.

Use EXECUTE_COMMAND to run linux shell commands to complete tasks.

Use the READ_FILE command to get the contents of files.

Determine all of the file changes that need to be made.

For each file that needs to be changed call the PATCH_FILE tool with a path and patchContent arguments. The path must be the file to apply the patchContent to and the patchContent must be in the format of a standard .patch file.

You can also use the WRITE_FILE tool to create or replace the contents of any file but PATCH_FILE should always be used for updating existing files unless PATCH_FILE fails. It PATCH_FILE fails retry writing the entire file using WRITE_FILE.

When calling READ_FILE, WRITE_FILE, and PATCH_FILE always inlude the "path" argument with the
relative path of the file to access.

After changing files with WRITE_FILE and PATCH_FILE run the RUN_BUILD tool and check the STDERR output for any build errors. If there is any STDERR output try to fix it by modifying the files and RUN_BUILD again to verify changes until no STDERR output is returned by RUN_BUILD

When creating or modifying new ".ts" files always take into account the creation of tests. Every ".ts" file should have a corresponding ".test.ts" test file. When modifying existing ".ts" files always modfify or create the files corresponding ".test.ts" file to update tests coverage to reflect the changes. Do not attempt to run tests. These will be run in another task.

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
