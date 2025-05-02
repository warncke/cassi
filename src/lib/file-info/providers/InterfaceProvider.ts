import type { SyntaxNode, Tree } from "tree-sitter";
import type { FileInfoProvider } from "./FileInfoProvider.js";
import type { FileInfo } from "../FileInfo.js";

export interface ImportInfo {
  symbols: string;
  from: string;
}

export interface TypeAliasInfo {
  name: string;
}

export interface VariableInfo {
  name: string;
  type: string;
}

export interface FunctionInfo {
  name?: string;
  signature: string;
}

export interface PropertyInfo {
  name: string;
  type: string;
  access: "public" | "private" | "protected";
}

export interface ClassInfo {
  name: string;
  properties: PropertyInfo[];
  methods: FunctionInfo[];
}

export interface InterfaceInfo {
  imports: ImportInfo[];
  exports: {
    variable: VariableInfo[];
    type: TypeAliasInfo[];
    class: ClassInfo[];
    function: FunctionInfo[];
  };
}

export class InterfaceProvider implements FileInfoProvider {
  private processImportStatement(node: SyntaxNode): ImportInfo | null {
    const symbolsNode = node.children.find(
      (child) => child.type === "import_clause"
    );
    const fromNode = node.children.find((child) => child.type === "string");

    if (!symbolsNode || !fromNode) {
      return null;
    }

    const symbols = symbolsNode.text;
    const from = fromNode.text.replace(/^['"]|['"]$/g, "");

    return {
      symbols,
      from,
    };
  }

  private processFunctionDeclaration(node: SyntaxNode): FunctionInfo | null {
    const identifier = node.children.find(
      (child) => child.type === "identifier"
    );
    const signature = node.children
      .filter((child) => child.type !== "statement_block")
      .map((child) => child.text)
      .join(" ");

    const name = identifier?.text;

    return {
      name: name,
      signature,
    };
  }

  private processTypeAliasDeclaration(node: SyntaxNode): TypeAliasInfo | null {
    const typeIdentifier = node.children.find(
      (child) => child.type === "type_identifier"
    );
    const typeDefinitionNode = node.children.find(
      (child) =>
        child.type !== "type" &&
        child.type !== "=" &&
        child.type !== "type_identifier" &&
        child.type !== ";"
    );

    if (!typeIdentifier || !typeDefinitionNode) {
      return null;
    }

    return {
      name: typeIdentifier.text,
    };
  }

  private processLexicalDeclaration(
    node: SyntaxNode
  ): (VariableInfo | FunctionInfo) | null {
    const variableDeclarator = node.children.find(
      (child) => child.type === "variable_declarator"
    );
    const identifier = variableDeclarator?.children.find(
      (child) => child.type === "identifier"
    );
    const valueNode = variableDeclarator?.children.find(
      (child) => child !== identifier && child.type !== "="
    );

    if (!identifier || !valueNode) {
      return null;
    }

    const name = identifier.text;

    if (
      valueNode.type === "arrow_function" ||
      valueNode.type === "function_expression" ||
      valueNode.type === "function"
    ) {
      const signature = valueNode.children
        .filter((child) => child.type !== "statement_block")
        .map((child) => child.text)
        .join(" ");
      return {
        name: name,
        signature: signature || valueNode.text,
      };
    } else {
      const typeAnnotationNode = variableDeclarator?.children.find(
        (child) => child.type === "type_annotation"
      );
      const type = typeAnnotationNode
        ? typeAnnotationNode.text.substring(1).trim()
        : "any";
      return {
        name: name,
        type: type,
      };
    }
  }

  private processClassDeclaration(node: SyntaxNode): ClassInfo | null {
    const typeIdentifier = node.children.find(
      (child) => child.type === "type_identifier"
    );
    const classBodyNode = node.children.find(
      (child) => child.type === "class_body"
    );

    if (!typeIdentifier || !classBodyNode) {
      return null;
    }

    const name = typeIdentifier.text;

    const properties = classBodyNode.children
      .filter((child) => child.type.endsWith("field_definition"))
      .map((fieldNode): PropertyInfo | null => {
        let access: PropertyInfo["access"] = "public";

        if (fieldNode.text.startsWith("private")) {
          access = "private";
        } else if (fieldNode.text.startsWith("protected")) {
          access = "protected";
        }

        const nameNode = fieldNode.children.find(
          (child) => child.type === "property_identifier"
        );
        const typeNode = fieldNode.children.find(
          (child) => child.type === "type_annotation"
        );

        const propName = nameNode?.text;
        const propType = typeNode?.text.startsWith(":")
          ? typeNode.text.substring(1).trim()
          : typeNode?.text || "any";

        if (propName) {
          return { name: propName, type: propType, access };
        }
        return null;
      })
      .filter((prop): prop is PropertyInfo => prop !== null);

    const methods = classBodyNode.children
      .filter((child) => child.type === "method_definition")
      .map((methodNode): FunctionInfo | null => {
        const nameNode = methodNode.children.find(
          (child) => child.type === "property_identifier"
        );
        const name = nameNode?.text;
        const signature = methodNode.children
          .filter((child) => child.type !== "statement_block")
          .map((child) => child.text)
          .join(" ");
        if (name) {
          return { name, signature };
        }
        return null;
      })
      .filter((method): method is FunctionInfo => method !== null);

    return {
      name,
      properties,
      methods,
    };
  }

  private processExportStatement(
    node: SyntaxNode
  ):
    | { type: "function"; info: FunctionInfo }
    | { type: "class"; info: ClassInfo }
    | { type: "type"; info: TypeAliasInfo }
    | { type: "variable"; info: VariableInfo }
    | null {
    const exportNode = node.child(1);

    if (!exportNode) {
      return null;
    }

    switch (exportNode.type) {
      case "function_declaration": {
        const functionInfo = this.processFunctionDeclaration(exportNode);
        if (!functionInfo) return null;
        return { type: "function", info: functionInfo };
      }
      case "class_declaration": {
        const classInfo = this.processClassDeclaration(exportNode);
        if (!classInfo) return null;
        return { type: "class", info: classInfo };
      }
      case "type_alias_declaration": {
        const typeAliasInfo = this.processTypeAliasDeclaration(exportNode);
        if (!typeAliasInfo) return null;
        return { type: "type", info: typeAliasInfo };
      }
      case "lexical_declaration": {
        const lexicalInfo = this.processLexicalDeclaration(exportNode);
        if (!lexicalInfo) return null;

        if ("signature" in lexicalInfo && lexicalInfo.signature !== undefined) {
          return { type: "function", info: lexicalInfo };
        } else if (!("signature" in lexicalInfo)) {
          // Explicitly check it's VariableInfo
          return { type: "variable", info: lexicalInfo };
        } else {
          // Should not happen if processLexicalDeclaration is correct, but handles the type union
          console.warn("Unexpected lexical info structure:", lexicalInfo);
          return null;
        }
      }
      default:
        console.warn(`Unknown export type: ${exportNode.type}`);
        return null;
    }
  }

  private extractFromAst(tree: Tree): InterfaceInfo {
    const rootNode = tree.rootNode;
    const info: InterfaceInfo = {
      imports: [],
      exports: { variable: [], type: [], class: [], function: [] },
    };

    if (!rootNode) {
      return info;
    }

    for (const child of rootNode.namedChildren) {
      switch (child.type) {
        case "import_statement":
          const importStatement = this.processImportStatement(child);
          if (importStatement) {
            info.imports.push(importStatement);
          }
          break;
        case "export_statement": {
          const exportResult = this.processExportStatement(child);
          if (exportResult) {
            switch (exportResult.type) {
              case "variable":
                info.exports.variable.push(exportResult.info);
                break;
              case "type":
                info.exports.type.push(exportResult.info);
                break;
              case "class":
                info.exports.class.push(exportResult.info);
                break;
              case "function":
                info.exports.function.push(exportResult.info);
                break;
            }
          }
          break;
        }
      }
    }

    return info;
  }

  async extractInfo(
    relativePath: string,
    fileInfo: FileInfo
  ): Promise<InterfaceInfo | null> {
    const ast = await fileInfo.getInfo<Tree>("ast", relativePath);

    if (!ast) {
      return null;
    }

    try {
      const interfaceData = this.extractFromAst(ast);
      return interfaceData;
    } catch (error) {
      console.error(
        `Error extracting interface info from AST for ${relativePath}:`,
        error
      );
      return null;
    }
  }
}
