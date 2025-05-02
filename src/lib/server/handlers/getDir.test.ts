import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import { getDir } from "./getDir.js";
import { type Request, type Response } from "express";
import { glob } from "glob";
import { type Server } from "../Server.js";
import { type Cassi } from "../../cassi/Cassi.js";
import { type Repository } from "../../repository/Repository.js";

vi.mock("glob");

describe("getDir handler", () => {
  let mockServer: Partial<Server>;
  let mockCassi: Partial<Cassi>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let statusFn: Mock;
  let jsonFn: Mock;
  let mockGlob: Mock;

  beforeEach(() => {
    // Access the mocked function correctly after vi.mock
    mockGlob = vi.mocked(glob);
    mockCassi = {
      repository: {
        repositoryDir: "/fake/repo/dir",
      } as Repository,
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
    mockReq = {}; // No specific request properties needed yet
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return 200 and the list of ts files", async () => {
    const fakeFiles = ["src/file1.ts", "lib/file2.ts"];
    mockGlob.mockResolvedValue(fakeFiles);

    const handler = getDir(mockServer as Server);
    await handler(mockReq as Request, mockRes as Response);

    expect(statusFn).toHaveBeenCalledWith(200);
    expect(jsonFn).toHaveBeenCalledWith({ files: fakeFiles });
    expect(mockGlob).toHaveBeenCalledWith("**/*.ts", {
      ignore: ["node_modules/**", ".cassi/**", "dist/**"],
      cwd: "/fake/repo/dir",
      absolute: false,
    });
  });

  it("should return 500 if server.cassi is null", async () => {
    mockServer.cassi = null;
    const handler = getDir(mockServer as Server);

    await handler(mockReq as Request, mockRes as Response);

    expect(statusFn).toHaveBeenCalledWith(500);
    expect(jsonFn).toHaveBeenCalledWith({
      error: "Server not fully initialized",
    });
  });

  it("should return 500 if glob throws an error", async () => {
    const error = new Error("Glob failed");
    mockGlob.mockRejectedValue(error);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const handler = getDir(mockServer as Server);
    await handler(mockReq as Request, mockRes as Response);

    expect(statusFn).toHaveBeenCalledWith(500);
    expect(jsonFn).toHaveBeenCalledWith({ error: "Internal Server Error" });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error getting directory listing:",
      error
    );
  });
});
