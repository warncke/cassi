import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import { getDir } from "./getDir.js";
import { type Request, type Response } from "express";
import { promises as fs } from "fs";
import { glob } from "glob";
import path from "path";
import { type Server } from "../Server.js";
import { type Cassi } from "../../cassi/Cassi.js";
import { type Repository } from "../../repository/Repository.js";

vi.mock("glob");
vi.mock("fs", () => ({
  promises: {
    readFile: vi.fn(),
  },
}));
vi.mock("path", () => ({
  default: {
    join: vi.fn((...args) => args.join("/")),
  },
}));

describe("getDir handler", () => {
  let mockServer: Partial<Server>;
  let mockCassi: Partial<Cassi>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let statusFn: Mock;
  let jsonFn: Mock;
  let mockGlob: Mock;
  let mockReadFile: Mock;
  let mockPathJoin: Mock;

  beforeEach(() => {
    mockGlob = vi.mocked(glob);
    mockReadFile = vi.mocked(fs.readFile);
    mockPathJoin = vi.mocked(path.join);
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
    mockReq = {};
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should return 200 and the list of ts files with their content", async () => {
    const fakeFiles = ["src/file1.ts", "lib/file2.ts"];
    const fakeContent1 = "content of file1";
    const fakeContent2 = "content of file2";
    mockGlob.mockResolvedValue(fakeFiles);
    mockReadFile
      .mockResolvedValueOnce(fakeContent1)
      .mockResolvedValueOnce(fakeContent2);
    mockPathJoin.mockImplementation((...args) => args.join("/"));

    const handler = getDir(mockServer as Server);
    await handler(mockReq as Request, mockRes as Response);

    expect(statusFn).toHaveBeenCalledWith(200);
    expect(jsonFn).toHaveBeenCalledWith([
      { id: 1, name: "src/file1.ts", content: fakeContent1 },
      { id: 2, name: "lib/file2.ts", content: fakeContent2 },
    ]);
    expect(mockGlob).toHaveBeenCalledWith("**/*", {
      ignore: ["node_modules/**", ".cassi/**", "dist/**"],
      cwd: "/fake/repo/dir",
      absolute: false,
      nodir: true,
    });
    expect(mockReadFile).toHaveBeenCalledTimes(2);
    expect(mockReadFile).toHaveBeenCalledWith(
      "/fake/repo/dir/src/file1.ts",
      "utf-8"
    );
    expect(mockReadFile).toHaveBeenCalledWith(
      "/fake/repo/dir/lib/file2.ts",
      "utf-8"
    );
    expect(mockPathJoin).toHaveBeenCalledWith("/fake/repo/dir", "src/file1.ts");
    expect(mockPathJoin).toHaveBeenCalledWith("/fake/repo/dir", "lib/file2.ts");
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
    consoleErrorSpy.mockRestore();
  });

  it("should return 500 if fs.readFile throws an error", async () => {
    const fakeFiles = ["src/file1.ts"];
    const error = new Error("Read file failed");
    mockGlob.mockResolvedValue(fakeFiles);
    mockReadFile.mockRejectedValue(error);
    mockPathJoin.mockImplementation((...args) => args.join("/"));
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
    consoleErrorSpy.mockRestore();
  });
});
