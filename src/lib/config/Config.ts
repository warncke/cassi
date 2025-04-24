import { User } from "../user/User.js";
import { readFile } from "fs/promises";

export class Config {
  configFile: string;
  user: User;
  configData: any; // Store parsed config data

  constructor(configFile: string, user: User) {
    this.configFile = configFile;
    this.user = user;
    this.configData = null; // Initialize configData
  }

  async init() {
    try {
      const fileContent = await readFile(this.configFile, "utf-8");
      try {
        this.configData = JSON.parse(fileContent);
      } catch (parseError: any) {
        // Specify type for error
        throw new Error(
          `Error parsing config file ${this.configFile}: ${parseError.message}`
        );
      }
    } catch (readError: any) {
      // Specify type for error
      throw new Error(
        `Error reading config file ${this.configFile}: ${readError.message}`
      );
    }
  }
}
