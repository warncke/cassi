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

  /**
   * Creates a new branch.
   * @param branchName The name of the branch to create.
   * @returns A promise that resolves when the branch is created.
   */
  async branch(branchName: string) {
    // The branch method in simple-git takes an array of command options.
    // To create a branch, we just pass the branch name.
    return this.git.branch([branchName]);
  }

  /**
   * Adds a new worktree.
   * @param directory The path for the new worktree.
   * @param branchName The name of the branch to check out in the new worktree.
   * @returns A promise that resolves when the worktree is added.
   */
  async addWorktree(directory: string, branchName: string) {
    // Use the raw method to execute the git worktree add command
    return this.git.raw(["worktree", "add", directory, branchName]);
  }

  /**
   * Removes an existing worktree.
   * @param directory The path of the worktree to remove.
   * @returns A promise that resolves when the worktree is removed.
   */
  async remWorkTree(directory: string) {
    // Use the raw method to execute the git worktree remove command
    return this.git.raw(["worktree", "remove", directory]);
  }
}
