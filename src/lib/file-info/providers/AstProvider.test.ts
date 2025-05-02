import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import Parser from "tree-sitter";
import { AstProvider } from "./AstProvider.js";
import type { FileInfo } from "../FileInfo.js";

vi.mock("../FileInfo.js");
vi.mock("tree-sitter");

vi.mock("tree-sitter-typescript/typescript", () => ({
  default: { languageName: "typescript" },
}));

describe("AstProvider", () => {
  let astProvider: AstProvider;
  let mockFileInfo: FileInfo;
  let mockParserInstance: Parser;
  let mockParseFn: Mock;
  let mockSetLanguageFn: Mock;
  let getParserSpy: any;

  beforeEach(() => {
    astProvider = new AstProvider();

    mockFileInfo = {
      getFileContent: vi.fn(),
    } as unknown as FileInfo;

    mockParseFn = vi.fn();
    mockSetLanguageFn = vi.fn();
    mockParserInstance = {
      parse: mockParseFn,
      setLanguage: mockSetLanguageFn,
    } as unknown as Parser;

    vi.clearAllMocks();

    getParserSpy = vi
      .spyOn(astProvider as any, "getParser")
      .mockReturnValue(mockParserInstance);
  });

  it("should return AST for supported language (.ts)", async () => {
    const relativePath = "src/component.ts";
    const fileContent = "const x = 1;";
    const mockAst = { rootNode: { type: "program" } };
    vi.mocked(mockFileInfo.getFileContent).mockResolvedValue(fileContent);
    mockParseFn.mockReturnValue(mockAst);

    const result = await astProvider.extractInfo(relativePath, mockFileInfo);

    expect(mockFileInfo.getFileContent).toHaveBeenCalledWith(relativePath);
    expect(mockSetLanguageFn).toHaveBeenCalled();
    expect(mockParseFn).toHaveBeenCalledWith(fileContent);
    expect(result).toEqual(mockAst);
  });

  it("should return AST for supported language (.tsx)", async () => {
    const relativePath = "src/component.tsx";
    const fileContent = "const x = 1;";
    const mockAst = { rootNode: { type: "program" } };
    vi.mocked(mockFileInfo.getFileContent).mockResolvedValue(fileContent);
    mockParseFn.mockReturnValue(mockAst);

    const result = await astProvider.extractInfo(relativePath, mockFileInfo);

    expect(mockFileInfo.getFileContent).toHaveBeenCalledWith(relativePath);
    expect(mockSetLanguageFn).toHaveBeenCalled();
    expect(mockParseFn).toHaveBeenCalledWith(fileContent);
    expect(result).toEqual(mockAst);
  });

  it("should return null for unsupported language", async () => {
    const relativePath = "src/styles.css";
    const fileContent = "body { color: red; }";
    vi.mocked(mockFileInfo.getFileContent).mockResolvedValue(fileContent);

    const result = await astProvider.extractInfo(relativePath, mockFileInfo);

    expect(mockFileInfo.getFileContent).toHaveBeenCalledWith(relativePath);
    expect(mockSetLanguageFn).not.toHaveBeenCalled();
    expect(mockParseFn).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("should return null if file content is null", async () => {
    const relativePath = "src/notfound.ts";
    vi.mocked(mockFileInfo.getFileContent).mockResolvedValue(null);

    const result = await astProvider.extractInfo(relativePath, mockFileInfo);

    expect(mockFileInfo.getFileContent).toHaveBeenCalledWith(relativePath);
    expect(mockSetLanguageFn).not.toHaveBeenCalled();
    expect(mockParseFn).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("should return null and log error if parser throws", async () => {
    const relativePath = "src/broken.ts";
    const fileContent = "const x =;";
    const error = new Error("Parsing failed");
    vi.mocked(mockFileInfo.getFileContent).mockResolvedValue(fileContent);
    mockParseFn.mockImplementation(() => {
      throw error;
    });

    const result = await astProvider.extractInfo(relativePath, mockFileInfo);

    expect(mockFileInfo.getFileContent).toHaveBeenCalledWith(relativePath);
    expect(mockSetLanguageFn).toHaveBeenCalled();
    expect(mockParseFn).toHaveBeenCalledWith(fileContent);
    expect(result).toBeNull();
  });
});
