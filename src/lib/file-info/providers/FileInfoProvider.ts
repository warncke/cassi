import type { FileInfo } from "../FileInfo.js";

export interface FileInfoProvider {
  extractInfo(relativePath: string, fileInfo: FileInfo): Promise<any>;
}
