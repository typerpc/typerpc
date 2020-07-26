/* eslint-disable no-useless-constructor */
/* eslint-disable max-params */
import path from 'path'
import {Config, createGenerator} from 'ts-json-schema-generator'
import {InterfaceDeclaration, MethodSignature, ParameterDeclaration, SourceFile} from 'ts-morph'
import {BuilderError} from '.'
import {Parser} from './parser'

export type Code = {
  [key: string]: string;
}

export type Target = 'client'| 'server'

export type RequestMethod = 'POST' | 'PUT' | 'GET' | 'HEAD' | 'DELETE' | 'OPTIONS' | 'PATCH'

const isRequestMethod = (method: string): method is RequestMethod => {
  return ['POST', 'PUT', 'GET', 'HEAD', 'DELETE', 'OPTIONS', 'PATCH'].includes(method)
}

type SchemaType = 'request'| 'response'

/**
 *  Base class that all generators extend from, contains various utility method for parsing and generating code
 *
 * @export
 * @class Generator
 */
export abstract class CodeBuilder {
  protected readonly parser: Parser

  protected constructor(protected readonly target: Target, protected readonly tsConfigFilePath: string, protected readonly outputPath: string, protected readonly jobId: string) {
    this.parser = new Parser(tsConfigFilePath)
  }

  protected static currentTime(): string {
    const now = new Date()
    return `${now.getFullYear()}/${now.getMonth()}/${now.getDate()} at ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`
  }

  protected static fileHeader(): string {
    return `
// ****************************************************
// CODE GENERATED BY TYPERPC ON ${CodeBuilder.currentTime()}
// EDITING GENERATED CODE BY HAND IS HIGHLY DISCOURAGED,
// EDITING SCHEMAS AND REGENERATING CODE IS PREFERRED.
// TO REPORT A BUG, REQUEST A NEW FEATURE, OR OTHER
// ISSUES, VISIT https://github.com/g5becks/typeRPC/issues
// ****************************************************
\n`
  }

  protected static buildSchemaDoc(service: InterfaceDeclaration, method: MethodSignature, schemaType: SchemaType): string {
    return `
/**
* {@link ${CodeBuilder.capitalize(service.getNameNode().getText().trim())}Controller} /${method.getNameNode().getText().trim()} ${CodeBuilder.capitalize(schemaType)} Schema
*/`
  }

  protected static capitalize(text: string): string {
    return text.replace(/^\w/, c => c.toUpperCase())
  }

  protected static lowerCase(text: string): string {
    return text.replace(/^\w/, c => c.toLowerCase())
  }

  private static promisifyMethod(method: MethodSignature): void {
    // noinspection TypeScriptValidateTypes
    const returnType = method.getReturnTypeNode()?.getText().trim()
    const promisified = `Promise<${returnType}>`
    if (returnType?.includes('Promise<')) {
      return
    }
    method.setReturnType(promisified)
  }

  private static promisifyMethods(service: InterfaceDeclaration): void {
    for (const method of service.getMethods()) {
      CodeBuilder.promisifyMethod(method)
    }
  }

  // Copies all interfaces from schema to output
  protected buildInterfaces(file: SourceFile): string {
    const services = file.getInterfaces()
    let servicesText = ''
    for (const srvc of services) {
      srvc.setIsExported(true)
      if (this.target === 'server') {
        srvc.insertExtends(0, 'RpcService')
      }
      CodeBuilder.promisifyMethods(srvc)

      servicesText += `${srvc.getFullText()}\n`
    }
    return servicesText
  }

  protected static buildRequestTypeName(method: MethodSignature): string {
    return `${CodeBuilder.capitalize(method.getName())}Request`
  }

  // Builds a single request type for a method
  protected buildRequestType(method: MethodSignature): string {
    let typeParams = ''
    const params = this.parser.getParams(method)
    if (params.length === 0) {
      return ''
    }
    for (const param of params) {
      typeParams += `${param.getText().trim()};\n`
    }
    return `
export type ${CodeBuilder.buildRequestTypeName(method)} = {
  ${typeParams}
}\n`
  }

  // Builds request types for all methods in a file
  // All parameters must be merged into one object and a separate type
  // alias created so that they can be used by the jsonSchemaGenerator
  protected buildRequestTypesForFile(file: SourceFile): string {
    const methods = this.parser.getMethodsForFile(file)
    let inputTypes = ''
    for (const method of methods) {
      inputTypes += `${this.buildRequestType(method)}`
    }
    return `${inputTypes}`
  }

  // generates name for method response type
  protected static buildResponseTypeName(method: MethodSignature): string {
    return `${CodeBuilder.capitalize(method.getName())}Response`
  }

  // builds a single response type for a method
  protected static buildResponseType(method: MethodSignature): string {
    // noinspection TypeScriptValidateTypes
    return `
export type ${CodeBuilder.buildResponseTypeName(method)} = {
  data: ${method.getReturnTypeNode()?.getText().trim()};
}\n`
  }

  // builds response types for all methods in a file
  protected buildResponseTypesForFile(file: SourceFile): string {
    const methods = this.parser.getMethodsForFile(file)
    let returnTypes = ''
    for (const method of methods) {
      returnTypes += `${CodeBuilder.buildResponseType(method)}`
    }
    return returnTypes
  }

  protected static buildRpcFileName(file: SourceFile): string {
    return `${file.getBaseNameWithoutExtension()}.rpc.ts`
  }

  // Generates a jsonSchema for a single type
  // if target is server, if target is client
  // generates a fastJson function to call
  protected buildSchemaForType(filePath: string, type: string, service: InterfaceDeclaration, method: MethodSignature, schemaType: SchemaType): string {
    const config: Config = {path: filePath, type}
    try {
      const schema = JSON.stringify(createGenerator(config).createSchema(config.type), null, 2)
      return this.target === 'server' ? `
${CodeBuilder.buildSchemaDoc(service, method, schemaType)}
export const ${type}Schema = ${schema}\n
` : CodeBuilder.buildStringifyFuncForType(type, schema)
    } catch (error) {
      throw new BuilderError(error)
    }
  }

  protected static buildStringifyFuncForType(type: string, schema: string): string {
    const parsed: { [key: string]: any }  = JSON.parse(schema)
    const gotten = parsed.definitions[type]
    gotten.title = type

    return `
const Stringify${type} = fastJson(
  ${JSON.stringify(gotten)}
)
    `
  }

  // creates request schema variable name
  // used in subclasses during code generation to prevent string
  // concatenation and spelling mistakes
  protected static buildRequestTypeSchemaName(method: MethodSignature): string {
    return `${CodeBuilder.buildRequestTypeName(method)}Schema`
  }

  // creates request schema variable name
  // used in subclasses during code generation to prevent string
  // concatenation and spelling mistakes
  protected static buildResponseTypeSchemeName(method: MethodSignature): string {
    return `${CodeBuilder.buildResponseTypeName(method)}Schema`
  }

  // builds json schema for all request and response types
  // in a generated types file
  protected buildShemasForFile(file: SourceFile): string {
    const typesFile = this.buildGeneratedTypesFilePath(file)

    let schema = ''
    for (const service of this.parser.getInterfaces(file)) {
      for (const method of this.parser.getMethodsForInterface(service)) {
        if (this.parser.hasParams(method)) {
          schema += this.buildSchemaForType(typesFile, CodeBuilder.buildRequestTypeName(method), service, method, 'request')
        }
        if (this.target === 'server') {
          if (this.parser.hasReturn(method)) {
            schema += this.buildSchemaForType(typesFile, CodeBuilder.buildResponseTypeName(method), service, method, 'response')
          }
        }
      }
    }

    return schema
  }

  // Generates a request method based on the method signature's jsdoc
  // Note: Jsdoc must NOT use @desc or @description annotation
  protected static buildRequestMethod(method: MethodSignature) {
    const docs = method.getJsDocs()
    const rMethod = docs[0]?.getDescription().trim()
    return rMethod && isRequestMethod(rMethod) ? rMethod : 'POST'
  }

  protected buildGeneratedTypesFilePath(file: SourceFile): string {
    const typesFile = path.join(this.outputPath, 'types', file.getBaseNameWithoutExtension())
    return `${typesFile}.ts`
  }

  protected static isGetMethod(method: MethodSignature): boolean {
    return CodeBuilder.buildRequestMethod(method).toLowerCase().includes('get')
  }

  protected buildImportedTypes(file: SourceFile): string {
    return `import {${this.parser.getInterfacesText(file)},${this.parser.getTypeAliasesText(file)},${this.buildRequestTypesImports(file)}} from './types/${file.getBaseNameWithoutExtension()}'`
  }

  // builds a list of generated request types to be used when
  // generating imports declarations
  protected buildRequestTypesImports(file: SourceFile): string[] {
    return this.parser.getMethodsForFile(file)
    .filter(this.parser.hasParams)
    .map(CodeBuilder.buildRequestTypeName)
  }

  // Builds the destructured parameters from request body or query
  protected static buildDestructuredParams(method: MethodSignature): string {
    return `${method.getParameters().map(param => param.getNameNode().getText().trim())}`
  }

  // Copies all type aliases from schema to output type
  protected static buildTypesText(file: SourceFile): string {
    const aliases = file.getTypeAliases()
    let messagesText = ''
    for (const alias of aliases) {
      alias.setIsExported(true)
      messagesText += `${alias.getFullText()}\n`
    }
    return messagesText
  }

  private buildTypesFile(file: SourceFile): string {
    const rpcImport = `import {RpcService} from './${this.jobId}'\n`
    // build interfaces must be called last because the response
    // types cannot be modifies prior to building response types
    return `${this.target === 'server' ? rpcImport : ''}${CodeBuilder.fileHeader()}${CodeBuilder.buildTypesText(file)}${this.buildRequestTypesForFile(file)}${this.buildResponseTypesForFile(file)}${this.buildInterfaces(file)}`
  }

  // Generates types for the input schema file
  // Types files contain the rpc schema types along with
  // Request and Response type, but not json schemas
  // The method is to be used in subclasses implementing the
  // abstract generateTypes method, this default method does
  // most of the work, and it should be possible to simply add
  // in any needed generated code using the code param
  protected buildTypesDefault(code: Code = {}): Code {
    for (const file of this.parser.sourceFiles) {
      code[`${file.getBaseNameWithoutExtension()}.ts`] = this.buildTypesFile(file)
    }
    return code
  }
}

/**
 * Abstract class that all ServerBuilders implementations extend from
 *
 * @export
 * @abstract
 * @class ServerBuilder
 * @extends {CodeBuilder}
 */
export abstract class ServerBuilder extends CodeBuilder {
  protected constructor(protected readonly target: Target, protected readonly tsConfigFilePath: string, protected readonly outputPath: string, protected readonly jobId: string) {
    super(target, tsConfigFilePath, outputPath, jobId)
  }

  private static buildRouteParams(params: ParameterDeclaration[]): string {
    let paramsList = ''
    for (const param of params) {
      paramsList += `:${param.getNameNode().getText().trim()}`
    }
    return paramsList
  }

  // builds the route for server handler methods
  protected static buildServerRoute(method: MethodSignature): string {
    const params = method.getParameters()
    return (!CodeBuilder.isGetMethod(method) || params?.length === 0) ? `'/${method.getName().trim()}'` : `'/${method.getName().trim()}/${ServerBuilder.buildRouteParams(params)}'`
  }

  public abstract buildTypes(): Code

  public abstract buildRpc(): Code
}

/**
 * Abstract class that all ClientBuilders Extend from
 *
 * @export
 * @abstract
 * @class ClientBuilder
 * @extends {CodeBuilder}
 */
export abstract class ClientBuilder extends CodeBuilder {
  protected constructor(protected readonly target: Target, protected readonly tsConfigFilePath: string, protected readonly outputPath: string, protected readonly jobId: string) {
    super(target, tsConfigFilePath, outputPath, jobId)
  }

  public abstract buildTypes(): Code

  public  abstract buildRpc(): Code
}