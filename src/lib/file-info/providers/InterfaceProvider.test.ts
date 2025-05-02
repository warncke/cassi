import { describe, it, expect, vi, beforeEach } from "vitest";
import { InterfaceProvider } from "./InterfaceProvider.js";
import type { FileInfo } from "../FileInfo.js";
import type { InterfaceInfo } from "./InterfaceProvider.js";

vi.mock("../FileInfo.js");

const createMockNode = (
  type: string,
  text: string,
  children: any[] = [],
  namedChildren: any[] = []
) => ({
  type,
  text,
  children,
  namedChildren,
  child: (index: number) => children[index] || null,
});

const mockAst = {
  rootNode: createMockNode(
    "program",
    "",
    [],
    [
      createMockNode("import_statement", "import { a, b } from './modA';", [
        createMockNode("import", "import"),
        createMockNode("import_clause", "{ a, b }", [
          createMockNode("{", "{"),
          createMockNode("named_imports", "a, b", [
            createMockNode("identifier", "a"),
            createMockNode(",", ","),
            createMockNode("identifier", "b"),
          ]),
          createMockNode("}", "}"),
        ]),
        createMockNode("from", "from"),
        createMockNode("string", "'./modA'"),
        createMockNode(";", ";"),
      ]),
      createMockNode("import_statement", "import c from './modB';", [
        createMockNode("import", "import"),
        createMockNode("import_clause", "c", [
          createMockNode("identifier", "c"),
        ]),
        createMockNode("from", "from"),
        createMockNode("string", "'./modB'"),
        createMockNode(";", ";"),
      ]),
      createMockNode(
        "export_statement",
        "export function foo(param: string): void {}",
        [
          createMockNode("export", "export"),
          createMockNode(
            "function_declaration",
            "function foo(param: string): void {}",
            [
              createMockNode("function", "function"),
              createMockNode("identifier", "foo"),
              createMockNode("formal_parameters", "(param: string)"),
              createMockNode("type_annotation", ": void"),
              createMockNode("statement_block", "{}"),
            ]
          ),
        ]
      ),
      createMockNode(
        "export_statement",
        "export class Baz { field: number; method() {} }",
        [
          createMockNode("export", "export"),
          createMockNode(
            "class_declaration",
            "class Baz { field: number; method() {} }",
            [
              createMockNode("class", "class"),
              createMockNode("type_identifier", "Baz"),
              createMockNode("class_body", "{ field: number; method() {} }", [
                createMockNode("{", "{"),
                createMockNode(
                  "public_field_definition",
                  "field: number;",
                  [
                    createMockNode("property_identifier", "field"),
                    createMockNode("type_annotation", ": number"),
                    createMockNode(";", ";"),
                  ]
                ),
                createMockNode("method_definition", "method() {}", [
                  createMockNode("property_identifier", "method"),
                  createMockNode("formal_parameters", "()"),
                  createMockNode("statement_block", "{}"),
                ]),
                createMockNode("}", "}"),
              ]),
            ]
          ),
        ]
      ),
    ]
  ),
};

describe("InterfaceProvider", () => {
  let interfaceProvider: InterfaceProvider;
  let mockFileInfo: FileInfo;

  beforeEach(() => {
    interfaceProvider = new InterfaceProvider();
    mockFileInfo = {
      getInfo: vi.fn(),
    } as unknown as FileInfo;
  });

  it("should extract imports, exports, and classes from a valid AST", async () => {
    const relativePath = "src/service.ts";
    vi.mocked(mockFileInfo.getInfo).mockResolvedValue(mockAst);

    const result = (await interfaceProvider.extractInfo(
      relativePath,
      mockFileInfo
    )) as InterfaceInfo;

    expect(mockFileInfo.getInfo).toHaveBeenCalledWith("ast", relativePath);
    expect(result).toBeDefined();

    expect(result.imports).toHaveLength(2);
    expect(result.imports[0]).toEqual({
      symbols: "{ a, b }",
      from: "./modA",
    });
    expect(result.imports[1]).toEqual({
      symbols: "c",
      from: "./modB",
    });

    expect(result.exports).toHaveLength(2);
    expect(result.exports[0]).toEqual({
      type: "function",
      name: "foo",
      signature: "function foo (param: string) : void",
    });
    expect(result.exports[1]).toEqual({
      type: "class",
      name: "Baz",
      properties: [{ name: "field", type: "number", access: "public" }],
      methods: [{ name: "method", signature: "method ()" }],
    });

  });

  it("should return null if AST provider returns null", async () => {
    const relativePath = "src/no_ast.txt";
    vi.mocked(mockFileInfo.getInfo).mockResolvedValue(null);

    const result = await interfaceProvider.extractInfo(
      relativePath,
      mockFileInfo
    );

    expect(mockFileInfo.getInfo).toHaveBeenCalledWith("ast", relativePath);
    expect(result).toBeNull();
  });

  it("should return empty arrays if AST has no relevant nodes", async () => {
    const relativePath = "src/empty.ts";
    const emptyAst = {
      rootNode: createMockNode("program", "", [], []),
    };
    vi.mocked(mockFileInfo.getInfo).mockResolvedValue(emptyAst);

    const result = await interfaceProvider.extractInfo(
      relativePath,
      mockFileInfo
    );

    expect(mockFileInfo.getInfo).toHaveBeenCalledWith("ast", relativePath);
    expect(result).toEqual({ imports: [], exports: [] });
  });

  it("should return null and log error if AST processing throws", async () => {
    const relativePath = "src/error.ts";
    const error = new Error("AST processing failed");
    vi.mocked(mockFileInfo.getInfo).mockResolvedValue(mockAst);
    const extractSpy = vi
      .spyOn(interfaceProvider as any, "extractFromAst")
      .mockImplementation(() => {
        throw error;
      });
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const result = await interfaceProvider.extractInfo(
      relativePath,
      mockFileInfo
    );

    expect(mockFileInfo.getInfo).toHaveBeenCalledWith("ast", relativePath);
    expect(extractSpy).toHaveBeenCalledWith(mockAst);
    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `Error extracting interface info from AST for ${relativePath}:`,
      error
    );

    extractSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("should handle ASTs with only imports", async () => {
    const relativePath = "src/only-imports.ts";
    const importsOnlyAst = {
      rootNode: createMockNode(
        "program",
        "",
        [],
        [
          createMockNode("import_statement", "import { x } from 'y';", [
            createMockNode("import", "import"),
            createMockNode("import_clause", "{ x }", [
              /*...*/
            ]),
            createMockNode("from", "from"),
            createMockNode("string", "'y'"),
            createMockNode(";", ";"),
          ]),
        ]
      ),
    };
    vi.mocked(mockFileInfo.getInfo).mockResolvedValue(importsOnlyAst);

    const result = await interfaceProvider.extractInfo(
      relativePath,
      mockFileInfo
    );

    expect(result).toEqual({
      imports: [{ symbols: "{ x }", from: "y" }],
      exports: [],
    });
  });

  it("should handle ASTs with only exports", async () => {
    const relativePath = "src/only-exports.ts";
    const exportsOnlyAst = {
      rootNode: createMockNode(
        "program",
        "",
        [],
        [
          createMockNode("export_statement", "export function z() {}", [
            createMockNode("export", "export"),
            createMockNode("function_declaration", "function z() {}", [
              createMockNode("function", "function"),
              createMockNode("identifier", "z"),
              createMockNode("formal_parameters", "()"),
              createMockNode("statement_block", "{}"),
            ]),
          ]),
        ]
      ),
    };
    vi.mocked(mockFileInfo.getInfo).mockResolvedValue(exportsOnlyAst);

    const result = await interfaceProvider.extractInfo(
      relativePath,
      mockFileInfo
    );

    expect(result).toEqual({
      imports: [],
      exports: [{ type: "function", name: "z", signature: "function z ()" }],
    });
  });

  it("should handle export of type aliases", async () => {
    const relativePath = "src/type-export.ts";
    const typeExportAst = {
      rootNode: createMockNode(
        "program",
        "",
        [],
        [
          createMockNode(
            "export_statement",
            "export type MyType = string | number;",
            [
              createMockNode("export", "export"),
              createMockNode(
                "type_alias_declaration",
                "type MyType = string | number;",
                [
                  createMockNode("type", "type"),
                  createMockNode("type_identifier", "MyType"),
                  createMockNode("=", "="),
                  createMockNode("union_type", "string | number", [
                    createMockNode("predefined_type", "string"),
                    createMockNode("|", "|"),
                    createMockNode("predefined_type", "number"),
                  ]),
                  createMockNode(";", ";"),
                ]
              ),
            ]
          ),
        ]
      ),
    };
    vi.mocked(mockFileInfo.getInfo).mockResolvedValue(typeExportAst);

    const result = await interfaceProvider.extractInfo(
      relativePath,
      mockFileInfo
    );

    expect(result).toEqual({
      imports: [],
      exports: [
        {
          type: "type",
          name: "MyType",
        },
      ],
    });
  });

  it("should handle export of variables (const/let)", async () => {
    const relativePath = "src/variable-export.ts";
    const variableExportAst = {
      rootNode: createMockNode(
        "program",
        "",
        [],
        [
          createMockNode("export_statement", "export const myVar = 42;", [
            createMockNode("export", "export"),
            createMockNode("lexical_declaration", "const myVar = 42;", [
              createMockNode("const", "const"),
              createMockNode("variable_declarator", "myVar = 42", [
                createMockNode("identifier", "myVar"),
                createMockNode("=", "="),
                createMockNode("number", "42"),
              ]),
              createMockNode(";", ";"),
            ]),
          ]),
        ]
      ),
    };
    vi.mocked(mockFileInfo.getInfo).mockResolvedValue(variableExportAst);

    const result = await interfaceProvider.extractInfo(
      relativePath,
      mockFileInfo
    );

    expect(result).toEqual({
      imports: [],
      exports: [
        {
          type: "variable",
          name: "myVar",
        },
      ],
    });
  });

  it("should handle export of const/let assigned to a function", async () => {
    const relativePath = "src/function-variable-export.ts";
    const funcVarExportAst = {
      rootNode: createMockNode(
        "program",
        "",
        [],
        [
          createMockNode(
            "export_statement",
            "export const myFunc = (a: number): number => { return a + 1; };",
            [
              createMockNode("export", "export"),
              createMockNode(
                "lexical_declaration",
                "const myFunc = (a: number): number => { return a + 1; };",
                [
                  createMockNode("const", "const"),
                  createMockNode(
                    "variable_declarator",
                    "myFunc = (a: number): number => { return a + 1; }",
                    [
                      createMockNode("identifier", "myFunc"),
                      createMockNode("=", "="),
                      createMockNode(
                        "arrow_function",
                        "(a: number): number => { return a + 1; }",
                        [
                          createMockNode("formal_parameters", "(a: number)"),
                          createMockNode("type_annotation", ": number"),
                          createMockNode("=>", "=>"),
                          createMockNode(
                            "statement_block",
                            "{ return a + 1; }"
                          ),
                        ]
                      ),
                    ]
                  ),
                  createMockNode(";", ";"),
                ]
              ),
            ]
          ),
        ]
      ),
    };
    vi.mocked(mockFileInfo.getInfo).mockResolvedValue(funcVarExportAst);

    const result = await interfaceProvider.extractInfo(
      relativePath,
      mockFileInfo
    );

    expect(result).toEqual({
      imports: [],
      exports: [
        {
          type: "function",
          name: "myFunc",
          signature: "(a: number) : number =>",
        },
      ],
    });
  });

  it("should handle different property access modifiers", async () => {
    const relativePath = "src/access-modifiers.ts";
    const accessModifiersAst = {
      rootNode: createMockNode(
        "program",
        "",
        [],
        [
          createMockNode(
            "export_statement",
            "export class MyClass { public pubField: string; private privField: number; protected protField: boolean; }",
            [
              createMockNode("export", "export"),
              createMockNode(
                "class_declaration",
                "class MyClass { public pubField: string; private privField: number; protected protField: boolean; }",
                [
                  createMockNode("class", "class"),
                  createMockNode("type_identifier", "MyClass"),
                  createMockNode(
                    "class_body",
                    "{ public pubField: string; private privField: number; protected protField: boolean; }",
                    [
                      createMockNode("{", "{"),
                      createMockNode(
                        "public_field_definition",
                        "public pubField: string;",
                        [
                          createMockNode("public", "public"),
                          createMockNode("property_identifier", "pubField"),
                          createMockNode("type_annotation", ": string"),
                          createMockNode(";", ";"),
                        ]
                      ),
                      createMockNode(
                        "field_definition",
                        "private privField: number;",
                        [
                          createMockNode("property_identifier", "privField"),
                          createMockNode("type_annotation", ": number"),
                          createMockNode(";", ";"),
                        ]
                      ),
                      createMockNode(
                        "field_definition",
                        "protected protField: boolean;",
                        [
                          createMockNode("property_identifier", "protField"),
                          createMockNode("type_annotation", ": boolean"),
                          createMockNode(";", ";"),
                        ]
                      ),
                      createMockNode("}", "}"),
                    ]
                  ),
                ]
              ),
            ]
          ),
        ]
      ),
    };
    vi.mocked(mockFileInfo.getInfo).mockResolvedValue(accessModifiersAst);

    const result = await interfaceProvider.extractInfo(
      relativePath,
      mockFileInfo
    );

    expect(result?.exports).toHaveLength(1);
    const classExport = result?.exports[0];
    expect(classExport?.type).toBe("class");
    expect(classExport?.name).toBe("MyClass");
    expect(classExport?.properties).toEqual([
      { name: "pubField", type: "string", access: "public" },
      { name: "privField", type: "number", access: "private" },
      { name: "protField", type: "boolean", access: "protected" },
    ]);
  });

});
