import { Cassi } from "../../cassi/Cassi.js";
import { Task } from "../Task.js";
import { ConfirmCwd } from "./ConfirmCwd.js";
import { InitializeGit } from "./InitializeGit.js";

/**
 * Task to initialize a new repository.
 */
export class InitializeRepository extends Task {
  constructor(cassi: Cassi, parentTask: Task | null = null) {
    super(cassi, parentTask);
    this.subTasks = [
      new ConfirmCwd(cassi, this),
      new InitializeGit(cassi, this),
    ];
  }
}
