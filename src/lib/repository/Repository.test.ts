import { Repository } from "./Repository.js";

import { describe, expect, test, beforeEach } from "vitest";

describe("Repository", () => {
  let repository: Repository;

  beforeEach(() => {
    repository = new Repository();
  });

  test("should create an instance of Repository", () => {
    expect(repository).toBeInstanceOf(Repository);
  });
});
