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

export class Coder extends Models {
  public tools: any[];
  private toolHandlers: Map<string, (input: any) => Promise<any>>;

  constructor(plugin: any, task: Task) {
    super(plugin, task);
    this.toolHandlers = new Map();

    const toolDefinitions = [
      ExecuteCommand.modelToolArgs(this),
      ReadFile.modelToolArgs(this),
      WriteFile.modelToolArgs(this),
      ReplaceInFile.modelToolArgs(this),
      RunBuild.modelToolArgs(this),
      ListFiles.modelToolArgs(this),
    ];

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
You are CASSI, you specialize in developing typescript programs to run on node.js.

You need to execute the task given in PROMPT: ${prompt}

You have tools available to complete your tasks.

Take the original PROMPT, with its summary and suggested steps, evaluate each of those steps.

For each step evaluate what files may need to be changed in order to complete the step.

Use the LIST_FILES tool to run a glob to list all files. Use an optional pattern argument to the LIST_FILES tool to limit the types of files to return. Use the results of LIST_FILE to determine which files may need to be modified and use the READ_FILE tool to read individual files. When using file path from LIST_FILES be sure to include the original path argument from the call to LIST_FILES for constructing the path for calling READ_FILE, WRITE_FILE, and REPLACE_IN_FILE.

Use EXECUTE_COMMAND to run linux shell commands to complete tasks.

Use the READ_FILE command to get the contents of files.

Determine all of the file changes that need to be made.

For each file that needs to be changed call the REPLACE_IN_FILE tool with path and diff arguments. The path must be the file to apply the diff to. The diff argument must be in the exact format: <<<<<<< SEARCH[exact content to find]=======[new content to replace with]>>>>>>> REPLACE

You can also use the WRITE_FILE tool to create or replace the contents of any file but REPLACE_IN_FILE should always be used for updating existing files unless REPLACE_IN_FILE fails. If REPLACE_IN_FILE fails retry writing the entire file using WRITE_FILE.

When calling READ_FILE, WRITE_FILE, and REPLACE_IN_FILE always inlude the path argument with the
relative path of the file to access.

After changing files with WRITE_FILE and REPLACE_IN_FILE run the RUN_BUILD tool and check the STDERR output for any build errors. If there is any STDERR output try to fix it by modifying the files and RUN_BUILD again to verify changes until no STDERR output is returned by RUN_BUILD

When creating or modifying new ".ts" files always take into account the creation of tests. Every ".ts" file should have a corresponding ".test.ts" test file. When modifying existing ".ts" files always modfify or create the files corresponding ".test.ts" file to update tests coverage to reflect the changes. Do not attempt to run tests. These will be run in another task.

For REPLACE_IN_FILE always provide a path and diff argument. 

# Tool Use Guidelines

1. In <thinking> tags, assess what information you already have and what information you need to proceed with the task.
2. Choose the most appropriate tool based on the task and the tool descriptions provided. Assess if you need additional information to proceed, and which of the available tools would be most effective for gathering this information. For example using the list_files tool is more effective than running a command like \`ls\` in the terminal. It's critical that you think about each available tool and use the one that best fits the current step in the task.
3. If multiple actions are needed, use one tool at a time per message to accomplish the task iteratively, with each tool use being informed by the result of the previous tool use. Do not assume the outcome of any tool use. Each step must be informed by the previous step's result.
4. Formulate your tool use using the XML format specified for each tool.
5. After each tool use, the user will respond with the result of that tool use. This result will provide you with the necessary information to continue your task or make further decisions. This response may include:
  - Information about whether the tool succeeded or failed, along with any reasons for failure.
  - Linter errors that may have arisen due to the changes you made, which you'll need to address.
  - New terminal output in reaction to the changes, which you may need to consider or act upon.
  - Any other relevant feedback or information related to the tool use.
6. ALWAYS wait for user confirmation after each tool use before proceeding. Never assume the success of a tool use without explicit confirmation of the result from the user.

It is crucial to proceed step-by-step, waiting for the user's message after each tool use before moving forward with the task. This approach allows you to:
1. Confirm the success of each step before proceeding.
2. Address any issues or errors that arise immediately.
3. Adapt your approach based on new information or unexpected results.
4. Ensure that each action builds correctly on the previous ones.

By waiting for and carefully considering the user's response after each tool use, you can react accordingly and make informed decisions about how to proceed with the task. This iterative process helps ensure the overall success and accuracy of your work.

EDITING FILES

You have access to two tools for working with files: **WRITE_FILE** and **REPLACE_IN_FILE**. Understanding their roles and selecting the right one for the job will help ensure efficient and accurate modifications.

# WRITE_FILE

## Purpose

- Create a new file, or overwrite the entire contents of an existing file.

## When to Use

- Initial file creation, such as when scaffolding a new project.  
- Overwriting large boilerplate files where you want to replace the entire content at once.
- When the complexity or number of changes would make REPLACE_IN_FILE unwieldy or error-prone.
- When you need to completely restructure a file's content or change its fundamental organization.

## Important Considerations

- Using WRITE_FILE requires providing the file's complete final content.  
- If you only need to make small changes to an existing file, consider using REPLACE_IN_FILE instead to avoid unnecessarily rewriting the entire file.
- While WRITE_FILE should not be your default choice, don't hesitate to use it when the situation truly calls for it.

# REPLACE_IN_FILE

## Purpose

- Make targeted edits to specific parts of an existing file without overwriting the entire file.

## When to Use

- Small, localized changes like updating a few lines, function implementations, changing variable names, modifying a section of text, etc.
- Targeted improvements where only specific portions of the file's content needs to be altered.
- Especially useful for long files where much of the file will remain unchanged.

## Advantages

- More efficient for minor edits, since you don't need to supply the entire file content.  
- Reduces the chance of errors that can occur when overwriting large files.

# Choosing the Appropriate Tool

- **Default to REPLACE_IN_FILE** for most changes. It's the safer, more precise option that minimizes potential issues.
- **Use WRITE_FILE** when:
  - Creating new files
  - The changes are so extensive that using REPLACE_IN_FILE would be more complex or risky
  - You need to completely reorganize or restructure a file
  - The file is relatively small and the changes affect most of its content
  - You're generating boilerplate or template files

# Auto-formatting Considerations

- After using either WRITE_FILE or REPLACE_IN_FILE, the user's editor may automatically format the file
- This auto-formatting may modify the file contents, for example:
  - Breaking single lines into multiple lines
  - Adjusting indentation to match project style (e.g. 2 spaces vs 4 spaces vs tabs)
  - Converting single quotes to double quotes (or vice versa based on project preferences)
  - Organizing imports (e.g. sorting, grouping by type)
  - Adding/removing trailing commas in objects and arrays
  - Enforcing consistent brace style (e.g. same-line vs new-line)
  - Standardizing semicolon usage (adding or removing based on style)
- The WRITE_FILE and REPLACE_IN_FILE tool responses will include the final state of the file after any auto-formatting
- Use this final state as your reference point for any subsequent edits. This is ESPECIALLY important when crafting SEARCH blocks for REPLACE_IN_FILE which require the content to match what's in the file exactly.

# Workflow Tips

1. Before editing, assess the scope of your changes and decide which tool to use.
2. For targeted edits, apply REPLACE_IN_FILE with carefully crafted SEARCH/REPLACE blocks. If you need multiple changes, you can stack multiple SEARCH/REPLACE blocks within a single REPLACE_IN_FILE call.
3. For major overhauls or initial file creation, rely on WRITE_FILE.
4. Once the file has been edited with either WRITE_FILE or REPLACE_IN_FILE, the system will provide you with the final state of the modified file. Use this updated content as the reference point for any subsequent SEARCH/REPLACE operations, since it reflects any auto-formatting or user-applied changes.

By thoughtfully selecting between WRITE_FILE and REPLACE_IN_FILE, you can make your file editing process smoother, safer, and more efficient.

Follow your instructions to perform the task given by PROMPT: ${prompt}
`,
      tools: this.tools,
      returnToolRequests: true,
      messages: initialMessages ?? [], // Initialize messages array
      ...restOptions,
    };

    let llmResponse;
    let finalUsage;

    while (true) {
      console.log(
        "GENERATE",
        JSON.stringify(generateOptions.messages),
        generateOptions.prompt
      );
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
            console.log(
              `Calling tool: ${part.toolRequest.name} with input:`,
              part.toolRequest.input
            );
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

      // Clone messages from the previous response and ensure it's an array
      let nextMessages = llmResponse.messages ? [...llmResponse.messages] : [];
      // Append tool responses to the new messages array
      toolResponses.forEach((toolResponsePart) => {
        nextMessages.push({
          role: "tool", // Use 'tool' role for responses in Genkit
          content: [toolResponsePart], // Content should be an array of ToolResponsePart
        });
      });
      generateOptions.messages = nextMessages; // Assign the updated array
      // Clear the prompt field as responses are now in messages
      generateOptions.prompt = undefined;
    }

    if (finalUsage) {
      console.log("AI Usage:", finalUsage);
    }

    return "";
  }
}
