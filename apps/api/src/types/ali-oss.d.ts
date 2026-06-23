declare module 'ali-oss' {
  export interface OSSOptions {
    region: string;
    bucket: string;
    accessKeyId: string;
    accessKeySecret: string;
    stsToken?: string;
    authorizationV4?: boolean;
  }

  export interface STSOptions {
    accessKeyId: string;
    accessKeySecret: string;
    endpoint?: string;
  }

  export interface Credentials {
    AccessKeyId: string;
    AccessKeySecret: string;
    SecurityToken: string;
    Expiration: string;
  }

  export interface AssumeRoleResult {
    credentials: Credentials;
  }

  export interface ObjectMetaResult {
    status: number;
    res: {
      headers: Record<string, string | string[] | undefined>;
    };
  }

  export interface CopyObjectOptions {
    headers?: Record<string, string>;
    meta?: Record<string, string>;
  }

  export interface CopyObjectResult {
    data?: {
      etag?: string;
      lastModified?: string;
    };
    res: unknown;
  }

  export class STS {
    constructor(options: STSOptions);
    assumeRole(
      roleArn: string,
      policy: object | string,
      durationSeconds: number,
      sessionName: string
    ): Promise<AssumeRoleResult>;
  }

  export default class OSS {
    static STS: typeof STS;

    constructor(options: OSSOptions);
    copy(name: string, sourceName: string, options?: CopyObjectOptions): Promise<CopyObjectResult>;
    getObjectMeta(name: string, options?: object): Promise<ObjectMetaResult>;
    signPostObjectPolicyV4(policy: object | string, date: Date): string;
  }
}
