export interface EnumType {
  name: string;
  baseType: number;
}

export interface VariableInfo {
  name: string;
  dtype: string;
  dtype_base?: string;
  nctype?: string;
  shape: number[];
  size: number;
  dimensions?: string[];
  attributes?: Record<string, unknown>;
  // Chunking
  chunked?: boolean;
  chunks?: number[];
  chunkSize?: number;
  totalSize?: number;
  // Enum
  enum?: Record<string, string>;
  enumType?: EnumType;
}

export type VariableArrayData =
  | Int8Array
  | Int16Array
  | Int32Array
  | BigInt64Array
  | Uint8Array
  | Uint16Array
  | Uint32Array
  | BigUint64Array
  | Float32Array
  | Float64Array
  | string[]
  | number[];

export interface Dimension {
  size?: number;
  len?: number;
  length?: number;
}

export interface VariableData {
  name: string;
  info?: VariableInfo;
  data?: VariableArrayData;
}