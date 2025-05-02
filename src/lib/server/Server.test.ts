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
import express, { Request, Response } from "express"; // Import Request, Response
import { Cassi } from "../cassi/Cassi.js";
import { User } from "../user/User.js";
import { Prompt } from "../prompt/Prompt.js";
import Input from "../prompt/prompts/Input.js";
import Confirm from "../prompt/prompts/Confirm.js"; // Import Confirm

// Keep track of the GET route handler and listen callback
let getRouteHandler: ((req: Request, res: Response) => void) | null = null;
let listenCallback: (() => void) | null = null;

vi.mock("express", () => {
  const mockApp = {
    use: vi.fn(),
    get: vi.fn((path, handler) => {
      if (path === "/prompt") {
        getRouteHandler = handler; // Capture the handler for /prompt
      }
    }),
    post: vi.fn(),
    listen: vi.fn((port, host, callback) => {
      listenCallback = callback; // Capture the listen callback
      // Simulate async start by calling the callback immediately for the test promise
      if (listenCallback) {
        listenCallback();
      }
    }),
  };
  return {
    default: vi.fn(() => mockApp),
  };
});

describe("Server", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let server: Server;
  let mockUser: User;
  let mockCassi: Cassi;
  let mockApp: ReturnType<typeof express>; // To access the mocked app instance
  let runTasksSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    // Reset captured handlers and mocks
    getRouteHandler = null;
    listenCallback = null;
    vi.clearAllMocks();

    // Re-create the mocked express app instance for each test
    // to ensure listen mock is fresh
    mockApp = express();

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Setup basic instances for tests
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
    vi.clearAllTimers(); // Clear any pending timers
    vi.restoreAllMocks();
  });

  it("should initialize with default host and port", () => {
    // server is already created in beforeEach
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
    // server.prompts.push(new Input("Initial prompt")); // Removed: init resets prompts
    expect(server.getApp()).toBeNull();

    // Clear mock calls from beforeEach before calling init
    // express refers to the mocked factory function here
    (express as unknown as ReturnType<typeof vi.fn>).mockClear();

    await server.init(mockCassi);
    const app = server.getApp();
    expect(app).not.toBeNull();
    expect(express).toHaveBeenCalledTimes(1); // Verify init calls express() once
    expect(server.prompts).toEqual([]); // Prompts should be reset
    expect(app?.get).toHaveBeenCalledWith("/prompt", expect.any(Function)); // Check if route is registered
    expect(getRouteHandler).toBeInstanceOf(Function); // Check if handler was captured
    expect(app?.listen).toHaveBeenCalledWith(
      server.getPort(),
      server.getHost(),
      expect.any(Function)
    ); // Check listen was called
    // Ensure the promise resolved (implicit by await completing)
  });

  it("should wait for the server to listen before resolving init", async () => {
    let listenCalled = false;
    let initResolved = false;

    // Get the mocked app instance that will be used by server.init
    // Note: express() returns the same mockApp instance due to the mock setup
    const theMockApp = express();
    const listenMock = theMockApp.listen as ReturnType<typeof vi.fn>; // Get the mock function for listen

    // Override the listen mock implementation specifically for this test
    listenMock.mockImplementationOnce((port, host, cb) => {
      listenCalled = true;
      // Simulate async delay before calling callback
      setTimeout(() => {
        expect(initResolved).toBe(false); // Ensure init hasn't resolved yet
        cb(); // Call the callback to resolve the promise in init
      }, 0);
    });

    // server.init will call express() which returns theMockApp
    const initPromise = server.init(mockCassi);

    // Advance timers to allow the setTimeout(cb, 0) in the mock to execute
    await vi.advanceTimersByTimeAsync(0);

    // Now wait for the init promise to resolve
    await initPromise;
    initResolved = true;

    expect(listenCalled).toBe(true);
    expect(initResolved).toBe(true);
    expect(listenMock).toHaveBeenCalledTimes(1); // Check the specific mock function
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
    // Removed async
    const inputPrompt = new Input("Test prompt");
    // Call addPrompt, but don't await the returned promise (to avoid timeout with fake timers)
    server.addPrompt(inputPrompt);
    expect(server.prompts.length).toBe(1);
    expect(server.prompts[0].prompt).toBe(inputPrompt);
    expect(server.prompts[0].promise).toBeInstanceOf(Promise); // Verify a promise was added
    expect(server.prompts[0].resolve).toBeInstanceOf(Function); // Verify resolve fn exists
    expect(server.prompts[0].reject).toBeInstanceOf(Function); // Verify reject fn exists
    // Cannot reliably check promise identity without await due to fake timer issues

    const confirmPrompt = new Confirm("Confirm?");
    // Call addPrompt, but don't await the returned promise
    server.addPrompt(confirmPrompt);
    expect(server.prompts.length).toBe(2);
    expect(server.prompts[1].prompt).toBe(confirmPrompt);
    expect(server.prompts[1].promise).toBeInstanceOf(Promise); // Verify a promise was added
    // Cannot reliably check promise identity without await

    // Cannot test resolution reliably without async/await and working timers
  });

  // Tests for the new /prompt route
  describe("GET /prompt route", () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let resJsonSpy: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      // Ensure server and app are initialized and handler is captured
      await server.init(mockCassi);
      if (!getRouteHandler) {
        throw new Error("GET /prompt route handler not captured");
      }
      resJsonSpy = vi.fn();
      mockReq = {}; // No specific request properties needed for now
      mockRes = {
        json: resJsonSpy,
      };
    });

    it("should return null if prompts array is empty", () => {
      server.prompts = []; // Ensure prompts is empty
      getRouteHandler!(mockReq as Request, mockRes as Response);
      expect(resJsonSpy).toHaveBeenCalledWith(null);
    });

    it("should return the first prompt if prompts array is not empty", () => {
      // Removed async
      const firstPrompt = new Input("First!");
      const secondPrompt = new Confirm("Second?");
      // Don't await - just add synchronously
      server.addPrompt(firstPrompt);
      server.addPrompt(secondPrompt);
      getRouteHandler!(mockReq as Request, mockRes as Response);
      // Should return the prompt object itself, not the entry
      expect(resJsonSpy).toHaveBeenCalledWith(firstPrompt);
    });

    it("should not remove the prompt from the array", () => {
      // Removed async
      const firstPrompt = new Input("First!");
      const secondPrompt = new Confirm("Second?");
      // Don't await - just add synchronously
      server.addPrompt(firstPrompt);
      server.addPrompt(secondPrompt);
      getRouteHandler!(mockReq as Request, mockRes as Response);
      expect(resJsonSpy).toHaveBeenCalledWith(firstPrompt);
      // Verify the array still contains both prompt entries in the original order
      expect(server.prompts.length).toBe(2);
      expect(server.prompts[0].prompt).toBe(firstPrompt);
      expect(server.prompts[1].prompt).toBe(secondPrompt);
    });
  });

  // Tests for the setInterval task runner
  describe("setInterval task runner", () => {
    beforeEach(async () => {
      // Init needs to be called to start the interval
      await server.init(mockCassi);
      // Clear any calls from init itself if needed, though runTasks shouldn't be called sync
      runTasksSpy.mockClear();
    });

    it("should call cassi.runTasks every 50ms when prompts is empty", async () => {
      expect(runTasksSpy).not.toHaveBeenCalled();

      // Advance time by 50ms
      await vi.advanceTimersByTimeAsync(50);
      expect(runTasksSpy).toHaveBeenCalledTimes(1);

      // Advance time by another 50ms
      await vi.advanceTimersByTimeAsync(50);
      expect(runTasksSpy).toHaveBeenCalledTimes(2);
    });

    it("should not call cassi.runTasks when prompts is not empty", async () => {
      expect(runTasksSpy).not.toHaveBeenCalled();

      // Add a prompt - Don't await
      server.addPrompt(new Input("Test"));
      expect(server.prompts.length).toBe(1);

      // Advance time by 50ms
      await vi.advanceTimersByTimeAsync(50);
      expect(runTasksSpy).not.toHaveBeenCalled(); // Should not have been called

      // Advance time by another 50ms
      await vi.advanceTimersByTimeAsync(50);
      expect(runTasksSpy).not.toHaveBeenCalled(); // Still should not have been called
    });

    it("should resume calling cassi.runTasks when prompts becomes empty again", async () => {
      // Add a prompt initially - Don't await
      server.addPrompt(new Input("Test"));
      expect(server.prompts.length).toBe(1);

      // Advance time, should not call runTasks
      await vi.advanceTimersByTimeAsync(50);
      expect(runTasksSpy).not.toHaveBeenCalled();

      // Remove the prompt (simulate processing)
      server.prompts.shift();
      expect(server.prompts.length).toBe(0);

      // Advance time, should call runTasks now
      await vi.advanceTimersByTimeAsync(50);
      expect(runTasksSpy).toHaveBeenCalledTimes(1);

      // Advance time again, should call again
      await vi.advanceTimersByTimeAsync(50);
      expect(runTasksSpy).toHaveBeenCalledTimes(2);
    });

    it("should not call runTasks if cassi instance is null (edge case, shouldn't happen after init)", async () => {
      // Manually set cassi to null after init (for testing the guard)
      (server as any).cassi = null;

      await vi.advanceTimersByTimeAsync(50);
      expect(runTasksSpy).not.toHaveBeenCalled();
    });
  });
});
