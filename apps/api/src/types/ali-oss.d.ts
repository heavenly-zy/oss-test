declare module 'ali-oss' {
  export interface STSOptions {
    accessKeyId: string;
    accessKeySecret: string;
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
      policy: object,
      durationSeconds: number,
      sessionName: string
    ): Promise<AssumeRoleResult>;
  }
}