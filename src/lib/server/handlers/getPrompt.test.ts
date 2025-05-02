import { describe, it, expect, vi, beforeEach } from "vitest";
import { getPrompt } from "./getPrompt.js";
import { Server } from "../Server.js";
import Input from "../../prompt/prompts/Input.js";
import { Request, Response } from "express";

class MockServer {
  prompts: any[] = [];
}

describe("getPrompt handler", () => {
  let mockServer: MockServer;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let resJsonSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockServer = new MockServer();
    mockReq = {};
    mockRes = {
      json: vi.fn(),
    };
    resJsonSpy = vi.spyOn(mockRes, "json");

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should return null when prompts array is empty", () => {
    const handler = getPrompt(mockServer as unknown as Server);
    handler(mockReq as Request, mockRes as Response);
    expect(resJsonSpy).toHaveBeenCalledWith(null);
  });

  it("should return the first prompt when prompts array has one item", () => {
    const testPrompt = new Input("Test Prompt 1");
    mockServer.prompts = [{ prompt: testPrompt }];
    const handler = getPrompt(mockServer as unknown as Server);
    handler(mockReq as Request, mockRes as Response);
    expect(resJsonSpy).toHaveBeenCalledWith(testPrompt);
  });

  it("should return the first prompt when prompts array has multiple items", () => {
    const testPrompt1 = new Input("Test Prompt 1");
    const testPrompt2 = new Input("Test Prompt 2");
    mockServer.prompts = [{ prompt: testPrompt1 }, { prompt: testPrompt2 }];
    const handler = getPrompt(mockServer as unknown as Server);
    handler(mockReq as Request, mockRes as Response);
    expect(resJsonSpy).toHaveBeenCalledWith(testPrompt1);
  });
});
