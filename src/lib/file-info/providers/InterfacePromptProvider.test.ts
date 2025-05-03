import { describe, it, expect, vi } from "vitest";
import { InterfacePromptProvider } from "./InterfacePromptProvider.js";
import type { FileInfo } from "../FileInfo.js";
import type { InterfaceInfo } from "./InterfaceProvider.js";

describe("InterfacePromptProvider", () => {
  it("should format interface info into a string prompt", async () => {
    const mockFileInfo = {
      getInfo: vi.fn(),
    } as unknown as FileInfo;

    const mockInterfaceData: InterfaceInfo = {
      imports: [
        { symbols: "{ Component }", from: "react" },
        { symbols: "useState", from: "react" },
      ],
      exports: {
        variable: [{ name: "API_URL", type: "string" }],
        type: [{ name: "Props" }],
        class: [
          {
            name: "MyComponent",
            properties: [
              { name: "count", type: "number", access: "private" },
              { name: "label", type: "string", access: "public" },
            ],
            methods: [
              { name: "increment", signature: "increment(): void" },
              { name: "render", signature: "render(): JSX.Element" },
            ],
          },
        ],
        function: [
          {
            name: "helperFunction",
            signature: "helperFunction(arg: any): boolean",
          },
        ],
      },
    };

    vi.mocked(mockFileInfo.getInfo).mockResolvedValue(mockInterfaceData);

    const provider = new InterfacePromptProvider();
    const result = await provider.extractInfo("dummy/path.ts", mockFileInfo);

    // Added File Name prefix, imports are non-relative so they don't change
    const expectedOutput = `File Name: dummy/path.ts

Imports:
- { Component } from 'react'
- useState from 'react'

Exports:
--Variables:
-- - API_URL: string

--Types:
-- - Props

--Classes:
-- - MyComponent
----Properties:
---- - private count: number
---- - public label: string
----Methods:
---- - increment(): void
---- - render(): JSX.Element

--Functions:
-- - helperFunction(arg: any): boolean`;

    expect(mockFileInfo.getInfo).toHaveBeenCalledWith(
      "interface",
      "dummy/path.ts"
    );
    expect(result).toBe(expectedOutput);
  });

  it("should return an empty string for empty interface info", async () => {
    const mockFileInfo = {
      getInfo: vi.fn(),
    } as unknown as FileInfo;

    const mockInterfaceData: InterfaceInfo = {
      imports: [],
      exports: {
        variable: [],
        type: [],
        class: [],
        function: [],
      },
    };

    vi.mocked(mockFileInfo.getInfo).mockResolvedValue(mockInterfaceData);

    const provider = new InterfacePromptProvider();
    const result = await provider.extractInfo("empty/path.ts", mockFileInfo);

    // Expect file name prefix even for empty data
    expect(result).toBe("File Name: empty/path.ts");
  });

  it("should handle missing parts gracefully", async () => {
    const mockFileInfo = {
      getInfo: vi.fn(),
    } as unknown as FileInfo;

    const mockInterfaceData: InterfaceInfo = {
      imports: [{ symbols: "{ Thing }", from: "./thing" }],
      exports: {
        variable: [],
        type: [],
        class: [
          {
            name: "OnlyClass",
            properties: [],
            methods: [{ name: "doWork", signature: "doWork()" }],
          },
        ],
        function: [],
      },
    };

    vi.mocked(mockFileInfo.getInfo).mockResolvedValue(mockInterfaceData);

    const provider = new InterfacePromptProvider();
    const result = await provider.extractInfo("partial/path.ts", mockFileInfo);

    // Added File Name prefix, resolved relative import path
    const expectedOutput = `File Name: partial/path.ts

Imports:
- { Thing } from 'partial/thing'

Exports:
--Classes:
-- - OnlyClass
----Methods:
---- - doWork()`;

    expect(result).toBe(expectedOutput);
  });

  it("should return null if interface info cannot be retrieved", async () => {
    const mockFileInfo = {
      getInfo: vi.fn().mockResolvedValue(null),
    } as unknown as FileInfo;

    const provider = new InterfacePromptProvider();
    const result = await provider.extractInfo("error/path.ts", mockFileInfo);

    expect(result).toBeNull();
  });
});
