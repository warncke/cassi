import * as path from "node:path";
import Parser from "tree-sitter";
import typescript from "tree-sitter-typescript";

import type { FileInfoProvider } from "./FileInfoProvider.js";
import type { FileInfo } from "../FileInfo.js";

let parser: Parser | null = null;

export class AstProvider implements FileInfoProvider {
  private getParser(): Parser {
    if (!parser) {
      parser = new Parser();
    }
    return parser;
  }

  private getLanguage(filePath: string): any | null {
    const extension = path.extname(filePath);
    switch (extension) {
      case ".ts":
      case ".tsx":
        return typescript.typescript;
      default:
        console.warn(
          `Unsupported language extension for AST parsing: ${extension}`
        );
        return null;
    }
  }

  async extractInfo(
    relativePath: string,
    fileInfo: FileInfo
  ): Promise<any | null> {
    const fileContent = await fileInfo.getFileContent(relativePath);
    if (fileContent === null) {
      return null;
    }

    const language = this.getLanguage(relativePath);
    if (!language) {
      return null;
    }

    const parserInstance = this.getParser();
    try {
      parserInstance.setLanguage(language);
      const tree = parserInstance.parse(fileContent);
      return tree;
    } catch (error) {
      console.error(`Error parsing AST for ${relativePath}:`, error);
      return null;
    }
  }
}
