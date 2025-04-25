import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url"; // Needed for __dirname in ESM
import { User } from "../user/User.js";
import { Config } from "../config/Config.js";
import { Invocation } from "./Invocation.js";
import { Task } from "../task/Task.js"; // Import Task

// Define the structure for tool definitions
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

// Tool classes will be loaded dynamically

// Helper to get __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class Tool {
  // availableTools remains static to hold the loaded tool *classes* globally
  // Use a generic constructor type that accepts any arguments
  private static availableTools: Record<
    string,
    Record<string, new (...args: any[]) => any> // Store generic constructors
  > | null = null;
  // Add instance properties for user and config
  private user: User;
  private config: Config;

  constructor(user: User, config: Config) {
    this.user = user;
    this.config = config;
    // Constructor now initializes user and config
  }

  // Update return type to reflect the generic constructor structure
  // init is now an instance method
  async init(): Promise<
    Record<string, Record<string, new (...args: any[]) => any>>
  > {
    // Instance method, returns map of generic constructors
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
                Tool.availableTools // Check if the outer map is initialized
              ) {
                // Ensure the inner map for the toolType exists
                if (!Tool.availableTools[toolType]) {
                  Tool.availableTools[toolType] = {};
                }
                // Ensure base filename (without extension) is used as the key
                const toolBaseName = path.basename(toolFileName, ".js");
                // Store the ToolClass constructor directly, not an instance
                Tool.availableTools[toolType][toolBaseName] = ToolClass;
                console.log(
                  `Successfully loaded tool class: ${toolType} (${toolBaseName})` // Log base name
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
      // Use JSON.stringify to log the full tool map structure
      JSON.stringify(Tool.availableTools ?? {}, null, 2) // Added null, 2 for pretty printing
    );
    // Return the static map, handle potential null case
    return Tool.availableTools ?? {};
  }

  /**
   * Invokes a method on a specified tool.
   * @param task - The task context for this invocation.
   * @param toolName - The type/category of the tool (e.g., "fs").
   * @param methodName - The name of the method to invoke on the tool.
   * @param args - Arguments to pass to the tool method.
   * @returns The result of the invoked tool method.
   */
  // invoke is now an instance method
  async invoke(
    task: Task, // Add task parameter
    toolName: string,
    methodName: string,
    toolArgs?: any[], // Make toolArgs optional
    methodArgs?: any[] // Changed from ...args
  ): Promise<any> {
    // Instance method
    const effectiveToolArgs = toolArgs ?? []; // Default to empty array if undefined
    const effectiveMethodArgs = methodArgs ?? []; // Default to empty array if undefined
    // Call init() on the instance to ensure tool classes are loaded
    const toolClasses = await this.init(); // Use this.init()
    const toolTypeMap = toolClasses[toolName]; // Get the inner map for the type

    if (!toolTypeMap) {
      throw new Error(
        `Tool type "${toolName}" not found or failed to initialize.`
      );
    }

    // Assuming one implementation per type for now, based on current init logic
    const implementationName = Object.keys(toolTypeMap)[0]; // Get the key (e.g., 'Local')
    const ToolClass = toolTypeMap[implementationName]; // Get the constructor

    if (!ToolClass || typeof ToolClass !== "function") {
      // This case might occur if the inner map is empty or contains non-constructors
      throw new Error(
        `Tool class for type "${toolName}" (implementation "${implementationName}") not found or invalid.`
      );
    }

    // Instantiate a new tool instance for this specific invocation
    // Pass user, config, and effectiveToolArgs to the tool's constructor
    const toolInstance = new ToolClass(...effectiveToolArgs);

    // Get the method from the newly created instance
    const toolMethod = toolInstance[methodName];

    if (typeof toolMethod !== "function") {
      throw new Error(
        `Method "${methodName}" not found on tool "${toolName}" (implementation "${implementationName}").`
      );
    }

    // Instantiate Invocation before calling the method
    // Pass the task to the constructor
    const invocation = new Invocation(
      task, // Pass task here
      toolName,
      implementationName,
      methodName,
      toolMethod, // Pass the actual method function
      toolInstance, // Pass the instance
      effectiveToolArgs, // Pass effectiveToolArgs
      effectiveMethodArgs // Pass the renamed arguments
    );

    // Check if the invocation is allowed using the instance's allow method
    const isAllowed = await this.allow(invocation);
    if (!isAllowed) {
      // Optionally, provide more context in the error message
      throw new Error(
        `Invocation not allowed for tool "${toolName}", method "${methodName}".`
      );
    }

    // Call the invoke method on the Invocation instance (no args needed)
    return await invocation.invoke();
  }

  /**
   * Determines if a tool invocation is allowed.
   * Currently, always returns true.
   * @param invocation - The details of the tool invocation.
   * @returns A promise that resolves to true if the invocation is allowed, false otherwise.
   */
  async allow(invocation: Invocation): Promise<boolean> {
    // TODO: Implement actual permission logic based on user, config, or invocation details
    // Log a simplified version to avoid circular structure errors
    console.log(
      `Checking allow for invocation: Tool=${invocation.toolName}, Method=${
        invocation.method
      }, Args=${JSON.stringify(invocation.methodArgs)}, Task=${
        // Updated to methodArgs
        invocation.task.constructor.name
      }`
    );
    return true; // Always allow for now
  }
}
