import { Task } from "../Task.js";
import { Cassi } from "../../cassi/Cassi.js";

export class InitializeGit extends Task {
  // No constructor needed if it just calls super(cassi)
  // constructor(cassi: Cassi) {
  //   super(cassi); // Pass only cassi to the base constructor
  // }

  async initTask(): Promise<void> {
    // No try/catch needed here, let the base class handle errors
    const status = await this.invoke(
      "git",
      "status",
      this.cassi.repository.repositoryDir
    );
    console.log("Git Status:", status);

    if (!status.isClean()) {
      console.error(
        "Git repository is not clean. Please commit or stash changes before proceeding."
      );
      process.exit(1);
    }
    // No complete() or fail() methods exist on Task base class
  }
}
