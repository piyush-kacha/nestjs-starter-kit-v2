#!/usr/bin/env ts-node
import * as fs from "node:fs";
import * as path from "node:path";

// Paths
const PRISMA_MODELS_DIR = path.resolve(__dirname, "../prisma/models");
const ENTITIES_DIR = path.resolve(__dirname, "../src/db/entities");

// TypeScript type mapping from Prisma to TypeScript
const typeMapping: Record<string, string> = {
  String: "string",
  Boolean: "boolean",
  Int: "number",
  Float: "number",
  DateTime: "Date",
  Json: "Record<string, any>",
  BigInt: "bigint",
  Decimal: "number",
  Bytes: "Buffer",
};

// Example values for ApiProperty
const exampleValues: Record<string, string> = {
  String: '"example"',
  Boolean: "true",
  Int: "1",
  Float: "1.0",
  DateTime: '"2025-05-15T12:19:14.123Z"',
  Json: '{ "key": "value" }',
  BigInt: '"1234567890123456789"',
  Decimal: "1.23",
  Bytes: 'Buffer.from("example")',
  ObjectId: '"5f9d5a5b9d6b6d3d4c3d2c1b"',
};

// Description templates
const descriptionTemplates: Record<string, string> = {
  id: "The unique identifier",
  email: "Email address",
  password: "User password",
  name: "Name",
  createdAt: "Creation timestamp",
  updatedAt: "Last update timestamp",
};

// Parse a Prisma model file
function parsePrismaModel(fileContent: string): {
  modelName: string;
  fields: Array<{
    name: string;
    type: string;
    isOptional: boolean;
    isArray: boolean;
    isRelation: boolean;
    relationName?: string;
  }>;
} {
  const lines = fileContent.split("\n");
  let modelName = "";
  const fields: Array<{
    name: string;
    type: string;
    isOptional: boolean;
    isArray: boolean;
    isRelation: boolean;
    relationName?: string;
  }> = [];

  // Extract model name
  const modelMatch = fileContent.match(/model\s+(\w+)\s*\{/);
  if (modelMatch) {
    modelName = modelMatch[1];
  }

  // Process each line to extract fields
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (
      !trimmedLine ||
      trimmedLine.startsWith("//") ||
      trimmedLine.startsWith("model") ||
      trimmedLine === "{" ||
      trimmedLine === "}"
    ) {
      continue;
    }

    // Parse field definition
    const fieldMatch = trimmedLine.match(/(\w+)\s+(\w+)(\[\])?\??(\s+@.*)?/);
    if (fieldMatch) {
      const [, name, type, arrayMarker, attributes] = fieldMatch;

      // Check if it's a relation field by looking for model references
      const isRelation =
        type.charAt(0) === type.charAt(0).toUpperCase() &&
        type !== "String" &&
        type !== "Boolean" &&
        type !== "Int" &&
        type !== "Float" &&
        type !== "DateTime" &&
        type !== "Json" &&
        type !== "BigInt" &&
        type !== "Decimal" &&
        type !== "Bytes";

      fields.push({
        name,
        type,
        isOptional: trimmedLine.includes("?"),
        isArray: !!arrayMarker || trimmedLine.includes("[]"),
        isRelation,
        relationName: isRelation ? type : undefined,
      });
    }
  }

  return { modelName, fields };
}

// Generate entity file content
function generateEntityContent(modelName: string, fields: Array<any>): string {
  let content = `import { ApiProperty } from "@nestjs/swagger";\n`;
  content += `import { ${modelName} } from "@prisma/client";\n\n`;

  content += `export class ${modelName}Entity implements ${modelName} {\n`;

  for (const field of fields) {
    if (field.isRelation && field.isArray) {
      // Skip array relations as they need special handling
      continue;
    }

    // Generate description based on field name or use a generic one
    const description =
      descriptionTemplates[field.name] || `${modelName}'s ${field.name}`;

    // Generate example based on type
    let example = "";
    if (field.name === "id") {
      example = `"1"`;
    } else if (field.type === "String") {
      if (field.name.includes("email")) {
        example = `"user@example.com"`;
      } else if (field.name.includes("password")) {
        example = `"password"`;
      } else if (field.name.includes("code")) {
        example = `"123456"`;
      } else if (field.name.includes("name")) {
        example = `"Example Name"`;
      } else {
        example = `"example-${field.name}"`;
      }
    } else if (field.type === "Boolean") {
      example = field.name.includes("verified") ? "true" : "false";
    } else if (field.type === "DateTime") {
      example = `"2025-05-15T12:19:14.123Z"`;
    } else {
      example = exampleValues[field.type] || `"example"`;
    }

    // Add ApiProperty decorator
    content += "  @ApiProperty({\n";
    content += `    description: "${description}",\n`;

    if (field.isArray) {
      content += "    isArray: true,\n";
      content += `    example: [${example}],\n`;
    } else {
      content += `    example: ${example},\n`;
    }

    if (field.isOptional) {
      content += "    required: false,\n";
    }

    content += "  })\n";

    // Add property definition
    const tsType = field.isRelation
      ? field.type
      : typeMapping[field.type] || "any";

    content += `  ${field.name}${field.isOptional ? "?" : ""}: ${tsType}${
      field.isArray ? "[]" : ""
    };\n\n`;
  }

  content += "}\n";
  return content;
}

// Main function
async function generateEntities() {
  console.log("Generating entity files from Prisma models...");

  // Create entities directory if it doesn't exist
  if (!fs.existsSync(ENTITIES_DIR)) {
    fs.mkdirSync(ENTITIES_DIR, { recursive: true });
  }

  // Read all prisma model files
  const modelFiles = fs
    .readdirSync(PRISMA_MODELS_DIR)
    .filter((file) => file.endsWith(".prisma"));

  for (const file of modelFiles) {
    try {
      const filePath = path.join(PRISMA_MODELS_DIR, file);
      const content = fs.readFileSync(filePath, "utf8");

      // Parse model from Prisma file
      const { modelName, fields } = parsePrismaModel(content);

      if (!modelName) {
        console.warn(`Could not extract model name from ${file}, skipping...`);
        continue;
      }

      // Generate entity file content
      const entityContent = generateEntityContent(modelName, fields);

      // Write entity file
      const entityFilePath = path.join(
        ENTITIES_DIR,
        `${modelName.toLowerCase()}.entity.ts`
      );
      fs.writeFileSync(entityFilePath, entityContent);
      console.log(`Generated entity file: ${entityFilePath}`);
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }

  console.log("Entity generation completed!");
}

// Execute the generation
generateEntities().catch(console.error);
