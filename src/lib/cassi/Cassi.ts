import { Config } from "../config/Config.js";
import { Repository } from "../repository/Repository.js";
import { User } from "../user/User.js";

export class Cassi {
  config: Config;
  repository: Repository;
  user: User;

  constructor(user: User, configFile: string, repositoryDir: string) {
    this.user = user;
    this.config = new Config(configFile, user);
    this.repository = new Repository(repositoryDir, user);
  }

  async init() {
    await this.user.init();
    await this.config.init();
    await this.repository.init();
  }
}
