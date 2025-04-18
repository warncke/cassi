import { User } from "../user/User.js";

export class Config {
  configFile: string;
  user: User;

  constructor(configFile: string, user: User) {
    this.configFile = configFile;
    this.user = user;
  }

  async init() {
    // Initialization logic here
  }
}
