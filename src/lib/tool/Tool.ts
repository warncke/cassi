import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url"; // Needed for __dirname in ESM
import { User } from "../user/User.js";
import { Config } from "../config/Config.js";
// LocalFS is no longer statically imported here, it will be loaded dynamically

// Helper to get __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class Tool {
  private static availableTools: Record<string, any> | null = null; // Static property, initialized to null
  // Removed unused user and config instance properties

  constructor() {
    // Constructor is now empty as properties are static or removed
  }

  static async init(): Promise<Record<string, any>> {
    // Static method, returns map
    if (Tool.availableTools !== null) {
      // Check if already initialized
      console.log("Tools already initialized, returning cached list.");
      return Tool.availableTools;
    }
    console.log("Initializing tools for the first time...");
    Tool.availableTools = {}; // Initialize the static map

    console.log("Initializing tools...");
    const toolsRootPath = path.resolve(__dirname, "../tools"); // Path to the 'tools' directory relative to this file
    try {
      const toolTypeDirs = await fs.readdir(toolsRootPath);

      for (const toolType of toolTypeDirs) {
        const toolTypePath = path.join(toolsRootPath, toolType);
        const stat = await fs.stat(toolTypePath);

        if (stat.isDirectory()) {
          console.log(`Found tool type directory: ${toolType}`);
          const toolFiles = await fs.readdir(toolTypePath);
          // Filter for .js files only
          const toolJsFiles = toolFiles.filter((file) => file.endsWith(".js"));

          if (toolJsFiles.length > 0) {
            // Prioritize index.js, otherwise take the first one found
            let toolFileName =
              toolJsFiles.find((f) => f === "index.js") ?? toolJsFiles[0];
            const toolFilePath = path.join(toolTypePath, toolFileName);

            // Construct the relative path for dynamic import
            // Path is already relative to the compiled output directory structure
            const relativeToolPath = path.relative(__dirname, toolFilePath);
            // No need to replace extension, it's already .js

            console.log(
              `Attempting to load tool: ${toolType} from ${relativeToolPath}`
            );

            // Declare importPath outside the try block to make it accessible in catch
            let importPath = "";
            try {
              // Use './' prefix for relative paths if needed by module system
              importPath = relativeToolPath.startsWith(".")
                ? relativeToolPath
                : `./${relativeToolPath}`;
              const module = await import(importPath);

              // Assume the class is the default export or named export matching the filename base
              const className = path.basename(toolFileName, ".js"); // e.g., "Local" from "Local.js"
              const ToolClass = module.default || module[className]; // Check default first, then named export

              // Ensure Tool.availableTools is not null before assigning
              if (
                ToolClass &&
                typeof ToolClass === "function" &&
                Tool.availableTools
              ) {
                Tool.availableTools[toolType] = new ToolClass(); // Use static property
                console.log(
                  `Successfully loaded and initialized tool: ${toolType}`
                );
              } else {
                console.warn(
                  `Could not find a valid class export in ${importPath}. Looked for default export or named export "${className}".`
                );
              }
            } catch (importError) {
              console.error(
                `Error importing tool ${toolType} from ${importPath}:`,
                importError
              );
            }
          } else {
            console.log(
              `No suitable .js files found in tool directory: ${toolTypePath}`
            );
          }
        }
      }
    } catch (error) {
      console.error("Error during tool initialization:", error);
      // Decide if initialization failure should prevent startup
      // throw new Error("Tool initialization failed");
    }
    console.log(
      "Tool initialization complete. Available tools:",
      // Use static property, handle potential null case (though unlikely here after init)
      Object.keys(Tool.availableTools ?? {})
    );
    // Return the static map, handle potential null case
    return Tool.availableTools ?? {};
  }

  /**
   * Invokes a method on a specified tool.
   * @param toolType - The type of tool (e.g., "fs").
   * @param method - The name of the method to invoke on the tool instance.
   * @param args - Arguments to pass to the tool method.
   * @returns The result of the invoked tool method.
   */
  static async invoke(
    toolType: string,
    method: string,
    ...args: any[]
  ): Promise<any> {
    // Static method
    const tools = await Tool.init(); // Ensure tools are loaded and get the map
    const toolInstance = tools[toolType];

    if (!toolInstance) {
      // Consider if init() failed and tools is empty
      throw new Error(
        `Tool type "${toolType}" not found or tools failed to initialize.`
      );
    }

    const toolMethod = toolInstance[method];

    if (typeof toolMethod !== "function") {
      throw new Error(
        `Method "${method}" not found on tool type "${toolType}".`
      );
    }

    // Call the method on the tool instance with the provided arguments
    return await toolMethod.apply(toolInstance, args);
  }
}
