import { cacheLife } from "next/cache";
import ts from "typescript";
import { readComponentSource } from "@/lib/get-llm-text";

/** One prop, or one field of a type the props use. */
export interface ApiField {
  name: string;
  type: string;
  required: boolean;
  /** As written in the component's signature; "demo" for demo data. */
  defaultValue?: string;
  description?: string;
}

/** A type the props refer to, declared in the same file. */
export interface ApiType {
  name: string;
  /** Set for object shapes, which read best as a table. */
  fields?: ApiField[];
  /** Set for everything else (unions, functions), shown as code. */
  code?: string;
  description?: string;
}

export interface ComponentApi {
  /** The component's export name, e.g. `AIToolCalls`. */
  component: string;
  props: ApiField[];
  /** What the props also accept, e.g. `ButtonHTMLAttributes<...>`. */
  extendsFrom: string[];
  types: ApiType[];
}

type Declaration = ts.InterfaceDeclaration | ts.TypeAliasDeclaration;

const DEMO_DEFAULT = /^(DEMO_|demo[A-Z])/;
const TYPE_NAME = /\b[A-Z][A-Za-z0-9]*\b/g;
const MAX_TYPES = 8;
const MAX_DEFAULT_LENGTH = 48;
const WHITESPACE = /\s+/g;

const CONSTANT = /^[A-Z][A-Z0-9_]+$/;

const squash = (text: string) =>
  text
    .replace(WHITESPACE, " ")
    .replaceAll("( ", "(")
    .replaceAll(" )", ")")
    .replaceAll("; }", " }")
    .trim();

function jsDocOf(node: ts.Node) {
  const docs = (node as { jsDoc?: ts.JSDoc[] }).jsDoc;
  const comment = docs?.at(-1)?.comment;
  if (!comment) {
    return;
  }
  const text =
    typeof comment === "string" ? comment : ts.getTextOfJSDocComment(comment);
  return text ? squash(text) : undefined;
}

const isDefault = (statement: ts.FunctionDeclaration) =>
  statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);

/** The name in `export default Name;`, when the file ends that way. */
function exportedName(file: ts.SourceFile) {
  for (const statement of file.statements) {
    if (
      ts.isExportAssignment(statement) &&
      ts.isIdentifier(statement.expression)
    ) {
      return statement.expression.text;
    }
  }
}

/** `const Name = memo(forwardRef((props) => …))` → the inner function. */
function functionOf(init: ts.Expression | undefined) {
  let node = init;
  while (node && ts.isCallExpression(node) && node.arguments[0]) {
    node = node.arguments[0];
  }
  if (node && (ts.isArrowFunction(node) || ts.isFunctionExpression(node))) {
    return node;
  }
}

function findFunction(file: ts.SourceFile, name: string) {
  for (const statement of file.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) {
      return statement;
    }
    if (ts.isVariableStatement(statement)) {
      const declaration = statement.declarationList.declarations.find(
        (d) => ts.isIdentifier(d.name) && d.name.text === name
      );
      const fn = functionOf(declaration?.initializer);
      if (fn) {
        return fn;
      }
    }
  }
}

/** The function the file exports by default, through `memo`/`forwardRef`. */
function defaultExport(file: ts.SourceFile) {
  for (const statement of file.statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      isDefault(statement) &&
      statement.name
    ) {
      return { name: statement.name.text, fn: statement };
    }
  }
  const name = exportedName(file);
  const fn = name ? findFunction(file, name) : undefined;
  return name && fn ? { name, fn } : undefined;
}

function typeOf(member: ts.TypeElement, file: ts.SourceFile) {
  if (ts.isPropertySignature(member) && member.type) {
    return squash(member.type.getText(file));
  }
  if (ts.isMethodSignature(member)) {
    const params = member.parameters.map((p) => p.getText(file)).join(", ");
    return squash(`(${params}) => ${member.type?.getText(file) ?? "void"}`);
  }
  return "unknown";
}

function describe(member: ts.TypeElement, name: string) {
  const doc = jsDocOf(member);
  if (doc || name !== "className") {
    return doc;
  }
  return "Extra classes for the root element.";
}

function fieldsOf(
  members: ts.NodeArray<ts.TypeElement>,
  file: ts.SourceFile,
  defaults: Map<string, string>
): ApiField[] {
  return members.flatMap((member) => {
    const named =
      (ts.isPropertySignature(member) || ts.isMethodSignature(member)) &&
      ts.isIdentifier(member.name);
    if (!named) {
      return [];
    }
    const name = (member.name as ts.Identifier).text;
    return [
      {
        name,
        type: typeOf(member, file),
        required: !member.questionToken,
        defaultValue: defaults.get(name),
        description: describe(member, name),
      },
    ];
  });
}

/** How a default reads in the table: "demo" for demo data. */
function shownDefault(text: string) {
  if (DEMO_DEFAULT.test(text)) {
    return "demo";
  }
  if (CONSTANT.test(text)) {
    return "built-in";
  }
  return text.length > MAX_DEFAULT_LENGTH
    ? `${text.slice(0, MAX_DEFAULT_LENGTH - 1)}…`
    : text;
}

/** `{ calls = DEMO_CALLS, open = true }` → calls: "demo", open: "true". */
function defaultsOf(parameter: ts.ParameterDeclaration, file: ts.SourceFile) {
  const defaults = new Map<string, string>();
  if (!ts.isObjectBindingPattern(parameter.name)) {
    return defaults;
  }
  for (const element of parameter.name.elements) {
    const key = element.propertyName ?? element.name;
    if (element.initializer && ts.isIdentifier(key)) {
      defaults.set(
        key.text,
        shownDefault(squash(element.initializer.getText(file)))
      );
    }
  }
  return defaults;
}

/** Fields of an object type, an interface's members, or nothing. */
function membersOf(declaration: Declaration) {
  if (ts.isInterfaceDeclaration(declaration)) {
    return declaration.members;
  }
  if (ts.isTypeLiteralNode(declaration.type)) {
    return declaration.type.members;
  }
}

interface Parsed {
  file: ts.SourceFile;
  declarations: Map<string, Declaration>;
}

/** Walks the props type: literals, references and intersections. */
function collectProps(
  root: ts.TypeNode | undefined,
  { file, declarations }: Parsed,
  defaults: Map<string, string>
) {
  const props: ApiField[] = [];
  const extendsFrom: string[] = [];
  const pending: ts.TypeNode[] = root ? [root] : [];
  while (pending.length > 0) {
    const node = pending.shift() as ts.TypeNode;
    const declaration = ts.isTypeReferenceNode(node)
      ? declarations.get(node.typeName.getText(file))
      : undefined;
    if (ts.isIntersectionTypeNode(node)) {
      pending.push(...node.types);
    } else if (ts.isTypeLiteralNode(node)) {
      props.push(...fieldsOf(node.members, file, defaults));
    } else if (declaration) {
      const members = membersOf(declaration);
      if (members) {
        props.push(...fieldsOf(members, file, defaults));
      } else if (ts.isTypeAliasDeclaration(declaration)) {
        pending.push(declaration.type);
      }
      extendsFrom.push(...heritageOf(declaration, file));
    } else {
      extendsFrom.push(squash(node.getText(file)));
    }
  }
  return { props, extendsFrom };
}

function heritageOf(declaration: Declaration, file: ts.SourceFile) {
  if (!ts.isInterfaceDeclaration(declaration)) {
    return [];
  }
  return (declaration.heritageClauses ?? []).flatMap((clause) =>
    clause.types.map((type) => squash(type.getText(file)))
  );
}

const namesIn = (text: string) => text.match(TYPE_NAME) ?? [];

/** The types the props mention, then the types those mention, in order. */
function collectTypes(
  props: ApiField[],
  skip: Set<string>,
  { file, declarations }: Parsed
) {
  const types: ApiType[] = [];
  const seen = new Set(skip);
  const queue = props.flatMap((prop) => namesIn(prop.type));
  while (queue.length > 0 && types.length < MAX_TYPES) {
    const typeName = queue.shift() as string;
    const declaration = declarations.get(typeName);
    if (seen.has(typeName) || !declaration) {
      continue;
    }
    seen.add(typeName);
    const members = membersOf(declaration);
    const description = jsDocOf(declaration);
    if (members) {
      const fields = fieldsOf(members, file, new Map());
      types.push({ name: typeName, fields, description });
      queue.push(...fields.flatMap((f) => namesIn(f.type)));
    } else if (ts.isTypeAliasDeclaration(declaration)) {
      const text = squash(declaration.type.getText(file));
      types.push({
        name: typeName,
        code: `type ${typeName} = ${text};`,
        description,
      });
      queue.push(...namesIn(text));
    }
  }
  return types;
}

function parse(name: string, source: string): Parsed {
  const file = ts.createSourceFile(
    `${name}.tsx`,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const declarations = new Map<string, Declaration>();
  for (const statement of file.statements) {
    if (
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement)
    ) {
      declarations.set(statement.name.text, statement);
    }
  }
  return { file, declarations };
}

/**
 * The props a registry component takes, with their types, defaults and
 * JSDoc, plus the types those props refer to. Read from the source with the
 * TypeScript parser, so the table on the page is always the shipped code.
 */
export async function getComponentApi(
  name: string
): Promise<ComponentApi | undefined> {
  "use cache";
  cacheLife("max");

  const source = await readComponentSource(name).catch(() => undefined);
  if (!source) {
    return;
  }
  const parsed = parse(name, source);
  const exported = defaultExport(parsed.file);
  const parameter = exported?.fn.parameters[0];
  if (!(exported && parameter)) {
    return;
  }
  const { props, extendsFrom } = collectProps(
    parameter.type,
    parsed,
    defaultsOf(parameter, parsed.file)
  );
  if (props.length === 0 && extendsFrom.length === 0) {
    return;
  }
  const skip = new Set(namesIn(parameter.type?.getText(parsed.file) ?? ""));
  const types = collectTypes(props, skip, parsed);
  return { component: exported.name, props, extendsFrom, types };
}

const cell = (text: string) => text.replaceAll("|", "\\|");

function fieldTable(fields: ApiField[], withDefaults: boolean) {
  const head = withDefaults
    ? "| Prop | Type | Default | Description |\n| --- | --- | --- | --- |"
    : "| Field | Type | Description |\n| --- | --- | --- |";
  const rows = fields.map((field) => {
    const name = `\`${field.name}${field.required ? "" : "?"}\``;
    const type = `\`${cell(field.type)}\``;
    const description = cell(field.description ?? "");
    if (!withDefaults) {
      return `| ${name} | ${type} | ${description} |`;
    }
    const value = field.defaultValue ? `\`${cell(field.defaultValue)}\`` : "";
    return `| ${name} | ${type} | ${value} | ${description} |`;
  });
  return [head, ...rows].join("\n");
}

/** The same API as Markdown, for the `.md` pages agents read. */
export function apiToMarkdown(api: ComponentApi) {
  const parts = ["## Props", "", fieldTable(api.props, true), ""];
  if (api.extendsFrom.length > 0) {
    parts.push(
      `Also takes every prop of ${api.extendsFrom.map((t) => `\`${t}\``).join(", ")}.`,
      ""
    );
  }
  for (const type of api.types) {
    parts.push(`### ${type.name}`, "");
    if (type.description) {
      parts.push(type.description, "");
    }
    parts.push(
      type.fields
        ? fieldTable(type.fields, false)
        : `\`\`\`ts\n${type.code}\n\`\`\``,
      ""
    );
  }
  return parts.join("\n");
}
