import { Config } from "../config/Config.js";
import { Repository } from "../repository/Repository.js";
import { User } from "../user/User.js";
import { Tool } from "../tool/Tool.js";

export class Cassi {
  config: Config;
  repository: Repository;
  user: User;
  // tool: Tool; // Tool is now static, no instance needed here

  constructor(user: User, configFile: string, repositoryDir: string) {
    this.user = user;
    this.config = new Config(configFile, user);
    this.repository = new Repository(repositoryDir, user);
    // this.tool = new Tool(this.user, this.config); // Tool is now static
  }

  async init() {
    await this.user.init();
    await this.config.init();
    await Tool.init(); // Initialize Tool statically after Config
    await this.repository.init();
  }
}
