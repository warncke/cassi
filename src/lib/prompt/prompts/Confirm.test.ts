import { describe, it, expect } from "vitest";
import Confirm from "./Confirm.js";

describe("Confirm", () => {
  it("should initialize with a message and default response to null", () => {
    const message = "Are you sure?";
    const confirm = new Confirm(message);

    expect(confirm.message).toBe(message);
    expect(confirm.response).toBeNull();
  });

  it("should allow setting the response property", () => {
    const confirm = new Confirm("Do you agree?");
    confirm.response = true;

    expect(confirm.response).toBe(true);
  });
});
