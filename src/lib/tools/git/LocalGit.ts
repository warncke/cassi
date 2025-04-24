import * as simpleGit from "simple-git";
import { SimpleGit, SimpleGitOptions } from "simple-git";

/**
 * Represents the local Git tool for interacting with a Git repository.
 */
export class LocalGit {
  private git: SimpleGit;

  /**
   * Creates an instance of LocalGit.
   * @param basePath The base path of the Git repository.
   * @param options Optional SimpleGit options.
   */
  constructor(basePath: string, options?: Partial<SimpleGitOptions>) {
    // Use simpleGit directly as the function
    this.git = simpleGit.simpleGit(basePath, options);
  }

  /**
   * Retrieves the status of the Git repository.
   * @returns A promise that resolves with the Git status summary.
   */
  async status() {
    return this.git.status();
  }
}
