import { z } from "zod";
import path from "path";
import { Models } from "../Models.js";
import { ModelTool } from "./ModelTool.js";
import { ToolDefinition } from "../../tool/Tool.js";

// Define the input schema for the SearchFiles tool
const searchFilesInputSchema = z.object({
  regex: z
    .string()
    .describe(
      "A string regular expression to search for within files."
    ),
});

// Define the output schema for the SearchFiles tool
const searchFilesOutputSchema = z.array(
    z.object({
        fileName: z.string().describe("The name of the file where the match was found."),
        line: z.number().describe("The line number where the match occurred."),
        context: z.string().describe("The line content where the match occurred."),
    })
).describe("A list of files and lines matching the search regex.");

// Define the SearchFiles tool class
export class SearchFiles extends ModelTool {
  static toolDefinition: ToolDefinition = {
    name: "SearchFiles",
    description:
      "Searches files in the workspace for lines matching a regular expression.",
    inputSchema: searchFilesInputSchema,
    outputSchema: searchFilesOutputSchema,
  };

  // Tool method implementation (currently empty as requested)
  static async toolMethod(
    model: Models,
    input: z.infer<typeof searchFilesInputSchema>
  ): Promise<z.infer<typeof searchFilesOutputSchema>> {
    // TODO: Implement the actual file search logic here.
    // For now, it returns an empty array as per the request to leave the implementation empty.
    console.log(`SearchFiles tool invoked with regex: ${input.regex} in CWD: ${model.task.getCwd()}`);
    // Placeholder implementation:
    return [];
  }
}
