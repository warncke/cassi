export interface CacheMetadata {
  sourceFilePath: string;
  mtime: number;
  size: number;
  hash: string;
}

export interface CacheEntry {
  metadata: CacheMetadata;
  data: any;
}
