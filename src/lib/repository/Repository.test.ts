import { Repository } from "./Repository.js";
import { User } from "../user/User.js";

import { describe, expect, test, beforeEach } from "vitest";

describe("Repository", () => {
  let repository: Repository;
  let user: User;

  beforeEach(() => {
    user = new User();
    repository = new Repository(".", user);
  });

  test("should create an instance of Repository", () => {
    expect(repository).toBeInstanceOf(Repository);
  });
});
