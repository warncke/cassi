import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import { postTask } from "./postTask.js";
import { type Request, type Response } from "express";
import { type Server } from "../Server.js";
import { type Cassi } from "../../cassi/Cassi.js";
import * as fsPromises from "fs/promises";
import path from "path";

vi.mock("fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof fsPromises>();
  return {
    ...actual,
    writeFile: vi.fn(),
  };
});

vi.mock("path", async () => {
  const actualPath = await vi.importActual<typeof path>("path");
  return {
    ...actualPath,
    resolve: vi.fn((...args) => actualPath.resolve(...args)),
  };
});

describe("postTask handler", () => {
  let mockServer: Partial<Server>;
  let mockCassi: Partial<Cassi>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let statusFn: Mock;
  let jsonFn: Mock;
  let newTaskFn: Mock;
  let runTasksFn: Mock;

  beforeEach(() => {
    newTaskFn = vi.fn();
    runTasksFn = vi.fn();
    mockCassi = {
      newTask: newTaskFn,
      runTasks: runTasksFn,
    };
    mockServer = {
      cassi: mockCassi as Cassi,
    };
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
    (fsPromises.writeFile as Mock).mockClear();
    (fsPromises.writeFile as Mock).mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return 201, save audio, call cassi methods, and return success message on valid input", async () => {
    const handler = postTask(mockServer as Server);
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
    expect(newTaskFn).toHaveBeenCalledOnce();
    expect(newTaskFn).toHaveBeenCalledWith("AudioCode", undefined, testBase64);
    expect(runTasksFn).toHaveBeenCalledOnce();
  });

  it("should return 400 if audioBase64 is missing", async () => {
    const handler = postTask(mockServer as Server);
    mockReq.body = {};

    await handler(mockReq as Request, mockRes as Response);

    expect(statusFn).toHaveBeenCalledWith(400);
    expect(jsonFn).toHaveBeenCalledWith({
      error: "Missing or invalid audioBase64 field",
    });
    expect(fsPromises.writeFile).not.toHaveBeenCalled();
    expect(newTaskFn).not.toHaveBeenCalled();
    expect(runTasksFn).not.toHaveBeenCalled();
  });

  it("should return 400 if audioBase64 is not a string", async () => {
    const handler = postTask(mockServer as Server);
    mockReq.body = { audioBase64: 12345 };

    await handler(mockReq as Request, mockRes as Response);

    expect(statusFn).toHaveBeenCalledWith(400);
    expect(jsonFn).toHaveBeenCalledWith({
      error: "Missing or invalid audioBase64 field",
    });
    expect(fsPromises.writeFile).not.toHaveBeenCalled();
    expect(newTaskFn).not.toHaveBeenCalled();
    expect(runTasksFn).not.toHaveBeenCalled();
  });

  it("should return 500 if fs.writeFile fails", async () => {
    const handler = postTask(mockServer as Server);
    const testBase64 = Buffer.from("test audio data").toString("base64");
    mockReq.body = { audioBase64: testBase64 };
    const writeError = new Error("Disk full");
    (fsPromises.writeFile as Mock).mockRejectedValueOnce(writeError);

    await handler(mockReq as Request, mockRes as Response);

    expect(statusFn).toHaveBeenCalledWith(500);
    expect(jsonFn).toHaveBeenCalledWith({ error: "Internal Server Error" });
    expect(newTaskFn).not.toHaveBeenCalled();
    expect(runTasksFn).not.toHaveBeenCalled();
  });

  it("should return 500 if Buffer.from throws", async () => {
    const handler = postTask(mockServer as Server);
    const testBase64 = "invalid-base64-string";
    mockReq.body = { audioBase64: testBase64 };

    const bufferError = new Error("Simulated Buffer.from error");
    const originalBufferFrom = Buffer.from;

    const bufferFromSpy = vi
      .spyOn(Buffer, "from")
      .mockImplementation((value, encoding) => {
        if (value === testBase64 && encoding === "base64") {
          bufferFromSpy.mockRestore();
          throw bufferError;
        }
        return originalBufferFrom(value, encoding);
      });

    await handler(mockReq as Request, mockRes as Response);

    expect(statusFn).toHaveBeenCalledWith(500);
    expect(jsonFn).toHaveBeenCalledWith({ error: "Internal Server Error" });
    expect(fsPromises.writeFile).not.toHaveBeenCalled();
    expect(newTaskFn).not.toHaveBeenCalled();
    expect(runTasksFn).not.toHaveBeenCalled();

    expect(Buffer.from).toBe(originalBufferFrom);
  });
});
