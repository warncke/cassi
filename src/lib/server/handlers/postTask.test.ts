import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import { postTask } from "./postTask.js";
import { type Request, type Response } from "express";
import { type Server } from "../Server.js";
import { promises as fs } from "fs";
import * as fsPromises from "fs/promises"; // Use namespace import
import path from "path";

// Mock the entire fs/promises module
vi.mock("fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof fsPromises>();
  return {
    ...actual, // Include actual implementations for other functions if needed
    writeFile: vi.fn(), // Define the mock function directly here
  };
});

vi.mock("path", async () => {
  const actualPath = await vi.importActual<typeof path>("path");
  return {
    ...actualPath,
    resolve: vi.fn((...args) => actualPath.resolve(...args)), // Keep resolve working but allow spying
  };
});

describe("postTask handler", () => {
  let mockServer: Server;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let statusFn: Mock;
  let jsonFn: Mock;

  beforeEach(() => {
    mockServer = {} as Server;
    statusFn = vi.fn().mockReturnThis();
    jsonFn = vi.fn();
    mockRes = {
      status: statusFn,
      json: jsonFn,
    };
    mockReq = {
      body: {},
    };
    vi.spyOn(path, "resolve").mockReturnValue("/fake/path/audio.opus");
    // Reset the fs mock directly before each test
    vi.spyOn(path, "resolve").mockReturnValue("/fake/path/audio.opus");
    // Reset the fs mock directly before each test
    (fsPromises.writeFile as Mock).mockClear();
    (fsPromises.writeFile as Mock).mockImplementation(() => Promise.resolve());
    // Don't restore all mocks here, let afterEach handle it.
  });

  afterEach(() => {
    // Restore all mocks created with vi.spyOn or vi.fn().mockImplementation
    vi.restoreAllMocks();
  });

  it("should return 201, save the audio file, and return success message on valid input", async () => {
    const handler = postTask(mockServer);
    const testBase64 = Buffer.from("test audio data").toString("base64");
    mockReq.body = { audioBase64: testBase64 };

    await handler(mockReq as Request, mockRes as Response);

    expect(statusFn).toHaveBeenCalledWith(201);
    expect(jsonFn).toHaveBeenCalledWith({
      message: "Task received and audio saved",
    });
    expect(fsPromises.writeFile).toHaveBeenCalledOnce();
    expect(fsPromises.writeFile).toHaveBeenCalledWith(
      "/fake/path/audio.opus",
      Buffer.from(testBase64, "base64")
    );
    expect(path.resolve).toHaveBeenCalledWith("audio.opus");
  });

  it("should return 400 if audioBase64 is missing", async () => {
    const handler = postTask(mockServer);
    mockReq.body = {}; // No audioBase64

    await handler(mockReq as Request, mockRes as Response);

    expect(statusFn).toHaveBeenCalledWith(400);
    expect(jsonFn).toHaveBeenCalledWith({
      error: "Missing or invalid audioBase64 field",
    });
    expect(fsPromises.writeFile).not.toHaveBeenCalled();
  });

  it("should return 400 if audioBase64 is not a string", async () => {
    const handler = postTask(mockServer);
    mockReq.body = { audioBase64: 12345 }; // Invalid type

    await handler(mockReq as Request, mockRes as Response);

    expect(statusFn).toHaveBeenCalledWith(400);
    expect(jsonFn).toHaveBeenCalledWith({
      error: "Missing or invalid audioBase64 field",
    });
    expect(fsPromises.writeFile).not.toHaveBeenCalled();
  });

  it("should return 500 if fs.writeFile fails", async () => {
    const handler = postTask(mockServer);
    const testBase64 = Buffer.from("test audio data").toString("base64");
    mockReq.body = { audioBase64: testBase64 };
    const writeError = new Error("Disk full");
    // Manipulate the mock function directly
    (fsPromises.writeFile as Mock).mockRejectedValueOnce(writeError);

    await handler(mockReq as Request, mockRes as Response);

    expect(statusFn).toHaveBeenCalledWith(500);
    expect(jsonFn).toHaveBeenCalledWith({ error: "Internal Server Error" });
  });

  it("should return 500 if Buffer.from throws", async () => {
    const handler = postTask(mockServer);
    const testBase64 = "valid-looking-base64-but-we-mock-failure";
    mockReq.body = { audioBase64: testBase64 };

    const bufferError = new Error("Simulated Buffer.from error");
    const originalBufferFrom = Buffer.from; // Keep reference to original

    // Mock Buffer.from to throw only for our specific test case
    const bufferFromSpy = vi
      .spyOn(Buffer, "from")
      .mockImplementation((value, encoding) => {
        if (value === testBase64 && encoding === "base64") {
          // Restore immediately after the first intended call to prevent infinite loops
          // if the handler somehow calls Buffer.from again within the catch block.
          bufferFromSpy.mockRestore();
          throw bufferError;
        }
        // Call the original function for any other arguments
        return originalBufferFrom(value, encoding);
      });

    await handler(mockReq as Request, mockRes as Response);

    expect(statusFn).toHaveBeenCalledWith(500);
    expect(jsonFn).toHaveBeenCalledWith({ error: "Internal Server Error" });
    expect(fsPromises.writeFile).not.toHaveBeenCalled();

    // Ensure restoration if the mock wasn't triggered (though it should have been)
    if (bufferFromSpy.mockRestore) {
      bufferFromSpy.mockRestore();
    }
  });
});
