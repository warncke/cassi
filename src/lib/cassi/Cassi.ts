import { Config } from "../config/Config.js";
import { Repository } from "../repository/Repository.js";
import { User } from "../user/User.js";
import { Tool } from "../tool/Tool.js";

export class Cassi {
  config: Config;
  repository: Repository;
  user: User;
  tool: Tool; // Tool needs to be instantiated

  constructor(user: User, configFile: string, repositoryDir: string) {
    this.user = user;
    this.config = new Config(configFile, user);
    this.repository = new Repository(repositoryDir, user);
    // Instantiate Tool with user and config
    this.tool = new Tool(this.user, this.config);
  }

  async init() {
    await this.user.init();
    await this.config.init();
    // Call init on the Tool instance
    await this.tool.init();
    await this.repository.init();
  }
}
