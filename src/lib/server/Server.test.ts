import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import { Server } from "./Server.js";
import express, { Request, Response } from "express";
import { Cassi } from "../cassi/Cassi.js";
import { User } from "../user/User.js";
import { Prompt } from "../prompt/Prompt.js";
import Input from "../prompt/prompts/Input.js";
import Confirm from "../prompt/prompts/Confirm.js";

let getRouteHandler: ((req: Request, res: Response) => void) | null = null;
let postRouteHandler: ((req: Request, res: Response) => void) | null = null;
let listenCallback: (() => void) | null = null;

const mockCorsMiddleware = vi.fn((req: any, res: any, next: any) => next());
vi.mock("cors", () => ({
  default: vi.fn(() => mockCorsMiddleware),
}));

const mockJsonMiddleware = vi.fn((req: any, res: any, next: any) => next());

vi.mock("express", () => {
  const mockApp = {
    use: vi.fn(),
    get: vi.fn((path, handler) => {
      if (path === "/prompt") {
        getRouteHandler = handler;
      }
    }),
    post: vi.fn((path, handler) => {
      if (path === "/prompt") {
        postRouteHandler = handler;
      }
    }),
    listen: vi.fn((port, host, callback) => {
      listenCallback = callback;
      if (listenCallback) {
        listenCallback();
      }
    }),
  };
  const mockExpress = vi.fn(() => mockApp);
  (mockExpress as any).json = vi.fn(() => mockJsonMiddleware);

  return {
    default: mockExpress,
  };
});

import cors from "cors";

describe("Server", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let server: Server;
  let mockUser: User;
  let mockCassi: Cassi;
  let mockApp: ReturnType<typeof express>;
  let runTasksSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    getRouteHandler = null;
    postRouteHandler = null;
    listenCallback = null;
    vi.clearAllMocks();

    mockApp = express();

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    server = new Server();
    mockUser = new User(
      async () => {},
      async () => {}
    );
    mockCassi = new Cassi(mockUser, "mockConfig", "mockRepo");
    runTasksSpy = vi
      .spyOn(mockCassi, "runTasks")
      .mockImplementation(async () => {});
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.restoreAllMocks();
  });

  it("should initialize with default host and port", () => {
    expect(server.getHost()).toBe("localhost");
    expect(server.getPort()).toBe(7777);
  });

  it("should initialize with provided host and port and empty prompts", () => {
    const serverWithArgs = new Server("127.0.0.1", 8080);
    expect(serverWithArgs.getHost()).toBe("127.0.0.1");
    expect(serverWithArgs.getPort()).toBe(8080);
    expect(serverWithArgs.prompts).toEqual([]);
  });

  it("should initialize the express app, reset prompts, and register /prompt route on init", async () => {
    expect(server.getApp()).toBeNull();

    (express as unknown as ReturnType<typeof vi.fn>).mockClear();

    await server.init(mockCassi);
    const app = server.getApp();
    expect(app).not.toBeNull();
    expect(express).toHaveBeenCalledTimes(1);
    expect(server.prompts).toEqual([]);
    expect(app?.use).toHaveBeenCalledWith(expect.any(Function));
    expect(app?.get).toHaveBeenCalledWith("/prompt", expect.any(Function));
    expect(app?.post).toHaveBeenCalledWith("/prompt", expect.any(Function));
    expect(getRouteHandler).toBeInstanceOf(Function);
    expect(postRouteHandler).toBeInstanceOf(Function);
    expect(app?.listen).toHaveBeenCalledWith(
      server.getPort(),
      server.getHost(),
      expect.any(Function)
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      `Server listening on http://${server.getHost()}:${server.getPort()}`
    );
  });

  it("should use cors middleware before express.json middleware", async () => {
    await server.init(mockCassi);
    const app = server.getApp();
    expect(app).not.toBeNull();

    expect(app!.use).toHaveBeenCalledWith(mockCorsMiddleware);
    expect(app!.use).toHaveBeenCalledWith(mockJsonMiddleware);

    const useCalls = (app!.use as ReturnType<typeof vi.fn>).mock.calls;
    const corsCallIndex = useCalls.findIndex(
      (call) => call[0] === mockCorsMiddleware
    );
    const jsonCallIndex = useCalls.findIndex(
      (call) => call[0] === mockJsonMiddleware
    );

    expect(corsCallIndex).toBeGreaterThan(-1);
    expect(jsonCallIndex).toBeGreaterThan(-1);
    expect(corsCallIndex).toBeLessThan(jsonCallIndex);
  });

  it("should configure express.json middleware with a 1mb limit", async () => {
    await server.init(mockCassi);
    const app = server.getApp();
    expect(app).not.toBeNull();

    expect((express as any).json).toHaveBeenCalledWith({ limit: "1mb" });
    expect(app!.use).toHaveBeenCalledWith(mockJsonMiddleware);
  });

  it("should wait for the server to listen before resolving init", async () => {
    let listenCalled = false;
    let initResolved = false;

    const theMockApp = express();
    const listenMock = theMockApp.listen as ReturnType<typeof vi.fn>;

    listenMock.mockImplementationOnce((port, host, cb) => {
      listenCalled = true;
      setTimeout(() => {
        expect(initResolved).toBe(false);
        cb();
      }, 0);
    });

    const initPromise = server.init(mockCassi);

    await vi.advanceTimersByTimeAsync(0);

    await initPromise;
    initResolved = true;

    expect(listenCalled).toBe(true);
    expect(initResolved).toBe(true);
    expect(listenMock).toHaveBeenCalledTimes(1);
    expect(listenMock).toHaveBeenCalledWith(
      server.getPort(),
      server.getHost(),
      expect.any(Function)
    );
  });

  it("should return the express app instance", async () => {
    await server.init(mockCassi);
    const app = server.getApp();
    expect(app).toBeDefined();
  });

  it("should return the host", () => {
    const serverWithHost = new Server("testhost");
    expect(serverWithHost.getHost()).toBe("testhost");
  });

  it("should return the port", () => {
    const serverWithPort = new Server("localhost", 9999);
    expect(serverWithPort.getPort()).toBe(9999);
  });

  it("addPrompt should add a prompt entry to the prompts array", () => {
    const inputPrompt = new Input("Test prompt");
    server.addPrompt(inputPrompt);
    expect(server.prompts.length).toBe(1);
    expect(server.prompts[0].prompt).toBe(inputPrompt);
    expect(server.prompts[0].promise).toBeInstanceOf(Promise);
    expect(server.prompts[0].resolve).toBeInstanceOf(Function);
    expect(server.prompts[0].reject).toBeInstanceOf(Function);

    const confirmPrompt = new Confirm("Confirm?");
    server.addPrompt(confirmPrompt);
    expect(server.prompts.length).toBe(2);
    expect(server.prompts[1].prompt).toBe(confirmPrompt);
    expect(server.prompts[1].promise).toBeInstanceOf(Promise);

  });

  describe("GET /prompt route", () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let resJsonSpy: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      await server.init(mockCassi);
      if (!getRouteHandler) {
        throw new Error("GET /prompt route handler not captured");
      }
      resJsonSpy = vi.fn();
      mockReq = {};
      mockRes = {
        json: resJsonSpy,
      };
    });

    it("should return null if prompts array is empty", () => {
      server.prompts = [];
      getRouteHandler!(mockReq as Request, mockRes as Response);
      expect(resJsonSpy).toHaveBeenCalledWith(null);
    });

    it("should return the first prompt if prompts array is not empty", () => {
      const firstPrompt = new Input("First!");
      const secondPrompt = new Confirm("Second?");
      server.addPrompt(firstPrompt);
      server.addPrompt(secondPrompt);
      getRouteHandler!(mockReq as Request, mockRes as Response);
      expect(resJsonSpy).toHaveBeenCalledWith(firstPrompt);
    });

    it("should not remove the prompt from the array", () => {
      const firstPrompt = new Input("First!");
      const secondPrompt = new Confirm("Second?");
      server.addPrompt(firstPrompt);
      server.addPrompt(secondPrompt);
      getRouteHandler!(mockReq as Request, mockRes as Response);
      expect(resJsonSpy).toHaveBeenCalledWith(firstPrompt);
      expect(server.prompts.length).toBe(2);
      expect(server.prompts[0].prompt).toBe(firstPrompt);
      expect(server.prompts[1].prompt).toBe(secondPrompt);
    });
  });

  describe("POST /prompt route", () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let resStatusSpy: ReturnType<typeof vi.fn>;
    let resJsonSpy: ReturnType<typeof vi.fn>;
    let promptPromise: Promise<any>;
    let promptResolve: (value: any) => void;
    let promptReject: (reason?: any) => void;
    let testPrompt: Prompt;

    beforeEach(async () => {
      await server.init(mockCassi);
      if (!postRouteHandler) {
        throw new Error("POST /prompt route handler not captured");
      }

      resJsonSpy = vi.fn();
      resStatusSpy = vi.fn(() => ({ json: resJsonSpy }));
      mockRes = {
        status: resStatusSpy,
        json: resJsonSpy,
      };

      testPrompt = new Input("Test Input");
      promptPromise = new Promise((res, rej) => {
        promptResolve = res;
        promptReject = rej;
      });
      server.prompts = [
        {
          prompt: testPrompt,
          promise: promptPromise,
          resolve: promptResolve,
          reject: promptReject,
        },
      ];
    });

    it("should return 400 if prompts array is empty", () => {
      server.prompts = [];
      mockReq = { body: { response: "some response" } };

      postRouteHandler!(mockReq as Request, mockRes as Response);

      expect(resStatusSpy).toHaveBeenCalledWith(400);
      expect(resJsonSpy).toHaveBeenCalledWith({ error: "No pending prompts" });
    });

    it("should return 400 and reject promise if response is missing in body", async () => {
      mockReq = { body: {} };
      const rejectSpy = vi.spyOn(server.prompts[0], "reject");

      postRouteHandler!(mockReq as Request, mockRes as Response);

      expect(resStatusSpy).toHaveBeenCalledWith(400);
      expect(resJsonSpy).toHaveBeenCalledWith({
        error: "Missing response property in request body",
      });
      expect(rejectSpy).not.toHaveBeenCalled();

    });

    it("should resolve the prompt, set response, remove from array, and return 200 on success", async () => {
      const mockResponseValue = "User provided response";
      mockReq = { body: { response: mockResponseValue } };
      const resolveSpy = vi.spyOn(server.prompts[0], "resolve");
      const initialPromptCount = server.prompts.length;

      postRouteHandler!(mockReq as Request, mockRes as Response);

      expect(resStatusSpy).toHaveBeenCalledWith(200);
      expect(resJsonSpy).toHaveBeenCalledWith({
        message: "Prompt resolved successfully",
      });

      expect(testPrompt.response).toBe(mockResponseValue);
      expect(server.prompts.length).toBe(initialPromptCount - 1);

      expect(resolveSpy).toHaveBeenCalledTimes(1);
      expect(resolveSpy).toHaveBeenCalledWith();

      await expect(promptPromise).resolves.toBeUndefined();
    });

    it("should handle undefined response correctly (rejects)", async () => {
      mockReq = { body: { response: undefined } };
      const rejectSpy = vi.spyOn(server.prompts[0], "reject");

      postRouteHandler!(mockReq as Request, mockRes as Response);

      expect(resStatusSpy).toHaveBeenCalledWith(400);
      expect(resJsonSpy).toHaveBeenCalledWith({
        error: "Missing response property in request body",
      });
      expect(rejectSpy).not.toHaveBeenCalled();
    });
  });

  describe("setInterval task runner", () => {
    beforeEach(async () => {
      await server.init(mockCassi);
      runTasksSpy.mockClear();
    });

    it("should call cassi.runTasks every 50ms when prompts is empty", async () => {
      expect(runTasksSpy).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(50);
      expect(runTasksSpy).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(50);
      expect(runTasksSpy).toHaveBeenCalledTimes(2);
    });

    it("should not call cassi.runTasks when prompts is not empty", async () => {
      expect(runTasksSpy).not.toHaveBeenCalled();

      server.addPrompt(new Input("Test"));
      expect(server.prompts.length).toBe(1);

      await vi.advanceTimersByTimeAsync(50);
      expect(runTasksSpy).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(50);
      expect(runTasksSpy).not.toHaveBeenCalled();
    });

    it("should resume calling cassi.runTasks when prompts becomes empty again", async () => {
      server.addPrompt(new Input("Test"));
      expect(server.prompts.length).toBe(1);

      await vi.advanceTimersByTimeAsync(50);
      expect(runTasksSpy).not.toHaveBeenCalled();

      server.prompts.shift();
      expect(server.prompts.length).toBe(0);

      await vi.advanceTimersByTimeAsync(50);
      expect(runTasksSpy).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(50);
      expect(runTasksSpy).toHaveBeenCalledTimes(2);
    });

    it("should not call runTasks if cassi instance is null (edge case, shouldn't happen after init)", async () => {
      (server as any).cassi = null;

      await vi.advanceTimersByTimeAsync(50);
      expect(runTasksSpy).not.toHaveBeenCalled();
    });
  });
});
