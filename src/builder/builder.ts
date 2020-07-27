/* eslint-disable no-useless-constructor */
/* eslint-disable max-params */
import path from 'path'
import {Config, createGenerator} from 'ts-json-schema-generator'
import {InterfaceDeclaration, MethodSignature, ParameterDeclaration, SourceFile} from 'ts-morph'
import {BuilderError} from '.'
import {
  getInterfaceName,
  getInterfaces,
  getInterfacesText,
  getMethodName,
  getMethodsForFile,
  getMethodsForInterface,
  getParamName,
  getParams,
  getParamWithType,
  getReturnType,
  getTypeAliasesText,
  hasJsDoc,
  hasParams,
  hasReturn,
  isVoidReturn,
  Parser,
} from './parser'

export type Code = {
  [key: string]: string;
}

export type Target = 'client'| 'server'

export type RequestMethod = 'POST' | 'PUT' | 'GET' | 'HEAD' | 'DELETE' | 'OPTIONS' | 'PATCH'

const isRequestMethod = (method: string): method is RequestMethod => {
  return ['POST', 'PUT', 'GET', 'HEAD', 'DELETE', 'OPTIONS', 'PATCH'].includes(method.toUpperCase())
}

type SchemaType = 'request'| 'response'

export const capitalize = (text: string): string => text.replace(/^\w/, c => c.toUpperCase())

export const lowerCase = (text: string): string => text.replace(/^\w/, c => c.toLowerCase())
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

  protected static buildCurrentTime(): string {
    const now = new Date()
    return `${now.getFullYear()}/${now.getMonth()}/${now.getDate()} at ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`
  }

  protected static buildFileHeader(): string {
    return `
// ****************************************************
// CODE GENERATED BY TYPERPC ON ${CodeBuilder.buildCurrentTime()}
// EDITING GENERATED CODE BY HAND IS HIGHLY DISCOURAGED,
// EDITING SCHEMAS AND REGENERATING CODE IS PREFERRED.
// TO REPORT A BUG, REQUEST A NEW FEATURE, OR OTHER
// ISSUES, VISIT https://github.com/g5becks/typeRPC/issues
// ****************************************************
\n`
  }

  protected static removePromise = (method: MethodSignature): string[] => {
    const maybeReturnType = method.getReturnType()
    let returnType: string[] = []
    if (typeof maybeReturnType !== 'undefined') {
      const text = maybeReturnType.getText().trim()
      if (text.includes('Promise<')) {
        const innerTypes = maybeReturnType.getTypeArguments()
        returnType = innerTypes.map(type => type.getText().trim())
      }
    }
    return returnType
  }

  protected static buildSchemaDoc(service: InterfaceDeclaration, method: MethodSignature, schemaType: SchemaType): string {
    return `
/**
* {@link ${capitalize(getInterfaceName(service))}Controller} /${getMethodName(method)} ${capitalize(schemaType)} Schema
*/`
  }

  protected static promisifyMethod(method: MethodSignature): void {
    const returnType = getReturnType(method)
    const promisified = `Promise<${returnType}>`
    if (returnType?.includes('Promise<')) {
      return
    }
    method.setReturnType(promisified)
  }

  // makes all return types of interface methods return a promise
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

  // builds the name for a generated request type
  protected static buildRequestTypeName(method: MethodSignature): string {
    return `${capitalize(method.getName())}Request`
  }

  // Builds a single request type for a method
  protected static buildRequestType(method: MethodSignature): string {
    let typeParams = ''
    if (!hasParams(method)) {
      return ''
    }
    for (const param of getParams(method)) {
      typeParams += `${getParamWithType(param)};\n`
    }
    return `
export type ${CodeBuilder.buildRequestTypeName(method)} = {
  ${typeParams}
}\n`
  }

  // Builds request types for all methods in a file
  // All parameters must be merged into one object and a separate type
  // alias created so that they can be used by the jsonSchemaGenerator
  protected static buildRequestTypesForFile(file: SourceFile): string {
    const methods = getMethodsForFile(file)
    let inputTypes = ''
    for (const method of methods) {
      inputTypes += `${CodeBuilder.buildRequestType(method)}`
    }
    return `${inputTypes}`
  }

  // generates name for method response type
  protected static buildResponseTypeName(method: MethodSignature): string {
    return `${capitalize(method.getName())}Response`
  }

  // builds a single response type for a method
  protected static buildResponseType(method: MethodSignature): string {
    // noinspection TypeScriptValidateTypes
    return `
export type ${CodeBuilder.buildResponseTypeName(method)} = {
  data: ${getReturnType(method)};
}\n`
  }

  // builds response types for all methods in a file
  protected static buildResponseTypesForFile(file: SourceFile): string {
    const methods = getMethodsForFile(file)
    let returnTypes = ''
    for (const method of methods) {
      if (hasReturn(method) && !isVoidReturn(method)) {
        returnTypes += `${CodeBuilder.buildResponseType(method)}`
      }
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
      // eslint-disable-next-line no-console
      console.log(type)
      const schema = JSON.stringify(createGenerator(config).createSchema(config.type), null, 2)
      return this.target === 'server' ? `
${CodeBuilder.buildSchemaDoc(service, method, schemaType)}
export const ${type}Schema = ${schema}\n
` : schema
    } catch (error) {
      throw new BuilderError(error)
    }
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
    for (const service of getInterfaces(file)) {
      for (const method of getMethodsForInterface(service)) {
        if (hasParams(method)) {
          schema += this.buildSchemaForType(typesFile, CodeBuilder.buildRequestTypeName(method), service, method, 'request')
        }
        if (this.target === 'server') {
          if (hasReturn(method)) {
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
    return rMethod && isRequestMethod(rMethod) ? rMethod.toUpperCase() : 'POST'
  }

  // builds the path to a generated file containing types
  protected buildGeneratedTypesFilePath(file: SourceFile): string {
    const typesFile = path.join(this.outputPath, 'types', file.getBaseNameWithoutExtension())
    return `${typesFile}.ts`
  }

  // tells if the method is annotated as a GET request
  protected static isGetMethod(method: MethodSignature): boolean {
    return CodeBuilder.buildRequestMethod(method).toLowerCase().includes('get')
  }

  // builds a list of generated types to import
  protected buildImportedTypes(file: SourceFile): string {
    const requestTypes = CodeBuilder.buildRequestTypesImports(file)
    const responseTypes = CodeBuilder.buildResponseTypeImports(file)
    const imports = this.target === 'client' ? `${requestTypes},${responseTypes}` : requestTypes
    return `import {${getInterfacesText(file)},${getTypeAliasesText(file)},${imports}} from './types/${file.getBaseNameWithoutExtension()}'`
  }

  // builds a list of generated request types to be used when
  // generating import declarations
  protected static buildRequestTypesImports(file: SourceFile): string[] {
    return getMethodsForFile(file)
    .filter(hasParams)
    .map(CodeBuilder.buildRequestTypeName)
  }

  // builds a list of generated response types to be used when
  // generating import declarations
  protected static buildResponseTypeImports(file: SourceFile): string[] {
    return getMethodsForFile(file)
    .filter(hasParams)
    .map(CodeBuilder.buildResponseTypeName)
  }

  // Builds the parameters list for a method call
  protected static buildParams(method: MethodSignature): string {
    return `${method.getParameters().map(getParamName)}`
  }

  protected static buildParamsWithTypes(method: MethodSignature): string[] {
    return hasParams(method) ? method.getParameters().map(getParamWithType) : []
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

  protected static canHaveBody(method: MethodSignature): boolean {
    return ['POST', 'PUT', 'PATCH'].includes(CodeBuilder.buildRequestMethod(method))
  }

  private buildTypesFile(file: SourceFile): string {
    const rpcImport = `import {RpcService} from './${this.jobId}'\n`
    // build interfaces must be called last because the response
    // types cannot be modifies prior to building response types
    return `${this.target === 'server' ? rpcImport : ''}${CodeBuilder.buildFileHeader()}${CodeBuilder.buildTypesText(file)}${CodeBuilder.buildRequestTypesForFile(file)}${CodeBuilder.buildResponseTypesForFile(file)}${this.buildInterfaces(file)}`
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
      paramsList += `:${getParamName(param)}`
    }
    return paramsList
  }

  // builds the route for server handler methods
  protected static buildServerRoute(method: MethodSignature): string {
    const params = method.getParameters()
    return (!CodeBuilder.isGetMethod(method) || params?.length === 0) ? `'/${getMethodName(method)}'` : `'/${getMethodName(method)}/${ServerBuilder.buildRouteParams(params)}'`
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

  protected static buildMethod(method: MethodSignature): string {
    CodeBuilder.promisifyMethod(method)
    if (hasJsDoc(method)) {
      for (const doc of method.getJsDocs()) {
        doc.remove()
      }
    }
    if (method.getFullText().includes(';')) {
      return `
      async ${method.getText().replace(';', '')}\n
      `
    }
    return `
    async ${method.getText().trim()}\n`
  }

  protected static buildStringifyFuncForType(type: string, schema: string): string {
    const parsed: { [key: string]: any }  = JSON.parse(schema)
    const gotten = parsed.definitions[type]
    gotten.title = type

    return `fastJson(${JSON.stringify(gotten)})
    `.trimRight()
  }

  protected static buildRequestDataOrParams(method: MethodSignature, requestType: string, schema: string): string {
    let dataOrParams = ''
    const params = CodeBuilder.buildParams(method)
    if (CodeBuilder.isGetMethod(method)) {
      dataOrParams = `params: {${params}}`
    } else if (CodeBuilder.canHaveBody(method)) {
      dataOrParams = `
      data: ${ClientBuilder.buildStringifyFuncForType(requestType, schema)}({${params}})
      `
    }
    return dataOrParams
  }

  protected static buildRequestArgsName(method: MethodSignature): string {
    return `${getMethodName(method)}Args`
  }

  protected static buildRequestArgs(method: MethodSignature, serviceName: string, requestType: string, schema: string): string {
    const methodName = getMethodName(method)

    return `
const ${ClientBuilder.buildRequestArgsName(method)} = (${CodeBuilder.buildParamsWithTypes(method)}): AxiosRequestConfig => {
      return {
        url: '/${lowerCase(serviceName)}/${lowerCase(methodName)}', method: '${CodeBuilder.buildRequestMethod(method)}', ${ClientBuilder.buildRequestDataOrParams(method, requestType, schema)}
      }
  }\n
    `
  }

  protected buildRequestArgsForFile(file: SourceFile): string {
    const typesFile = this.buildGeneratedTypesFilePath(file)
    let args = ''
    for (const service of getInterfaces(file)) {
      const serviceName = service.getNameNode().getText().trim()
      for (const method of getMethodsForInterface(service)) {
        if (hasParams(method)) {
          const type = CodeBuilder.buildRequestTypeName(method)
          const schema = this.buildSchemaForType(typesFile, type, service, method, 'request')
          args += ClientBuilder.buildRequestArgs(method, serviceName, type, schema)
        }
      }
    }

    return args
  }

  public abstract buildTypes(): Code

  public  abstract buildRpc(): Code
}

