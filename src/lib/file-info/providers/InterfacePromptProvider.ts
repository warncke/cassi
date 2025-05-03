import * as path from "node:path";
import type { FileInfoProvider } from "./FileInfoProvider.js";
import type { FileInfo } from "../FileInfo.js";
import type {
  InterfaceInfo,
  ImportInfo,
  VariableInfo,
  TypeAliasInfo,
  ClassInfo,
  FunctionInfo,
  PropertyInfo,
} from "./InterfaceProvider.js";

export class InterfacePromptProvider implements FileInfoProvider {
  private formatImports(imports: ImportInfo[], relativePath: string): string {
    if (!imports.length) return "";

    const fileDir = path.dirname(relativePath);

    const formattedImports = imports.map((imp) => {
      let resolvedFrom = imp.from;
      // Only resolve paths starting with '.'
      if (resolvedFrom.startsWith(".")) {
        // Normalize joins the paths and resolves '..' etc.
        resolvedFrom = path.normalize(path.join(fileDir, resolvedFrom));
      }
      return `- ${imp.symbols} from '${resolvedFrom}'`;
    });

    return `Imports:\n${formattedImports.join("\n")}`;
  }

  private formatVariables(variables: VariableInfo[]): string {
    if (!variables.length) return "";
    // Use '--' indentation
    return `--Variables:\n${variables
      .map((v) => `-- - ${v.name}: ${v.type}`)
      .join("\n")}`;
  }

  private formatTypes(types: TypeAliasInfo[]): string {
    if (!types.length) return "";
    // Use '--' indentation
    return `--Types:\n${types.map((t) => `-- - ${t.name}`).join("\n")}`;
  }

  private formatProperties(properties: PropertyInfo[]): string {
    if (!properties.length) return "";
    // Use '----' indentation
    return `----Properties:\n${properties
      .map((p) => `---- - ${p.access} ${p.name}: ${p.type}`)
      .join("\n")}`;
  }

  private formatMethods(methods: FunctionInfo[]): string {
    if (!methods.length) return "";
    // Use '----' indentation
    return `----Methods:\n${methods
      .map((m) => `---- - ${m.signature}`)
      .join("\n")}`;
  }

  private formatClasses(classes: ClassInfo[]): string {
    if (!classes.length) return "";
    // Use '--' indentation for header and class name, '----' for props/methods
    return `--Classes:\n${classes
      .map((c) => {
        const props = this.formatProperties(c.properties); // Uses '----'
        const methods = this.formatMethods(c.methods); // Uses '----'
        let classString = `-- - ${c.name}`; // Use '-- -' for class name
        if (props) classString += `\n${props}`;
        if (methods) classString += `\n${methods}`;
        return classString;
      })
      .join("\n")}`;
  }

  private formatFunctions(functions: FunctionInfo[]): string {
    if (!functions.length) return "";
    // Use '--' indentation
    return `--Functions:\n${functions
      .map((f) => `-- - ${f.signature}`)
      .join("\n")}`;
  }

  private formatInterfaceInfo(
    info: InterfaceInfo,
    relativePath: string
  ): string {
    const parts: string[] = [`File Name: ${relativePath}`]; // Add file name here

    const importsStr = this.formatImports(info.imports, relativePath); // Pass relativePath
    if (importsStr) parts.push(importsStr);

    const exports = info.exports;
    const exportParts: string[] = [];

    const variablesStr = this.formatVariables(exports.variable);
    if (variablesStr) exportParts.push(variablesStr);

    const typesStr = this.formatTypes(exports.type);
    if (typesStr) exportParts.push(typesStr);

    const classesStr = this.formatClasses(exports.class);
    if (classesStr) exportParts.push(classesStr);

    const functionsStr = this.formatFunctions(exports.function);
    if (functionsStr) exportParts.push(functionsStr);

    if (exportParts.length > 0) {
      // Join the already dash-indented parts
      const joinedExports = exportParts.join("\n\n");
      parts.push(`Exports:\n${joinedExports}`);
    }

    return parts.join("\n\n");
  }

  async extractInfo(
    relativePath: string,
    fileInfo: FileInfo
  ): Promise<string | null> {
    const interfaceData = await fileInfo.getInfo<InterfaceInfo>(
      "interface",
      relativePath
    );

    if (!interfaceData) {
      return null;
    }

    try {
      // Pass relativePath to formatInterfaceInfo
      const formattedString = this.formatInterfaceInfo(
        interfaceData,
        relativePath
      );
      return formattedString;
    } catch (error) {
      console.error(
        `Error formatting interface info for ${relativePath}:`,
        error
      );
      return null;
    }
  }
}
