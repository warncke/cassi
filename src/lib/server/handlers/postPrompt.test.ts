import { describe, it, expect, vi, beforeEach } from "vitest";
import { postPrompt } from "./postPrompt.js";
import { Server } from "../Server.js";
import Input from "../../prompt/prompts/Input.js";
import { Request, Response } from "express";

class MockServer {
  prompts: any[] = [];
}

describe("postPrompt handler", () => {
  let mockServer: MockServer;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let resJsonSpy: ReturnType<typeof vi.spyOn>;
  let resStatusSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockServer = new MockServer();
    mockReq = {
      body: {},
    };
    mockRes = {
      json: vi.fn(),
      status: vi.fn(() => mockRes as Response),
    };
    resJsonSpy = vi.spyOn(mockRes, "json");
    resStatusSpy = vi.spyOn(mockRes, "status");

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should return 400 if prompts array is empty", () => {
    const handler = postPrompt(mockServer as unknown as Server);
    handler(mockReq as Request, mockRes as Response);
    expect(resStatusSpy).toHaveBeenCalledWith(400);
    expect(resJsonSpy).toHaveBeenCalledWith({ error: "No pending prompts" });
  });

  it("should return 400 if response is missing in request body", () => {
    mockServer.prompts = [{ prompt: new Input("Test"), resolve: vi.fn() }];
    const handler = postPrompt(mockServer as unknown as Server);
    handler(mockReq as Request, mockRes as Response);
    expect(resStatusSpy).toHaveBeenCalledWith(400);
    expect(resJsonSpy).toHaveBeenCalledWith({
      error: "Missing response property in request body",
    });
  });

  it("should resolve the prompt and return 200 on success", () => {
    const mockResolve = vi.fn();
    const testPrompt = new Input("Test Prompt");
    mockServer.prompts = [{ prompt: testPrompt, resolve: mockResolve }];
    mockReq.body = { response: "User Response" };

    const handler = postPrompt(mockServer as unknown as Server);
    handler(mockReq as Request, mockRes as Response);

    expect(mockServer.prompts.length).toBe(0);
    expect(testPrompt.response).toBe("User Response");
    expect(mockResolve).toHaveBeenCalledTimes(1);
    expect(resStatusSpy).toHaveBeenCalledWith(200);
    expect(resJsonSpy).toHaveBeenCalledWith({
      message: "Prompt resolved successfully",
    });
  });

  it("should handle the case where promptEntry is unexpectedly undefined (internal error)", () => {
    mockServer.prompts = [null as any];
    mockReq.body = { response: "User Response" };

    const handler = postPrompt(mockServer as unknown as Server);
    mockServer.prompts.shift();
    const handlerAgain = postPrompt(mockServer as unknown as Server);
    handlerAgain(mockReq as Request, mockRes as Response);

    expect(resStatusSpy).toHaveBeenCalledWith(400);
    expect(resJsonSpy).toHaveBeenCalledWith({ error: "No pending prompts" });

    vi.clearAllMocks();
    mockServer = new MockServer();
    mockReq.body = { response: "User Response" };

    mockServer.prompts = [{ prompt: new Input("Test"), resolve: vi.fn() }];
    const shiftSpy = vi
      .spyOn(mockServer.prompts, "shift")
      .mockReturnValueOnce(undefined);

    const handlerInternalError = postPrompt(mockServer as unknown as Server);
    handlerInternalError(mockReq as Request, mockRes as Response);

    expect(shiftSpy).toHaveBeenCalledTimes(1);
    expect(resStatusSpy).toHaveBeenCalledWith(500);
    expect(resJsonSpy).toHaveBeenCalledWith({ error: "Internal server error" });

    shiftSpy.mockRestore();
  });
});
