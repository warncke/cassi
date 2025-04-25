import { User } from "../user/User.js";
import { readFile } from "fs/promises";
import Ajv from "ajv";
import type { JSONSchemaType, ErrorObject } from "ajv";

interface ConfigData {
  apiKeys: {
    gemini: string;
  };
  srcDir?: string;
}

const configSchema: JSONSchemaType<ConfigData> = {
  type: "object",
  properties: {
    apiKeys: {
      type: "object",
      properties: {
        gemini: { type: "string" },
      },
      required: ["gemini"],
      additionalProperties: false,
    },
    srcDir: {
      type: "string",
      nullable: true,
      default: "src",
    },
  },
  required: ["apiKeys"],
  additionalProperties: false,
};

export class Config {
  configFile: string;
  user: User;
  configData: ConfigData | null;

  constructor(configFile: string, user: User) {
    this.configFile = configFile;
    this.user = user;
    this.configData = null;
  }

  async init() {
    try {
      const fileContent = await readFile(this.configFile, "utf-8");
      let parsedData: any;
      try {
        parsedData = JSON.parse(fileContent);
      } catch (parseError: any) {
        throw new Error(
          `Error parsing config file ${this.configFile}: ${parseError.message}`
        );
      }

      const ajv = new (Ajv as any).default({ useDefaults: true });
      const validate = ajv.compile(configSchema);

      if (validate(parsedData)) {
        this.configData = parsedData;
      } else {
        const errors = validate.errors
          ?.map(
            (
              err: ErrorObject
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
      throw new Error(
        `Error processing config file ${this.configFile}: ${readError.message}`
      );
    }

    process.env.GEMINI_API_KEY = this.configData?.apiKeys.gemini;
  }
}
