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
    return this.git.branch([branchName]);
  }

  /**
   * Adds a new worktree.
   * @param directory The path for the new worktree.
   * @param branchName The name of the branch to check out in the new worktree.
   * @returns A promise that resolves when the worktree is added.
   */
  async addWorktree(directory: string, branchName: string) {
    return this.git.raw([
      "worktree",
      "add",
      "-b",
      branchName,
      directory,
      "HEAD",
    ]);
  }

  /**
   * Removes an existing worktree.
   * @param directory The path of the worktree to remove.
   * @returns A promise that resolves when the worktree is removed.
   */
  async remWorkTree(directory: string) {
    return this.git.raw(["worktree", "remove", directory]);
  }

  /**
   * Shows changes between commits, commit and working tree, etc.
   * @param target Optional target to compare against (e.g., a branch or commit hash). If omitted, shows unstaged changes.
   * @returns A promise that resolves with the diff output.
   */
  async diff(target?: string): Promise<string> {
    const options = target ? [target] : [];
    return this.git.diff(options);
  }

  /**
   * Rebases the current branch onto another branch or commit.
   * @param options Optional array of rebase options.
   * @param options Optional rebase options.
   * @returns A promise that resolves with the rebase result.
   */
  async rebase(...options: string[]) {
    return this.git.rebase(options);
  }

  async merge(...options: string[]) {
    return this.git.merge(options);
  }

  async commitAll(commitMessage: string) {
    await this.git.add("./*");
    return this.git.commit(commitMessage);
  }
}
