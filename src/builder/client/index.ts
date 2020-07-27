import {InterfaceDeclaration, SourceFile} from 'ts-morph'
import {ClientBuilder, Code, CodeBuilder, Target} from '../builder'
import {Parser} from '../parser'

/**
 * Generates client side code using https://www.npmjs.com/package/axios
 *
 * @export
 * @class AxiosGenerator
 * @extends {ClientBuilder}
 */
export class AxiosGenerator extends ClientBuilder {
  // eslint-disable-next-line no-useless-constructor
  constructor(protected readonly target: Target, protected tsConfigFilePath: string, protected readonly outputPath: string, protected readonly jobId: string) {
    super(target, tsConfigFilePath, outputPath, jobId)
  }

  private static typesCode(): string {
    return `
import {AxiosAdapter, AxiosBasicCredentials, AxiosProxyConfig, AxiosTransformer, CancelToken} from 'axios'

export const isValidHttpUrl = (urlString: string): boolean => {
  let url: URL

  try {
    // eslint-disable-next-line node/no-unsupported-features/node-builtins
    url = new URL(urlString)
  } catch (_) {
    return false
  }

  return url.protocol === 'http:' || url.protocol === 'https:'
}

export class RpcError extends Error {
  constructor(public readonly message: string) {
    super(message)
  }
}

export type Headers = {[key: string]: string}

export type RpcClientConfig = {
  transformResponse?: AxiosTransformer | AxiosTransformer[];
  headers?: Headers;
  paramsSerializer?: (params: any) => string;
  timeout?: number;
  timeoutErrorMessage?: string;
  withCredentials?: boolean;
  adapter?: AxiosAdapter;
  auth?: AxiosBasicCredentials;
  xsrfCookieName?: string;
  xsrfHeaderName?: string;
  onUploadProgress?: (progressEvent: any) => void;
  onDownloadProgress?: (progressEvent: any) => void;
  maxContentLength?: number;
  validateStatus?: (status: number) => boolean;
  maxRedirects?: number;
  socketPath?: string | null;
  httpAgent?: any;
  httpsAgent?: any;
  proxy?: AxiosProxyConfig | false;
  cancelToken?: CancelToken;
}
`
  }

  protected imports(file: SourceFile): string {
    return `
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'
import fastJson = require('fast-json-stringify')
import { isValidHttpUrl, RpcClientConfig, RpcError } from './types/${this.jobId}'
${this.buildImportedTypes(file)}
    `
  }

  protected static buildMethod

  protected static buildClient(service: InterfaceDeclaration): string {
    // eslint-disable-next-line no-template-curly-in-string
    const errString = '`${host} is not a valid http url`'
    const serviceName = service.getNameNode().getText().trim()
    return `
export class Axios${serviceName} implements ${serviceName} {
    protected readonly axios: AxiosInstance

    private constructor(protected readonly host: string, protected readonly config?: RpcClientConfig) {
      this.client = axios.create({baseURL: host, ...config})
    }

    public static create(host: string, config?: AxiosRequestConfig): AxiosBookService | RpcError {
      if (!isValidHttpUrl(host)) {
        return new RpcError(${errString})
      }
      return new AxiosBookService(host, config)
    }
}\n
`
  }

  protected static buildClientsForFile(file: SourceFile): string {
    let clients = ''
    for (const service of Parser.getInterfaces(file)) {
      clients += AxiosGenerator.buildClient(service)
    }
    return clients
  }

  public buildTypes(): Code {
    const file = `${this.jobId}.ts`
    return this.buildTypesDefault({
      [file]: AxiosGenerator.typesCode(),
    })
  }

  public buildRpc(): Code {
    const code: Code = {}
    for (const file of this.parser.sourceFiles) {
      const args = this.buildRequestArgsForFile(file)
      const clients = AxiosGenerator.buildClientsForFile(file)
      code[CodeBuilder.buildRpcFileName(file)] = `${this.imports(file)}${CodeBuilder.buildFileHeader()}${args}${clients}`
    }
    return code
  }
}

