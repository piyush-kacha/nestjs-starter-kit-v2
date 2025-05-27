#!/usr/bin/env ts-node
import * as fs from 'node:fs';
import * as path from 'node:path';

// --- Configuration ---
/**
 * Path to the directory containing Prisma model files.
 */
const PRISMA_MODELS_DIR = path.resolve(__dirname, '../prisma/models');
/**
 * Path to the output directory for generated entity files.
 */
const ENTITIES_DIR = path.resolve(__dirname, '../src/db/entities');

/**
 * Maps Prisma scalar types to TypeScript types.
 */
const PRISMA_TO_TS_TYPE_MAP: Record<string, string> = {
  String: 'string',
  Boolean: 'boolean',
  Int: 'number',
  Float: 'number',
  DateTime: 'Date',
  Json: 'Record<string, any>',
  BigInt: 'bigint',
  Decimal: 'number',
  Bytes: 'Buffer',
};

/**
 * Maps Prisma scalar types to Swagger types for @ApiProperty.
 */
const PRISMA_TO_SWAGGER_TYPE_MAP: Record<string, string> = {
  String: 'String',
  Boolean: 'Boolean',
  Int: 'Number',
  Float: 'Number',
  DateTime: 'Date',
  Json: 'Object',
  BigInt: 'String',
  Decimal: 'Number',
  Bytes: 'String',
};

/**
 * Maps Prisma scalar types to class-validator decorators.
 */
const PRISMA_TO_VALIDATOR_MAP: Record<string, string[]> = {
    String: ['@IsString()'],
    Int: ['@IsInt()'],
    Boolean: ['@IsBoolean()'],
    Float: ['@IsNumber()'],
    DateTime: ['@IsDateString()'], // Consider @IsISO8601() based on desired format
    Json: ['@IsObject()'], 
    BigInt: ['@IsString()'], // Validated as strings if they might exceed JS number limits
    Decimal: ['@IsNumber()'],
    Bytes: ['@IsInstance(Buffer)'], // Requires IsInstance from class-validator
};

// --- Interfaces ---

/**
 * Represents a parsed attribute from a Prisma field.
 * Example: @id, @unique, @relation(fields: [authorId], references: [id])
 */
interface PrismaFieldAttribute {
  /** The full attribute string, e.g., "@id", "@default(true)", "@relation(fields: [authorId], references: [id])" */
  fullAttribute: string;
  /** The name of the attribute, e.g., "@id", "@default", "@relation". */
  name: string;
  /** Optional arguments for the attribute, parsed from within the parentheses. */
  args?: string[];
}

/**
 * Represents a parsed field definition from a Prisma model.
 */
interface PrismaFieldDefinition {
  name: string;
  type: string; // Original Prisma type (e.g., String, User, Post[])
  tsType: string; // Corresponding TypeScript type (e.g., string, UserEntity, PostEntity[])
  swaggerType: string; // Type string for @ApiProperty (e.g., "String", "() => UserEntity")
  isOptional: boolean;
  isArray: boolean;
  description?: string; // From "///" comments
  attributes: PrismaFieldAttribute[];
  isRelation: boolean;
  relationName?: string; // Name of the related model (e.g., User, Post)
  // Details specific to @relation attribute
  relationAttributeFields?: string[]; 
  relationAttributeReferences?: string[];
  relationAttributeName?: string; // Optional explicit name of the relation, e.g., @relation("AuthorPosts")
  relationOnUpdate?: string;
  relationOnDelete?: string;
}

/**
 * Represents a fully parsed Prisma model, ready for entity generation.
 */
interface ParsedPrismaModel {
  modelName: string;
  fields: PrismaFieldDefinition[];
  /** Set of entity class names to import (e.g., "UserEntity", "PostEntity") */
  imports: Set<string>;
}

// --- Helper Functions ---

/**
 * Generates the entity file name from a model name.
 * @param modelName - The name of the Prisma model (e.g., "UserProfile").
 * @returns The kebab-case file name (e.g., "user-profile.entity.ts").
 */
function getEntityFileName(modelName: string): string {
  const kebabCaseName = modelName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2') // Add hyphen between camelCase parts
    .toLowerCase();
  return `${kebabCaseName}.entity.ts`;
}

/**
 * Generates the entity class name from a model name.
 * @param modelName - The name of the Prisma model (e.g., "UserProfile").
 * @returns The entity class name (e.g., "UserProfileEntity").
 */
function getEntityClassName(modelName: string): string {
  return `${modelName}Entity`;
}

/**
 * Scans all .prisma files in the specified directory to find all defined model names.
 * This is crucial for correctly identifying relation fields.
 * @param directoryPath - Path to the directory containing Prisma model files.
 * @returns A Set of all discovered model names.
 * @throws Error if the directory cannot be read.
 */
function findAllModelNames(directoryPath: string): Set<string> {
  const modelNames = new Set<string>();
  console.log(`Scanning for Prisma models in: ${directoryPath}`);
  if (!fs.existsSync(directoryPath)) {
    console.error(`Prisma models directory not found: ${directoryPath}`);
    throw new Error(`Prisma models directory not found: ${directoryPath}`);
  }

  try {
    const files = fs.readdirSync(directoryPath);
    for (const file of files) {
      if (file.endsWith('.prisma')) {
        const filePath = path.join(directoryPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const modelRegex = /^\s*model\s+(\w+)\s*\{/gm;
        let match;
        while ((match = modelRegex.exec(content)) !== null) {
          if (match[1]) {
            modelNames.add(match[1]);
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning Prisma models directory ${directoryPath}:`, error);
    throw error; 
  }
  return modelNames;
}

/**
 * Parses Prisma field attributes from a string.
 * @param attributeString - The string containing attributes (e.g., "@id @default(uuid())").
 * @returns An array of parsed PrismaFieldAttribute objects.
 */
function parsePrismaAttributes(attributeString?: string): PrismaFieldAttribute[] {
  if (!attributeString?.trim()) {
    return [];
  }
  const attributes: PrismaFieldAttribute[] = [];
  const attributeRegex = /@([\w.]+)(?:\(([^)]*)\))?/g;
  let match;
  while ((match = attributeRegex.exec(attributeString)) !== null) {
    const fullAttribute = match[0];
    const name = `@${match[1]}`;
    const argsString = match[2];
    let args: string[] | undefined;
    if (argsString) {
      // This simple split might need improvement for complex arguments like nested functions or strings with commas.
      args = argsString.split(',').map(arg => arg.trim());
    }
    attributes.push({ name, args, fullAttribute });
  }
  return attributes;
}

/**
 * Parses arguments from a @relation attribute string to extract details.
 * @param fullAttribute - The full @relation attribute string.
 * @returns A partial PrismaFieldDefinition containing relation details.
 */
function parseRelationArgs(fullAttribute: string): Partial<PrismaFieldDefinition> {
    const relationDetails: Partial<PrismaFieldDefinition> = {};
    
    const fieldsMatch = fullAttribute.match(/fields:\s*\[([^\]]+)\]/);
    if (fieldsMatch?.[1]) {
        relationDetails.relationAttributeFields = fieldsMatch[1].split(',').map(f => f.trim());
    }

    const referencesMatch = fullAttribute.match(/references:\s*\[([^\]]+)\]/);
    if (referencesMatch?.[1]) {
        relationDetails.relationAttributeReferences = referencesMatch[1].split(',').map(r => r.trim());
    }

    const nameMatch = fullAttribute.match(/@relation\s*\(\s*"([^"]+)"/); // Matches @relation("NamedRelation") or @relation(name: "NamedRelation")
    const nameArgMatch = fullAttribute.match(/name:\s*"([^"]+)"/);
    if (nameMatch?.[1]) {
        relationDetails.relationAttributeName = nameMatch[1];
    } else if (nameArgMatch?.[1]) {
        relationDetails.relationAttributeName = nameArgMatch[1];
    }
    
    const onDeleteMatch = fullAttribute.match(/onDelete:\s*(\w+)/);
    if (onDeleteMatch?.[1]) {
        relationDetails.relationOnDelete = onDeleteMatch[1];
    }

    const onUpdateMatch = fullAttribute.match(/onUpdate:\s*(\w+)/);
    if (onUpdateMatch?.[1]) {
        relationDetails.relationOnUpdate = onUpdateMatch[1];
    }
    return relationDetails;
}

/**
 * Parses the content of a Prisma model definition to extract its structure.
 * @param fileContent - The full string content of the .prisma file.
 * @param modelName - The specific model name to parse from the file content.
 * @param allModelNames - A Set of all known model names in the schema, for relation detection.
 * @returns A ParsedPrismaModel object.
 */
function parsePrismaModel(
  fileContent: string,
  modelName: string,
  allModelNames: Set<string>
): ParsedPrismaModel {
  const fields: PrismaFieldDefinition[] = [];
  const imports = new Set<string>();
  
  const modelBlockRegex = new RegExp(`(?:type\\s+|model\\s+)${modelName}\\s*\\{([\\s\\S]*?)\\}`, 'm');
  const modelBlockMatch = fileContent.match(modelBlockRegex);

  if (!modelBlockMatch?.[1]) {
    console.warn(`Could not find or parse model block for ${modelName}.`);
    return { modelName, fields, imports };
  }
  
  const modelContent = modelBlockMatch[1];
  const lines = modelContent.split('\n');
  let currentDescription: string | undefined;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('///')) {
      currentDescription = trimmedLine.replace('///', '').trim();
      continue;
    }

    if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('@@')) {
      currentDescription = undefined; 
      continue;
    }
    
    const fieldRegex = /^(\w+)\s+(\w+)(\[\])?(\?)?(.*)$/;
    const fieldMatch = trimmedLine.match(fieldRegex);

    if (fieldMatch) {
      const [, name, prismaType, arrayMarker, optionalMarker, attributesString] = fieldMatch;
      const isOptional = !!optionalMarker;
      const isArray = !!arrayMarker;
      const attributes = parsePrismaAttributes(attributesString.trim());
      
      const isRelation = allModelNames.has(prismaType);
      let tsType: string;
      let swaggerType: string; // This will be the string for the `type` property in @ApiProperty
      let relationName: string | undefined;

      if (isRelation) {
        relationName = prismaType;
        const relatedEntityClassName = getEntityClassName(relationName);
        tsType = isArray ? `${relatedEntityClassName}[]` : relatedEntityClassName;
        swaggerType = relatedEntityClassName; // Will be wrapped with () => later for ApiProperty
        if (modelName !== relationName) { 
          imports.add(relatedEntityClassName); 
        }
      } else {
        tsType = PRISMA_TO_TS_TYPE_MAP[prismaType] || 'any';
        if (isArray) tsType += '[]';
        swaggerType = PRISMA_TO_SWAGGER_TYPE_MAP[prismaType] || 'Object';
      }

      const fieldDef: PrismaFieldDefinition = {
        name,
        type: prismaType,
        tsType,
        swaggerType,
        isOptional,
        isArray,
        description: currentDescription,
        attributes,
        isRelation,
        relationName,
      };

      const relationAttribute = attributes.find(attr => attr.name === '@relation');
      if (isRelation && relationAttribute?.fullAttribute) {
          const relationDetails = parseRelationArgs(relationAttribute.fullAttribute);
          Object.assign(fieldDef, relationDetails);
      }

      fields.push(fieldDef);
      currentDescription = undefined; 
    }
  }
  return { modelName, fields, imports };
}

/**
 * Generates the TypeScript content for an entity class.
 * @param parsedModel - The parsed Prisma model structure.
 * @returns A string containing the generated TypeScript code for the entity.
 */
function generateEntityContent(parsedModel: ParsedPrismaModel): string {
  const { modelName, fields, imports: relatedEntityImports } = parsedModel;
  const entityClassName = getEntityClassName(modelName);

  const importStatements = new Set<string>();
  importStatements.add(`import { ApiProperty } from "@nestjs/swagger";`);
  // Import PrismaClient's model type for `implements` clause
  importStatements.add(`import { ${modelName} as Prisma${modelName} } from "@prisma/client";`);

  const validatorImports = new Set<string>();

  const fieldStrings = fields.map(field => {
    const apiPropertyOptions: string[] = [];
    if (field.description) {
      apiPropertyOptions.push(`  description: "${field.description.replace(/"/g, '\\"')}",`);
    }
    if (field.isOptional) {
      apiPropertyOptions.push(`  required: false,`);
    }

    if (field.isRelation) {
      const typeString = field.isArray ? `() => [${field.swaggerType}]` : `() => ${field.swaggerType}`;
      apiPropertyOptions.push(`  type: ${typeString},`);
    } else {
      apiPropertyOptions.push(`  type: ${field.swaggerType},`); // For primitives, swaggerType is 'String', 'Number', etc.
    }
    if (field.isArray && !field.isRelation) { // isArray for relations is handled by type: () => [RelatedEntity]
        apiPropertyOptions.push(`  isArray: true,`);
    }
    
    // Basic example generation (can be significantly improved)
    let exampleValue = `'example_${field.name}'`;
    if (field.isArray) exampleValue = `[${exampleValue}]`;
    if (field.isRelation) exampleValue = field.isArray ? `[{ id: 'related_${field.relationName}_id' }]` : `{ id: 'related_${field.relationName}_id' }`;
    else if (field.type === 'Int') exampleValue = '1';
    else if (field.type === 'Boolean') exampleValue = 'true';
    else if (field.type === 'DateTime') exampleValue = `'${new Date().toISOString()}'`;

    apiPropertyOptions.push(`  example: ${exampleValue},`);

    const decorators: string[] = [`  @ApiProperty({\n${apiPropertyOptions.join('\n')}\n  })`];
    
    if (field.isOptional) {
      decorators.push(`  @IsOptional()`);
      validatorImports.add('IsOptional');
    }

    if (!field.isRelation) {
        const validators = PRISMA_TO_VALIDATOR_MAP[field.type] || [];
        validators.forEach(validator => {
            const validatorNameMatch = validator.match(/@(\w+)\(\)/);
            if (validatorNameMatch?.[1]) {
                validatorImports.add(validatorNameMatch[1]);
            }
            decorators.push(`  ${validator}`);
        });
        if (field.type === "String" && field.name.toLowerCase().includes("email")) {
            validatorImports.add('IsEmail');
            decorators.push(`  @IsEmail()`);
        }
    }
    
    return `${decorators.join('\n')}\n  ${field.name}${field.isOptional ? "?" : ""}: ${field.tsType};\n`;
  }).join('\n');

  relatedEntityImports.forEach(relatedEntityClassNameToImport => {
    if (relatedEntityClassNameToImport !== entityClassName) { 
      const relatedModelName = relatedEntityClassNameToImport.replace('Entity', '');
      const relatedFileName = getEntityFileName(relatedModelName); 
      importStatements.add(`import { ${relatedEntityClassNameToImport} } from './${relatedFileName.replace('.ts', '')}';`);
    }
  });
  
  if (validatorImports.size > 0) {
    importStatements.add(`import { ${Array.from(validatorImports).sort().join(', ')} } from "class-validator";`)
  }

  return `${Array.from(importStatements).sort().join('\n')}\n\n` + // Sort imports for consistency
         `export class ${entityClassName} implements Prisma${modelName} {\n` +
         `${fieldStrings}\n` +
         `}\n`;
}

/**
 * Main function to generate NestJS entity classes from Prisma models.
 */
async function generateEntities() {
  console.log('Starting entity generation process...');

  const allModelNames = findAllModelNames(PRISMA_MODELS_DIR);
  if (allModelNames.size === 0) {
    console.warn('No Prisma models found. Please ensure your Prisma models are in the correct directory.');
    return;
  }
  console.log(`Successfully discovered model names: ${Array.from(allModelNames).join(', ')}`);

  if (!fs.existsSync(ENTITIES_DIR)) {
    console.log(`Entities directory does not exist. Creating: ${ENTITIES_DIR}`);
    fs.mkdirSync(ENTITIES_DIR, { recursive: true });
  }

  console.log('Generating entity files...');

  try {
    const prismaFiles = fs.readdirSync(PRISMA_MODELS_DIR).filter(f => f.endsWith('.prisma'));

    for (const prismaFile of prismaFiles) {
        const filePath = path.join(PRISMA_MODELS_DIR, prismaFile);
        console.log(`\nProcessing Prisma file: ${prismaFile}`);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        
        const modelRegex = /^\s*(?:model|type)\s+(\w+)\s*\{/gm; // Support 'type' for composite types if needed in future
        let match;
        while ((match = modelRegex.exec(fileContent)) !== null) {
          const modelName = match[1];
          if (allModelNames.has(modelName)) { 
            console.log(`  Parsing model: ${modelName}`);
            const parsedModel = parsePrismaModel(fileContent, modelName, allModelNames);
            
            if (parsedModel.fields.length === 0) {
                console.warn(`  Model ${modelName} parsed with no fields. Skipping entity generation for this model.`);
                continue;
            }

            console.log(`    Generating content for ${getEntityClassName(modelName)}...`);
            const entityContent = generateEntityContent(parsedModel);
            const entityFilePath = path.join(ENTITIES_DIR, getEntityFileName(modelName));
            
            fs.writeFileSync(entityFilePath, entityContent);
            console.log(`    Successfully generated entity: ${entityFilePath}`);
          } else {
            // This case should ideally not be hit if findAllModelNames is comprehensive
            // and models are correctly defined. Could indicate an issue with model name extraction or schema structure.
            console.warn(`  Model name "${modelName}" found in ${prismaFile} but not in the global list of models. It might be a type alias or an embedded type not intended for entity generation.`);
          }
        }
      }
  } catch (error) {
    console.error('\nAn error occurred during the entity generation process:');
    if (error instanceof Error) {
        console.error(`Error Name: ${error.name}`);
        console.error(`Error Message: ${error.message}`);
        if (error.stack) {
            console.error(`Stack Trace:\n${error.stack}`);
        }
    } else {
        console.error(error);
    }
    process.exit(1);
  }

  console.log('\nEntity generation completed successfully!');
}

// --- Execute Script ---
generateEntities().catch(error => {
  // This catch is for unhandled promise rejections from generateEntities itself,
  // though internal errors should be caught and logged within generateEntities.
  console.error('Unhandled critical error during script execution:', error);
  process.exit(1);
});
