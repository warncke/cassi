import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Server } from "./Server.js";
import express from "express";
import { Cassi } from "../cassi/Cassi.js";
import { User } from "../user/User.js";
import { Prompt } from "../prompt/Prompt.js";
import Input from "../prompt/prompts/Input.js";

vi.mock("express", () => {
  const mockApp = {
    use: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    listen: vi.fn(),
  };
  return {
    default: vi.fn(() => mockApp),
  };
});

describe("Server", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should initialize with default host and port", () => {
    const server = new Server();
    expect(server.getHost()).toBe("localhost");
    expect(server.getPort()).toBe(7777);
  });

  it("should initialize with provided host and port", () => {
    const server = new Server("127.0.0.1", 8080);
    expect(server.getHost()).toBe("127.0.0.1");
    expect(server.getPort()).toBe(8080);
  });

  it("should initialize the express app on init", async () => {
    const server = new Server();
    const mockUser = new User(
      async () => {},
      async () => {}
    );
    const mockCassi = new Cassi(mockUser, "mockConfig", "mockRepo");
    expect(server.getApp()).toBeNull();
    await server.init(mockCassi);
    expect(server.getApp()).not.toBeNull();
    expect(express).toHaveBeenCalledTimes(1);
  });

  it("should return the express app instance", async () => {
    const server = new Server();
    const mockUser = new User(
      async () => {},
      async () => {}
    );
    const mockCassi = new Cassi(mockUser, "mockConfig", "mockRepo");
    await server.init(mockCassi);
    const app = server.getApp();
    expect(app).toBeDefined();
  });

  it("should return the host", () => {
    const server = new Server("testhost");
    expect(server.getHost()).toBe("testhost");
  });

  it("should return the port", () => {
    const server = new Server("localhost", 9999);
    expect(server.getPort()).toBe(9999);
  });

  it("should call console.log when addPrompt is called", () => {
    const server = new Server();
    const inputPrompt = new Input("Test prompt");
    server.addPrompt(inputPrompt);
    expect(consoleLogSpy).toHaveBeenCalledWith("Received prompt:", inputPrompt);
  });
});
