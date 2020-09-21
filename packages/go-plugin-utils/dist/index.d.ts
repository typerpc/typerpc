import { DataType, Message, MutationMethod, MutationService, Param, Property, QueryMethod, QueryService, Schema } from '@typerpc/schema';
export declare const typeMap: Map<string, string>;
export declare const dataType: (type: DataType) => string;
export declare const scalarFromQueryParam: (param: string, type: DataType) => string;
export declare const fromQueryString: (param: string, type: DataType) => string;
export declare const toQueryString: (param: string, type: DataType) => string;
export declare const handleOptional: (property: Property) => string;
export declare const buildProps: (props: ReadonlyArray<Property>) => string;
export declare const buildType: (type: Message) => string;
export declare const buildTypes: (messages: ReadonlyArray<Message>) => string;
export declare const buildMethodParams: (params: ReadonlyArray<Param>) => string;
export declare const buildReturnType: (type: DataType) => string;
export declare const buildMethodSignature: (method: MutationMethod | QueryMethod) => string;
export declare const buildInterfaceMethods: (methods: ReadonlyArray<MutationMethod | QueryMethod>) => string;
export declare const buildInterface: (service: MutationService | QueryService) => string;
export declare const parseQueryParams: (method: QueryMethod) => string;
export declare const buildRequestBodyType: (method: MutationMethod) => string;
export declare const parseReqBody: (method: MutationMethod | QueryMethod) => string;
export declare const buildParamNames: (method: QueryMethod | MutationMethod) => string;
export declare const buildResultDeclarations: (type: DataType) => string;
export declare const buildResultInitializers: (type: DataType) => string;
export declare const buildClientResponseStruct: (type: DataType) => string;
export declare const buildServerResponseStruct: (type: DataType) => string;
export declare const buildFileName: (fileName: string) => string;
export declare const buildInterfaces: (schema: Schema) => string;
export declare const serverHelpers: (pkg: string) => string;
//# sourceMappingURL=index.d.ts.map