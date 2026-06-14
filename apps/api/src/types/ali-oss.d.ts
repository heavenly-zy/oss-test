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
    signPostObjectPolicyV4(policy: object | string, date: Date): string;
  }
}
