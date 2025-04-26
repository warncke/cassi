import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import { User } from "../user/User.js";
import { Config } from "../config/Config.js";
import { Invocation } from "./Invocation.js";
import { Task } from "../task/Task.js";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class Tool {
  private static availableTools: Record<
    string,
    Record<string, new (...args: any[]) => any>
  > | null = null;
  private user: User;
  private config: Config;

  constructor(user: User, config: Config) {
    this.user = user;
    this.config = config;
  }

  async init(): Promise<
    Record<string, Record<string, new (...args: any[]) => any>>
  > {
    if (Tool.availableTools !== null) {
      return Tool.availableTools;
    }
    Tool.availableTools = {};

    const toolsRootPath = path.resolve(__dirname, "../tools");
    try {
      const toolTypeDirs = await fs.readdir(toolsRootPath);

      for (const toolType of toolTypeDirs) {
        const toolTypePath = path.join(toolsRootPath, toolType);
        const stat = await fs.stat(toolTypePath);

        if (stat.isDirectory()) {
          const toolFiles = await fs.readdir(toolTypePath);
          const toolJsFiles = toolFiles.filter((file) => file.endsWith(".js"));

          if (toolJsFiles.length > 0) {
            let toolFileName =
              toolJsFiles.find((f) => f === "index.js") ?? toolJsFiles[0];
            const toolFilePath = path.join(toolTypePath, toolFileName);

            const relativeToolPath = path.relative(__dirname, toolFilePath);

            let importPath = "";
            try {
              importPath = relativeToolPath.startsWith(".")
                ? relativeToolPath
                : `./${relativeToolPath}`;
              const module = await import(importPath);

              const className = path.basename(toolFileName, ".js");
              const ToolClass = module.default || module[className];

              if (
                ToolClass &&
                typeof ToolClass === "function" &&
                Tool.availableTools
              ) {
                if (!Tool.availableTools[toolType]) {
                  Tool.availableTools[toolType] = {};
                }
                const toolBaseName = path.basename(toolFileName, ".js");
                Tool.availableTools[toolType][toolBaseName] = ToolClass;
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
          }
        }
      }
    } catch (error) {
      console.error("Error during tool initialization:", error);
    }
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
  async invoke(
    task: Task,
    toolName: string,
    methodName: string,
    toolArgs?: any[],
    methodArgs?: any[]
  ): Promise<any> {
    const effectiveToolArgs = toolArgs ?? [];
    const effectiveMethodArgs = methodArgs ?? [];
    const toolClasses = await this.init();
    const toolTypeMap = toolClasses[toolName];

    if (!toolTypeMap) {
      throw new Error(
        `Tool type "${toolName}" not found or failed to initialize.`
      );
    }

    const implementationName = Object.keys(toolTypeMap)[0];
    const ToolClass = toolTypeMap[implementationName];

    if (!ToolClass || typeof ToolClass !== "function") {
      throw new Error(
        `Tool class for type "${toolName}" (implementation "${implementationName}") not found or invalid.`
      );
    }

    const toolInstance = new ToolClass(...effectiveToolArgs);

    const toolMethod = toolInstance[methodName];

    if (typeof toolMethod !== "function") {
      throw new Error(
        `Method "${methodName}" not found on tool "${toolName}" (implementation "${implementationName}").`
      );
    }

    const invocation = new Invocation(
      task,
      toolName,
      implementationName,
      methodName,
      toolMethod,
      toolInstance,
      effectiveToolArgs,
      effectiveMethodArgs
    );

    const isAllowed = await this.allow(invocation);
    if (!isAllowed) {
      throw new Error(
        `Invocation not allowed for tool "${toolName}", method "${methodName}".`
      );
    }

    return await invocation.invoke();
  }

  /**
   * Determines if a tool invocation is allowed.
   * Currently, always returns true.
   * @param invocation - The details of the tool invocation.
   * @returns A promise that resolves to true if the invocation is allowed, false otherwise.
   */
  async allow(invocation: Invocation): Promise<boolean> {
    return true;
  }
}
