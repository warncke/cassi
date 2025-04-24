import { User } from "../user/User.js";
import { readFile } from "fs/promises";
import Ajv from "ajv"; // Use default import
import type { JSONSchemaType, ErrorObject } from "ajv"; // Import types separately

// Define the interface for the expected config structure
interface ConfigData {
  apiKeys: {
    gemini: string;
  };
}

// Define the JSON schema for validation
const configSchema: JSONSchemaType<ConfigData> = {
  type: "object",
  properties: {
    apiKeys: {
      type: "object",
      properties: {
        gemini: { type: "string" },
      },
      required: ["gemini"],
      additionalProperties: false, // Disallow other keys within apiKeys
    },
  },
  required: ["apiKeys"],
  additionalProperties: false, // Disallow other top-level keys
};

export class Config {
  configFile: string;
  user: User;
  configData: ConfigData | null; // Use the interface type, allow null initially

  constructor(configFile: string, user: User) {
    this.configFile = configFile;
    this.user = user;
    this.configData = null; // Initialize configData
  }

  async init() {
    try {
      const fileContent = await readFile(this.configFile, "utf-8");
      let parsedData: any; // Temporary variable for parsed data
      try {
        parsedData = JSON.parse(fileContent);
      } catch (parseError: any) {
        throw new Error(
          `Error parsing config file ${this.configFile}: ${parseError.message}`
        );
      }

      // Validate the parsed data against the schema
      const ajv = new (Ajv as any).default(); // Try accessing .default for CJS interop
      const validate = ajv.compile(configSchema);

      if (validate(parsedData)) {
        this.configData = parsedData; // Assign validated data
      } else {
        // Construct a more informative error message
        const errors = validate.errors
          ?.map(
            (
              err: ErrorObject // Add explicit type for err
            ) =>
              `${err.instancePath || "root"} ${err.message} (schema path: ${
                err.schemaPath
              })`
          )
          .join(", ");
        throw new Error(
          `Config file ${this.configFile} validation failed: ${errors}`
        );
      }
    } catch (readError: any) {
      // Catch read errors or validation errors from above
      throw new Error(
        `Error processing config file ${this.configFile}: ${readError.message}`
      );
    }

    process.env.GEMINI_API_KEY = this.configData?.apiKeys.gemini;
  }
}
