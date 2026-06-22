# S3 Upload 使用手册

本手册用于说明 `src/libs/s3-upload` 与
`src/hooks/use-s3-upload.ts` 的设计、接入方式、能力边界和后续演进方向。

## 设计目标

`src/libs/s3-upload` 是仓库内部 shared lib，不是对外发布的 SDK package。它解决的是浏览器端文件直传对象存储：

- 文件数据从浏览器直接上传到对象存储，避免大文件经过业务后端转发。

- 业务后端只负责发放临时凭证、对象存储目标配置和后续业务绑定。

- 开发阶段可以用阿里云 OSS 的 S3\-compatible 接口模拟 AWS S3。

- 生产环境如果切换到 AWS S3，前端仍使用同一套 AWS SDK v3 / S3\-compatible 上传实现。

核心取舍：没有把“开发用 `ali-oss`、生产用 `@aws-sdk/*`”作为主上传架构。

原因：

- 两套 SDK 的 multipart、进度、URL、重试、checkpoint 语义不完全一致。

- 后端联调契约会被两套实现拉扯，后续更容易产生漂移。

- [OSS 官方文档已经明确支持用 AWS SDK 访问 OSS](https://help.aliyun.com/zh/oss/developer-reference/use-aws-sdks-to-access-oss?scm=20140722.S_help%40%40%E6%96%87%E6%A1%A3%40%40451966._.ID_help%40%40%E6%96%87%E6%A1%A3%40%40451966-RL_aws-LOC_doc%7EUND%7Eab-OR_ser-PAR1_6a0b3fa017817674263058959d0095-V_4-PAR3_r-RE_new5-P0_0-P1_0&spm=a2c4g.11186623.help-search.i0)，因此可以统一到 S3\-compatible 协议层。

![Image](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=NjA2MTVhMmFlYTIwZTVmMWVmYzQ5MzJjMWJjNmM0NjBfZDgzZmJmODEwYTQ3NGI1NjdmZTYwMzMwZDQ2ZDkyYjFfSUQ6NzY1Mzg2MDg0NDIwMzE4MzgzN18xNzgyMDk1MjU4OjE3ODIxODE2NThfVjM)

当前 `s3-upload` 实际依赖的是：

- `@aws-sdk/client-s3`：创建浏览器端 `S3Client`，调用 `PutObject`、multipart、`HeadObject` 等 S3\-compatible API。

- `@aws-sdk/s3-request-presigner`：基于 `GetObjectCommand` 生成临时可访问的预签名读 URL。

- `p-limit`：控制 multipart 分片并发数量，避免一次性发起过多浏览器请求。

- `eventemitter3`：在内部上传引擎中派发进度、UploadId、checkpoint 更新等事件。

当前没有引入 `ali-oss`，也没有引入 `@aws-sdk/lib-storage`。

## 能力边界速览

- 应用默认入口会自动绑定 `/api/s3-sts-token`，底层 `createS3Uploader` 保留显式 `getUploadSession` 注入能力。

- upload session 会根据 `credentials.expiresAt` 缓存并提前刷新，避免长时间上传时临时凭证静态缓存到过期。

- 默认只负责当前运行期间的上传；断点记录持久化和本地秒传记录复用都需要业务显式开启或传入适配器。

- `checkpointStore` 用于刷新页面后继续同一个分片上传任务；记录只存在当前浏览器的 `localStorage`，不解决跨设备恢复。

- `completedUploadStore` 用于本地秒传记录复用；命中后仍会校验当前 `bucket`、`region` 和远端对象大小，不等价于内容 hash。

- `useS3Upload` 是 React 状态薄封装；文件选择 UI、日志、业务提交和是否启用本地存储能力都由具体 feature module 决定。

## 为什么没有采用 `@aws-sdk/lib-storage Upload`

虽然 `@aws-sdk/lib-storage Upload` 封装了大对象 multipart 上传、队列并发和进度事件，日常大文件上传很方便。

但 `s3-upload` 要求不只是“能把大文件传上去”，还包括：

- 根据已保存的 `uploadId` 和远端 parts 跳过已上传分片（断点续传上传）。

- 后续可演进到跨浏览器、跨设备的恢复上传。

- 本地秒传记录复用必须可被业务显式选择和校验。

`Upload` 的公开用法没有提供把旧的 `uploadId`、`partNumber + ETag` 列表传回新实例继续上传的恢复入口。它能做普通的文件上传/大文件上传，但不能直接作为“可持久化 upload session 管理器”。因此本仓库选择直接组合 S3 multipart 原语：

- `CreateMultipartUpload`：创建一个 multipart 上传任务，并返回后续分片上传必须携带的 `UploadId`。

- `UploadPart`：上传指定 `PartNumber` 的单个分片，并返回最终合成对象时需要提交的 `ETag`。

- `ListParts`：查询某个 `UploadId` 下远端已经上传成功的分片，用于续传前校准远端状态。

- `CompleteMultipartUpload`：提交完整的 `PartNumber + ETag` 列表，让对象存储把所有分片合成为最终对象。

- `AbortMultipartUpload`：终止 multipart 上传任务，并让对象存储清理该任务下已上传但未合成的分片。

这样可以显式持久化 `uploadId`、`key`、`partSize`，恢复时再调用 `ListParts` 校准远端已完成分片。

## 整体架构

```mermaid
flowchart TD
  UI["业务模块 / React component"] --> Hook["React 上传 Hook<br/>useS3Upload"]
  UI --> AppFacade["应用默认上传门面<br/>createAppS3Uploader"]
  UI --> Facade["底层上传门面<br/>createS3Uploader"]
  Hook --> AppOptions["应用默认配置<br/>createAppS3UploaderOptions"]
  AppFacade --> AppOptions
  AppOptions --> Facade
  Facade --> Engine["内部上传引擎<br/>S3UploadEngine"]
  Engine --> SessionManager["上传会话管理<br/>UploadSessionManager"]
  Engine --> ObjectOps["普通对象操作<br/>object-operations.ts"]
  Engine --> MultipartOps["分片上传操作<br/>multipart-operations.ts"]
  SessionManager --> Session["上传会话获取<br/>upload-session.ts"]
  Session --> Backend["业务后端上传会话接口<br/>upload session API"]
  ObjectOps --> Storage["对象存储<br/>S3 / OSS S3-compatible"]
  MultipartOps --> Storage
  Facade --> CheckpointStore["断点记录适配器<br/>checkpointStore"]
  Facade --> CompletedStore["本地秒传记录适配器<br/>completedUploadStore"]
  CheckpointStore --> LocalStorage["浏览器本地存储<br/>localStorage"]
  CompletedStore --> LocalStorage```

模块职责：

|文件|职责|
|---|---|
|`src/libs/s3-upload/index.ts`|public barrel，只导出团队接入需要的门面、adapter、错误和类型|
|`app/options.ts`|当前应用默认 uploader options，统一绑定默认 upload session API 和 localStorage adapter 策略|
|`app/uploader.ts`|`createAppS3Uploader`，适合非 React 逻辑使用的应用默认上传门面|
|`core/uploader.ts`|`createS3Uploader`，业务侧上传门面|
|`core/s3-upload-engine.ts`|内部上传引擎，封装普通上传、分片上传、断点续传、远端终止、预签名读 URL|
|`core/upload-session-manager.ts`|管理 upload session 缓存、临近过期刷新和并发刷新合并|
|`core/multipart-runner.ts`|执行分片上传、并发控制、跳过已完成分片、合成对象|
|`core/checkpoint.ts`|创建和校验可持久化断点记录|
|`core/media-metadata.ts`|图片/视频元数据读取、视频首帧生成|
|`s3/client.ts`|根据上传配置和临时凭证 provider 创建 `S3Client`|
|`s3/upload-session.ts`|请求并校验业务后端 upload session|
|`s3/object-operations.ts`|`PutObject`、`HeadObject`、`GetObject` presigned URL|
|`s3/multipart-operations.ts`|S3 multipart 原语封装|
|`browser/checkpoint-store.ts`|localStorage 断点记录适配器|
|`browser/completed-upload-store.ts`|localStorage 本地秒传记录适配器|
|`src/hooks/use-s3-upload.ts`|React 薄封装，维护上传状态、结果、错误和取消能力|

## 后端 upload session 契约

应用默认入口已经内置 upload session API：

- `createAppS3Uploader()` 默认请求 `/api/s3-sts-token`。

- `useS3Upload()` 默认请求 `/api/s3-sts-token`。

- 底层 `createS3Uploader(options)` 仍然要求显式传入 `getUploadSession`，用于测试、Mock、特殊 endpoint 或更底层的编排场景。

如需覆盖默认接口地址，可以使用 `uploadSessionUrl`：

```TypeScript
import { createAppS3Uploader } from '@/libs/s3-upload';

const uploader = createAppS3Uploader({
  uploadSessionUrl: '/api/custom-s3-sts-token'
});
```

接口响应需要符合：

```TypeScript
interface S3UploadSession {
  // 必传：临时凭证。浏览器端不得使用长期 AccessKey。
  credentials: {
    // 必传：临时会话 Token。
    securityToken: string;
    // 必传：临时 AccessKeyId。
    accessKeyId: string;
    // 必传：临时 AccessKeySecret。
    accessKeySecret: string;
    // 必传：临时凭证过期时间，ISO 8601 字符串。
    expiresAt: string;
  };
  // 必传：本次上传目标配置。
  upload: {
    // 必传：目标 bucket。
    bucket: string;
    // 必传：目标 region。
    region: string;
    // 可选：S3-compatible endpoint；AWS S3 通常不传，OSS / MinIO 通常要传。
    endpoint?: string;
    // 必传：对象 key 前缀；要求非空字符串。
    basePath: string;
    // 可选：公开读域名或 CDN 域名；不传时上传结果不会包含 publicUrl。
    publicBaseUrl?: string;
    // 必传：是否使用 path-style；AWS S3 通常为 false，MinIO 等兼容服务可能为 true。
    forcePathStyle: boolean;
  };
}
```

字段说明：

|字段|说明|
|---|---|
|`credentials`|临时凭证。浏览器端不得使用长期 AccessKey|
|`expiresAt`|临时凭证过期时间；`s3-upload` 会在过期前主动刷新|
|`bucket` / `region`|目标对象存储 bucket 与 region|
|`endpoint`|S3\-compatible endpoint；AWS S3 通常可省略，OSS / MinIO 通常需要|
|`basePath`|对象 key 前缀，用于业务隔离|
|`publicBaseUrl`|公开读域名或 CDN 域名；没有时可生成 `signedUrl`|
|`forcePathStyle`|是否使用 path\-style 地址；MinIO / 部分兼容服务常需要|

`s3-upload` 会缓存 upload session，并在 `expiresAt` 前提前刷新。默认提前量为 5 分钟，可通过 `sessionRefreshSkewMs` 覆盖。刷新时如果后端返回的 `bucket`、`region`、`endpoint`、`basePath`、`publicBaseUrl` 或 `forcePathStyle` 与当前 uploader 已缓存配置不一致，会抛出 `invalid-config`，避免同一个上传任务中途切换目标存储。

## 快速接入：使用应用默认 `createAppS3Uploader`

适合在普通 TypeScript 逻辑、feature\-private hook 或更复杂的业务编排中使用。

```TypeScript
import {
  createAppS3Uploader
} from '@/libs/s3-upload';

const uploader = createAppS3Uploader({
  // 启用默认 localStorage adapter 时必传：用于隔离不同上传场景。
  namespace: 'community:post-attachment',

  // 可选：启用本机断点续传；默认不启用。
  checkpoint: true,

  // 可选：启用本地秒传记录复用；默认不启用。
  completedUpload: true,

  // 可选：分片策略覆盖；不传时使用下面这些默认值。
  multipart: {
    thresholdBytes: 10 * 1024 * 1024, // 默认 10 MiB，超过该大小启用 multipart。
    partSizeBytes: 5 * 1024 * 1024, // 默认 5 MiB，除最后一片外不能低于 S3 协议下限。
    concurrency: 10 // 默认 10，同时上传的分片数。
  },

  // 可选：预签名读 URL 有效期；默认 6 天，SigV4 最长 7 天。
  signUrlExpireTime: 6 * 24 * 60 * 60,

  // 可选：临时凭证过期前主动刷新提前量；默认 5 分钟。
  sessionRefreshSkewMs: 5 * 60 * 1000
});

try {
  // file 必传：浏览器 File 对象。
  // 第二个参数可选：单次上传控制项。
  const result = await uploader.upload(file, {
    // 可选：上传进度回调；不传则调用方不接收进度事件。
    onProgress: (progress) => {
      console.info('Upload progress:', progress.percent);
    },
    // 可选：外部取消信号；不传则不能从外部中止这次上传。
    // signal: controller.signal,
    // 可选：是否跳过本地秒传记录复用；默认 false。
    skipCompletedUpload: false
  });

  console.info('Uploaded object key:', result.key);
} finally {
  uploader.destroy();
}
```

注意：

- 单个 uploader 实例同一时间只允许一个 `upload` 或 `uploadMedia` 任务运行。

- 并发调用会抛出 `S3UploadError`，`code` 为 `busy`。

- 页面卸载或实例不再使用时调用 `destroy()`。

## 高级接入：直接使用 `createS3Uploader`

适合测试、Mock、特殊 upload session endpoint、服务端返回结构已被外层适配过，或需要完全自定义本地持久化 adapter 的场景。该底层入口要求显式传入 `getUploadSession`。

```TypeScript
import {
  createLocalStorageCheckpointStore,
  createLocalStorageCompletedUploadStore,
  createS3UploadSessionFetcher,
  createS3Uploader
} from '@/libs/s3-upload';

const namespace = 'community:post-attachment';

const uploader = createS3Uploader({
  getUploadSession: createS3UploadSessionFetcher('/api/s3-sts-token'),
  checkpointStore: createLocalStorageCheckpointStore({ namespace }),
  completedUploadStore: createLocalStorageCompletedUploadStore({ namespace })
});
```

## React 接入：使用 `useS3Upload`

适合组件只需要“上传一个文件并展示状态”的场景。

```TypeScript
import { useS3Upload } from '@/hooks';

export function PostAttachmentUploader() {
  const { status, progress, result, error, upload, abort } = useS3Upload({
    namespace: 'community:post-attachment',
    checkpoint: true,
    completedUpload: true
  });

  const handleFileChange = async (file: File) => {
    await upload(file, {
      // 可选：单次上传进度回调；hook 自身也会同步 progress state。
      onProgress: (nextProgress) => {
        console.info('Upload progress:', nextProgress.percent);
      },
      // 可选：默认 false；true 表示强制重新上传，不复用本地秒传记录。
      skipCompletedUpload: false
    });
  };

  return null;
}
```

`useS3Upload` 只维护：

- `status`

- `progress`

- `result`

- `error`

- `upload(file, options?)`

- `abort()`

这里的 `abort()` 只会停止当前浏览器请求，并让 hook 状态变为 `aborted`。对象存储里已经上传但还没合并的分片会保留，方便之后续传。若业务要彻底放弃这次分片上传并清理远端分片，需要拿到对应断点记录，再调用底层 `uploader.abort(checkpoint)`。

它不负责：

- 文件选择 UI。

- 日志列表。

- 复杂 localStorage adapter 自定义策略。

- 业务提交、审核、发布、表单状态。

- 本地秒传记录复用是否启用。

这些都应由具体 feature module 自己决定。

## API 速查

### `AppS3UploaderOptions`

`createAppS3Uploader(options)` 和 `useS3Upload(options)` 使用该配置。它会自动注入默认 upload session API。

```TypeScript
interface AppS3UploaderOptions {
  // 可选：覆盖默认 upload session API；默认 /api/s3-sts-token。
  uploadSessionUrl?: string;
  // 可选：高级场景覆盖默认 upload session 获取逻辑。
  getUploadSession?: () => Promise<S3UploadSession>;
  // 可选：启用默认 localStorage adapter 时必传。
  namespace?: string;
  // 可选：启用默认 checkpoint store；默认 false。
  checkpoint?: boolean;
  // 可选：启用默认本地秒传记录 store；默认 false。
  completedUpload?: boolean;
  // 可选：自定义 checkpoint store；传入后优先级高于 checkpoint。
  checkpointStore?: S3UploadCheckpointStore;
  // 可选：自定义本地秒传记录 store；传入后优先级高于 completedUpload。
  completedUploadStore?: S3UploadCompletedStore;
  // 可选：分片策略；不传则使用 shared lib 默认值。
  multipart?: S3UploaderMultipartOptions;
  // 可选：预签名读 URL 有效期，单位秒；默认 6 天。
  signUrlExpireTime?: number;
  // 可选：临时凭证过期前多久主动刷新，单位毫秒；默认 5 分钟。
  sessionRefreshSkewMs?: number;
}
```

### `S3UploaderOptions`

`createS3Uploader(options)` 使用该底层配置。普通业务优先使用 `createAppS3Uploader` 或 `useS3Upload`。

```TypeScript
interface S3UploaderOptions {
  // 必传：返回临时凭证和上传目标配置；无默认值。
  getUploadSession: () => Promise<S3UploadSession>;
  // 可选：分片策略；不传则使用 threshold=10 MiB、partSize=5 MiB、concurrency=10。
  multipart?: {
    // 可选：超过该字节数启用 multipart；默认 10 MiB。
    thresholdBytes?: number;
    // 可选：单个分片大小；默认 5 MiB。
    partSizeBytes?: number;
    // 可选：同时上传的分片数；默认 10。
    concurrency?: number;
  };
  // 可选：预签名读 URL 有效期，单位秒；默认 6 天，最长 7 天。
  signUrlExpireTime?: number;
  // 可选：临时凭证过期前多久主动刷新，单位毫秒；默认 5 分钟。
  sessionRefreshSkewMs?: number;
  // 可选：启用断点续传持久化；不传则不保存 checkpoint。
  checkpointStore?: S3UploadCheckpointStore;
  // 可选：启用本地秒传记录复用；默认不启用。
  completedUploadStore?: S3UploadCompletedStore;
}
```

默认值：

|选项|默认值|
|---|---|
|`multipart.thresholdBytes`|`10 MiB`|
|`multipart.partSizeBytes`|`5 MiB`|
|`multipart.concurrency`|`10`|
|`signUrlExpireTime`|`6 days`|
|`sessionRefreshSkewMs`|`5 minutes`|

S3 multipart 协议约束：

- 除最后一个分片外，每个 part 至少 `5 MiB`。

- 单个 multipart upload 最多 `10,000` 个 parts。

- presigned URL 使用 SigV4 时最长有效期为 `7 days`，当前实现会截断到协议上限。

### `S3Uploader`

```TypeScript
interface S3Uploader {
  upload(file: File, options?: S3UploadOptions): Promise<S3UploadResult>;
  uploadMedia(file: File, options?: S3MediaUploadOptions): Promise<S3MediaUploadResult>;
  abort(checkpoint: S3UploadCheckpoint): Promise<void>;
  createPresignedReadUrl(key: string): Promise<string>;
  destroy(): void;
}
```

方法说明：

|方法|场景|
|---|---|
|`upload`|上传任意文件，自动选择普通上传、分片上传、断点续传或本地秒传记录复用|
|`uploadMedia`|上传图片或视频，并返回分辨率；视频默认额外上传首帧|
|`abort`|终止远端 multipart upload，清理远端已上传 parts|
|`createPresignedReadUrl`|为已上传对象生成临时读取地址|
|`destroy`|释放底层 `S3Client`|

### `S3UploadOptions`

```TypeScript
interface S3UploadOptions {
  // 可选：外部取消信号；不传则本次调用不接受外部 abort。
  signal?: AbortSignal;
  // 可选：上传进度回调；不传则不接收进度事件。
  onProgress?: (progress: S3UploadProgress) => void;
  // 可选：是否跳过本地秒传记录复用；默认 false。
  skipCompletedUpload?: boolean;
}
```

字段说明：

|字段|说明|
|---|---|
|`signal`|触发后暂停当前浏览器请求；multipart 已上传 parts 会保留，checkpoint 可用于续传|
|`onProgress`|上传进度回调|
|`skipCompletedUpload`|跳过本地秒传记录复用，强制重新上传|

### `S3UploadProgress`

```TypeScript
interface S3UploadProgress {
  // 必传：当前上传阶段，用于区分准备中、上传中、合并中和已完成。
  phase: 'preparing' | 'uploading' | 'completing' | 'done';
  // 必传：当前上传模式，用于区分普通上传、分片上传、断点续传和本地秒传记录复用。
  mode: 'simple' | 'multipart' | 'resume' | 'local';
  // 必传：本次上传对应的对象 key。
  key: string;
  // 必传：展示用百分比，范围 0-100。
  percent: number;
  // 必传：已上传字节数。
  uploadedBytes: number;
  // 必传：文件总字节数。
  totalBytes: number;
  // 可选：已完成分片数；仅分片上传或断点续传时存在。
  completedParts?: number;
  // 可选：总分片数；仅分片上传或断点续传时存在。
  totalParts?: number;
}
```

`simple` 上传无法获得浏览器原生逐字节进度，当前只派发开始和完成进度。需要更细的 simple upload UI 时，由业务 UI 自己做模拟进度。

### `S3UploadResult`

```TypeScript
interface S3UploadResult {
  // 必传：实际完成上传的模式。
  mode: 'simple' | 'multipart' | 'resume' | 'local';
  // 必传：目标 bucket。
  bucket: string;
  // 必传：目标 region。
  region: string;
  // 必传：上传完成后的对象 key。
  key: string;
  // 可选：分片上传任务 ID；普通上传和本地秒传记录复用没有该字段。
  uploadId?: string;
  // 可选：对象存储返回的 ETag。
  eTag?: string;
  // 可选：对象存储返回的 Location；不同 S3-compatible 服务可能为空。
  location?: string;
  // 可选：基于 publicBaseUrl 拼出的公开读地址；没有 publicBaseUrl 时不存在。
  publicUrl?: string;
  // 可选：预签名临时读地址；没有 publicUrl 时可按需生成。
  signedUrl?: string;
  // 可选：媒体元数据；仅 `uploadMedia(file)` 结果包含。
  media?: S3UploadMediaMetadata;
  // 必传：上传耗时，单位毫秒。
  durationMs: number;
}
```

`mode` 说明：

|mode|含义|
|---|---|
|`simple`|走 `PutObject` 普通上传|
|`multipart`|新建 multipart upload 并完成|
|`resume`|基于 checkpoint 恢复 multipart upload|
|`local`|命中本地秒传记录，经远端校验后复用|

### `S3UploadError`

所有未知异常会归一化为：

```TypeScript
type S3UploadErrorCode =
  // 用户或外部 AbortSignal 中止了当前浏览器请求。
  | 'aborted'
  // 同一个 uploader 实例已有上传任务在运行，本次调用被拒绝。
  | 'busy'
  // 上传会话、分片参数或本地记录等配置不合法。
  | 'invalid-config'
  // 预留给网络类错误；业务 UI 可以按“稍后重试”处理。
  | 'network'
  // 未知错误；兜底展示通用失败提示，并保留日志排查。
  | 'unknown';
```

业务 UI 应使用 `error.code` 做状态判断，不要依赖错误文案。

## 内部上传判断流程

`createAppS3Uploader().upload(file)` 与底层 `createS3Uploader().upload(file)` 的内部优先级一致：先尝试本地秒传记录复用，再尝试断点记录续传，最后才进入新上传。也就是说，本地秒传记录复用优先级高于断点续传：如果远端对象已经完成且本地秒传记录校验通过，就没有必要继续使用旧断点。

```mermaid
flowchart TD
  A["开始上传文件"] --> B{"是否强制重新上传"}
  B -->|否| C["查找本地秒传记录"]
  C --> D{"记录可复用"}
  D -->|是| E["清理旧断点并直接返回"]
  B -->|是| F["查找断点记录"]
  D -->|否| F
  F --> G{"有可用断点"}
  G -->|是| H["校验是否同一个文件"]
  H --> I["查询远端已传分片"]
  I --> J["只上传缺失分片"]
  G -->|否| K{"文件是否超过分片阈值"}
  K -->|否| L["普通上传"]
  K -->|是| M["创建分片上传任务"]
  M --> N["上传分片并持续保存断点"]
  N --> O["合并所有分片"]
  J --> O
  L --> P["清理断点记录"]
  O --> P
  P --> Q{"是否启用本地秒传记录"}
  Q -->|是| R["保存本地秒传记录"]
  Q -->|否| S["返回上传结果"]
  R --> S```

关键点：

- 不传本地秒传记录适配器时，不会发生本地秒传判断。

- 单次上传设置 `skipCompletedUpload: true` 会跳过本地秒传记录，适合强制重新上传。

- 断点记录只在分片上传场景有意义；普通上传不会产生 `UploadId`，因此不能断点续传。

- 命中本地秒传记录后会移除旧断点，避免已经完成的对象仍被旧断点误导。

- 上传成功后，只有传入本地秒传记录适配器才会保存可复用记录。

`uploadMedia(file)` 会在这个流程外多一层媒体处理：先尝试复用带媒体元数据的本地秒传记录；未命中时先读取图片/视频分辨率，视频默认生成首帧文件；原始媒体文件走上面的同一套上传流程，原始文件上传成功后再上传首帧文件，并把分辨率和首帧信息合并进结果。

## 断点续传

当前实现支持“同设备、同浏览器、同 origin”的断点续传。

流程：

```mermaid
flowchart TD
  A["用户选择文件"] --> B{"本地是否有断点记录"}
  B -->|否| C["创建新的分片上传任务"]
  C --> D["保存上传任务和分片配置"]
  B -->|是| E["校验是否同一个文件"]
  E --> F["查询远端已传分片"]
  F --> G["跳过已上传分片"]
  D --> H["上传缺失分片"]
  G --> H
  H --> I["合并所有分片"]
  I --> J["删除断点记录"]```

localStorage 断点记录 key 使用：

```Plaintext
s3-upload:checkpoint:{namespace}:{file.name}:{file.size}:{file.lastModified}
```

断点记录内容包含：

- `version`

- `key`

- `uploadId`

- `partSize`

- `file.name`

- `file.size`

- `file.lastModified`

- `file.type`

- `updatedAt`

重要边界：

- `AbortSignal` 是“暂停”：中止当前浏览器请求，保留远端已上传分片和本地断点记录。

- `uploader.abort(checkpoint)` 是“终止”：传入断点记录后会调用远端终止接口，已上传但未合并的分片会被对象存储清理。

- 恢复前会查询远端已上传分片来校准状态，避免只相信本地断点记录。

## 本地秒传记录复用

当前实现支持本地秒传记录复用，不是全局内容秒传。

启用方式：

```TypeScript
import { createAppS3Uploader } from '@/libs/s3-upload';

const uploader = createAppS3Uploader({
  // 启用默认 localStorage adapter 时必传，用于隔离不同上传场景。
  namespace: 'community:post-attachment',
  // 显式开启后才启用本地秒传记录复用；默认不启用。
  completedUpload: true
});
```

命中流程：

1. 从 localStorage 读取当前文件对应的本地秒传记录。

2. 获取当前 upload session。

3. 校验记录里的 `bucket`、`region` 是否与当前 session 一致。

4. 使用 `HeadObject` 校验远端对象大小是否与当前 File 一致。

5. 校验通过后返回 `mode: 'local'` 的 `S3UploadResult`。

localStorage 本地秒传记录 key 使用：

```Plaintext
s3-upload:completed:{namespace}:{file.name}:{file.size}:{file.lastModified}
```

为什么它不是全局秒传：

- `file.name + size + lastModified` 不是内容 hash。

- 记录只存在当前浏览器 localStorage。

- `HeadObject` 只能确认对象存在和大小匹配，不能证明当前业务一定允许复用。

- 跨设备没有这份本地记录。

需要强一致、跨设备、跨浏览器复用时，应由后端提供基于 `fileHash + size + user/org + businessScope` 的复用接口。

## 跨设备续传和强一致复用

结论：如果要跨设备，**业务后端必须介入**，或者至少要有一个共享可信的服务端状态层。

S3 能保存 multipart upload 的远端 parts，但新设备不知道：

- 当前业务文件对应哪个 `bucket` / `key` / `uploadId`。

- 当时使用的 `partSize` 和分片算法。

- 哪些 parts 属于当前用户和当前业务对象。

- 该用户是否仍有权限继续上传或复用对象。

- 上传完成后应绑定到哪个业务资源。

后端接口初步设想（如需要业务后端介入，应实际跟后端进行约定）：

|接口|作用|
|---|---|
|`POST /uploads/init`|创建或恢复上传任务；也可以在 `fileHash` 命中且权限允许时直接返回可复用对象|
|`POST /uploads/:id/complete`|前端完成对象合并后，后端校验对象状态并绑定业务对象|
|`POST /uploads/:id/abort`|终止远端 multipart upload，并清理服务端状态|

演进模型：

```mermaid
flowchart LR
  A["当前版本"] --> B["浏览器本地断点"]
  B --> C["后端保存上传会话"]
  C --> D["跨浏览器续传"]
  C --> E["跨设备续传"]
  C --> F["后端文件指纹复用"]```

## `publicBaseUrl` 与 `signedUrl`

两者都是“读对象”的地址方案，和上传本身不是一回事。

`publicBaseUrl` 是后端 upload session 返回的公开读域名或 CDN 域名。代码会用它拼出 `publicUrl`：

```TypeScript
publicBaseUrl = 'https://cdn.example.com/community-upload';
key = 'posts/2026/06/18/a.png';
publicUrl = 'https://cdn.example.com/community-upload/posts/2026/06/18/a.png';
```

适合：

- 对象本身允许公开读取。

- CDN 已具备源站读取权限。

- **业务需要长期稳定 URL**。

`signedUrl` 是通过 `GetObjectCommand` 生成的预签名临时读地址。

适合：

- bucket 或 object 是私有的。

- 前端只需要**临时预览或下载**。

- 不希望公开长期可访问 URL。

区别：

|维度|`publicUrl`|`signedUrl`|
|---|---|---|
|来源|`publicBaseUrl + key` 拼接|S3 SigV4 签名生成|
|有效期|**通常长期有效**|**会过期**|
|权限模型|依赖公开读或 CDN 权限|依赖签名和过期时间|
|是否适合入库|可以，前提是业务允许公开 URL|不适合长期入库|
|当前优先级|有 `publicUrl` 时优先使用|没有 `publicUrl` 时补充|

当前生成时机：

- `upload(file)` 上传完成后只会尝试生成 `publicUrl`：如果 upload session 返回了 `publicBaseUrl`，结果里会有 `publicUrl`；如果没有，就只返回 `bucket`、`region`、`key` 等稳定对象信息，不会自动生成 `signedUrl`。

- 普通文件需要临时读取地址时，调用方可以用 `uploader.createPresignedReadUrl(result.key)` 按需生成。

- `uploadMedia(file)` 会调用内部 `ensureReadUrl`，保证媒体上传结果里有一个可直接预览的读取地址。它的规则很简单：如果结果里已经有 `publicUrl` 或 `signedUrl`，就直接返回；如果两个都没有，就用 `result.key` 生成 `signedUrl` 并补到结果里。

- `ensureReadUrl` 的作用是让图片/视频上传结果可直接用于预览，同时避免在已经有长期公开地址时重复生成临时签名地址。

建议：

- 业务库长期保存 `bucket`、`region`、`key` 和必要的 media metadata。

- 不要把 `signedUrl` 当成长期业务 URL 保存。

- 私有资源展示时，由后端或当前 uploader 按需重新生成读取 URL。

## 媒体上传

`uploadMedia(file, options?)` 用于“业务需要媒体元数据”的图片/视频上传。它不是 `upload(file)` 的替代品；普通附件、压缩包、文档等不需要分辨率或封面信息的文件，继续使用 `upload(file)`。

典型场景：

|场景|为什么用 `uploadMedia`|
|---|---|
|帖子图片发布|上传后立即得到 `width` / `height`，用于瀑布流、图片比例占位、裁剪预览|
|视频发布|上传后得到视频分辨率，便于播放器比例、清晰度展示和业务入库|
|视频封面|默认生成并上传视频首帧，可作为 feed 卡片、详情页或播放器封面|
|媒体审核前置数据|业务后端可保存尺寸、首帧对象 key，供后续审核、转码或展示流程使用|

支持范围：

- 图片：`image/*` MIME，或 `avif`、`bmp`、`gif`、`jpg`、`jpeg`、`png`、`webp` 后缀。

- 视频：`video/*` MIME，或 `m4v`、`mov`、`mp4`、`mpeg`、`mpg`、`ogv`、`qt`、`webm` 后缀。

基础调用：

```TypeScript
// file 必传：图片或视频 File。
// 第二个参数可选：继承 S3UploadOptions，并额外支持视频首帧配置。
const result = await uploader.uploadMedia(file, {
  // 可选：上传原始媒体文件的进度回调；不传则不接收进度事件。
  onProgress: (progress) => {
    console.info('Media upload progress:', progress.percent);
  },
  // 可选：视频是否额外上传首帧；默认 true。
  uploadVideoFirstFrame: true,
  // 可选：视频截帧时间，单位秒；默认 0.1。
  videoFirstFrameTime: 0.1,
  // 可选：首帧输出类型；默认 image/jpeg。
  videoFirstFrameType: 'image/jpeg',
  // 可选：JPEG/WebP 压缩质量，范围 0-1；默认 0.92。
  videoFirstFrameQuality: 0.92
});

console.info(result.media.resolution.width, result.media.resolution.height);
console.info(result.media.firstFrame?.url);
```

返回结构：

```TypeScript
interface S3MediaUploadResult extends S3UploadResult {
  media: {
    type: 'image' | 'video';
    resolution: {
      width: number;
      height: number;
    };
    firstFrame?: {
      bucket: string;
      region: string;
      key: string;
      eTag?: string;
      publicUrl?: string;
      signedUrl?: string;
      url?: string;
      urlKind?: 'public' | 'signed';
    };
  };
}
```

视频首帧选项：

|选项|默认值|说明|
|---|---|---|
|`uploadVideoFirstFrame`|`true`|是否额外上传视频首帧；设为 `false` 时只返回视频分辨率|
|`videoFirstFrameTime`|`0.1`|截帧时间，单位秒；默认避开部分浏览器在 0 秒处绘制黑帧的问题|
|`videoFirstFrameName`|自动推导|首帧文件名；未传时使用 `{videoName}-first-frame.{ext}`|
|`videoFirstFrameType`|`image/jpeg`|支持 `image/jpeg`、`image/png`、`image/webp`|
|`videoFirstFrameQuality`|`0.92`|JPEG/WebP 压缩质量，范围 `0-1`|

不需要上传首帧时：

```TypeScript
const result = await uploader.uploadMedia(file, {
  // 可选：默认 true；设为 false 时只返回视频分辨率，不额外上传首帧。
  uploadVideoFirstFrame: false
});
```

建议业务入库的数据：

```TypeScript
const mediaPayload = {
  bucket: result.bucket,
  region: result.region,
  key: result.key,
  mediaType: result.media.type,
  width: result.media.resolution.width,
  height: result.media.resolution.height,
  firstFrame: result.media.firstFrame
    ? {
        bucket: result.media.firstFrame.bucket,
        region: result.media.firstFrame.region,
        key: result.media.firstFrame.key,
        publicUrl: result.media.firstFrame.publicUrl
      }
    : null
};
```

入库建议：

- 长期保存 `bucket`、`region`、`key`、`media.type`、`media.resolution`。

- 视频首帧也优先保存 `bucket`、`region`、`key`。

- `publicUrl` 只有在业务确认资源可公开或走 CDN 时才适合保存。

- `signedUrl` 会过期，不要作为长期业务字段保存。

注意：

- `upload(file)` 不会解析媒体元数据。

- `uploadMedia(file)` 会先读取媒体元数据，再上传原始文件；视频首帧文件会在原始视频上传成功后额外上传。

- `onProgress` 反映原始媒体文件上传进度；视频首帧上传不透传进度，避免 UI 百分比被小文件二次上传扰动。

- `completedUploadStore` 命中媒体上传记录时，会复用之前保存的 `media` 元数据和首帧对象信息。

- `uploadMedia(file)` 依赖浏览器解码能力；不支持的图片/视频编码会抛出 `S3UploadError`。

- 视频首帧是从本地 `File` 创建 object URL 后用 `<video>` \+ `<canvas>` 生成的图片文件，不经过后端转码。

- 如果没有 `publicBaseUrl`，首帧读取地址会是 `signedUrl`，会过期。

## 使用场景

|场景|建议|
|---|---|
|普通 TypeScript 逻辑上传|`createAppS3Uploader().upload(file)`|
|React 组件单文件上传|`useS3Upload()`|
|大文件需要断点续传上传|`createAppS3Uploader({ namespace, checkpoint: true })` 或 `useS3Upload({ namespace, checkpoint: true })`|
|本机重复选择同一文件时复用结果（秒传）|显式开启 `completedUpload: true` 或传入 `completedUploadStore`|
|完全自定义 upload session 获取逻辑|`createS3Uploader({ getUploadSession })`|
|图片/视频发布需要分辨率|`uploader.uploadMedia(file)`|
|视频发布需要首帧|`uploader.uploadMedia(file)` 默认开启|
|私有资源临时预览|使用 `createPresignedReadUrl(key)`|
|跨设备续传/强一致复用|需要后端 upload session / hash 复用接口|

## 安全与运维

- 浏览器端只能使用临时凭证，不允许写死长期 AccessKey。

- 临时凭证权限应限制 bucket、prefix、操作类型和有效期。

- 后端 upload session 必须返回 `credentials.expiresAt`；前端会据此提前刷新临时凭证，避免长时间上传过程中凭证过期。

- bucket / OSS 需要配置正确 CORS，允许浏览器调用 `PUT`、multipart 相关请求、`HEAD` 和必要 headers。

- 对未完成 multipart upload 配置生命周期清理，避免长期占用存储费用。

- 本地秒传记录复用默认关闭，只有业务明确接受本地复用时才开启 `completedUpload: true` 或传入 `completedUploadStore`。

- localStorage namespace 必须按业务场景隔离，例如 `community:post-attachment`。

- 强业务权限、审核状态、配额、内容 hash 秒传都应由后端裁决。

## FAQ

### 取消上传后为什么还能续传？

`AbortSignal` 只中止当前浏览器请求，不会调用 `AbortMultipartUpload`。已上传到对象存储的 parts 仍保留，本地 checkpoint 也会保留，因此用户重新选择同一文件后可以续传。

### 什么时候会真正清理远端 parts？

调用 `uploader.abort(checkpoint)` 时会终止远端 multipart upload。对象存储侧也建议配置生命周期规则清理长期未完成的 multipart upload。

### 临时凭证过期时会怎样？

`s3-upload` 会缓存后端返回的 upload session，并根据 `credentials.expiresAt` 在过期前主动刷新。默认提前量是 5 分钟，可通过 `sessionRefreshSkewMs` 覆盖。刷新请求会做 single\-flight 合并，避免多个并发分片同时触发多次 session 请求。

刷新后的目标存储配置必须与当前 uploader 已缓存配置一致。如果后端返回了不同的 `bucket`、`region`、`endpoint`、`basePath`、`publicBaseUrl` 或 `forcePathStyle`，当前 uploader 会抛出 `invalid-config`，调用方应重新创建 uploader 后再上传。

### 为什么 localStorage adapter 必须传 `namespace`？

`namespace` 用来隔离不同业务上传场景的本地记录。断点记录和本地秒传记录都是按 `namespace + file.name + file.size + file.lastModified` 写入 `localStorage`；如果不同业务共用同一个 namespace，重复选择同一文件时就可能读到别的业务留下的记录。

例如帖子附件可以使用 `community:post-attachment`，用户头像可以使用 `community:user-avatar`。即使用户在两个地方选择了同一个 `a.png`，它们也会写入不同 key：

```Plaintext
s3-upload:checkpoint:community:post-attachment:a.png:12345:1710000000000
s3-upload:checkpoint:community:user-avatar:a.png:12345:1710000000000
```

这样头像上传不会误用帖子附件的断点记录或本地秒传记录，帖子附件也不会误用头像上传结果。

### 为什么断点记录持久化和本地秒传记录复用都默认不启用？

`checkpointStore` 和 `completedUploadStore` 都属于本地持久化能力：它们会把上传状态写入当前 origin 的 `localStorage`，并依赖业务传入 namespace 做场景隔离。`s3-upload` 默认不启用，是为了避免在所有业务场景里产生隐式本地存储副作用，也避免让调用方误以为这些能力天然支持跨浏览器、跨设备。

`checkpointStore` 解决的是刷新页面后继续上传同一个 multipart upload。它需要保存 `uploadId`、`key`、分片大小、已完成分片等信息；这些信息只对当前用户、当前业务场景、当前对象前缀和当前临时凭证策略有意义。如果业务没有显式开启 `checkpoint: true` 或传入 `checkpointStore`，lib 就只负责当前运行期间的上传，不会默认保存断点。

本地秒传记录复用解决的是本机重复选择同一文件时复用已完成结果。它只是一个同浏览器、同业务 namespace 下的体验优化，不是严格的全局内容去重。

当前本地记录使用 `file.name + file.size + file.lastModified` 识别文件，而 `lastModified` 是浏览器暴露的文件最后修改时间，不是内容 hash；文件名、大小和修改时间相同，并不能证明两个文件内容一定相同。记录也保存在当前 origin 的 `localStorage`，它不会天然跨浏览器、跨设备共享。

命中记录后，lib 会再用 `HeadObject` 检查远端对象是否存在、大小是否一致，但 `HeadObject` 主要返回对象元数据；即使 size 一致，也不能证明内容完全一致，更不能证明当前用户、当前业务资源、审核状态、配额和生命周期仍然允许复用这个对象。S3 的 ETag 也不能被简单当作统一内容 MD5，尤其 multipart upload 或部分加密场景下并不是完整对象 MD5。

所以默认关闭是为了避免把“不够强的本地推断”变成所有业务的隐式策略。只有业务明确接受这种本地复用语义时，才开启 `completedUpload: true` 或传入 `completedUploadStore`；如果要做强一致、跨设备、跨浏览器的秒传，应由后端基于 `fileHash + size + user/org + businessScope + permission` 提供可信复用接口。

### 为什么不直接把 `signedUrl` 存到业务库？

它会过期。业务库应保存稳定对象标识：`bucket`、`region`、`key`。需要展示时再生成读取 URL。

### 为什么 simple upload 没有细粒度进度？

当前 `PutObject` 封装**没有浏览器逐字节进度事件**。UI 如果需要更顺滑的体验，可以在 feature module 内做模拟进度，但不要伪造成真实网络进度写进 `s3-upload`。

## 参考资料

- AWS S3 multipart upload overview: https://docs\.aws\.amazon\.com/AmazonS3/latest/userguide/mpuoverview\.html

- AWS S3 `CompleteMultipartUpload`: https://docs\.aws\.amazon\.com/AmazonS3/latest/API/API\_CompleteMultipartUpload\.html

- AWS S3 `ListParts`: https://docs\.aws\.amazon\.com/AmazonS3/latest/API/API\_ListParts\.html

- AWS S3 `ListMultipartUploads`: https://docs\.aws\.amazon\.com/AmazonS3/latest/API/API\_ListMultipartUploads\.html

- AWS SDK for JavaScript v3 S3 migration notes: https://docs\.aws\.amazon\.com/sdk\-for\-javascript/v3/developer\-guide/migrate\-s3\.html

- AWS SDK for JavaScript v3 client credentials provider: https://github\.com/aws/aws\-sdk\-js\-v3/blob/main/supplemental\-docs/CLIENTS\.md

- AWS SDK for JavaScript v3 presigned URL example: https://docs\.aws\.amazon\.com/sdk\-for\-javascript/v3/developer\-guide/javascript\_s3\_code\_examples\.html

- Alibaba Cloud OSS: use AWS SDKs to access OSS: https://help\.aliyun\.com/zh/oss/developer\-reference/use\-aws\-sdks\-to\-access\-oss

- Alibaba Cloud OSS Browser\.js initialization and STS refresh: https://www\.alibabacloud\.com/help/en/oss/developer\-reference/initialization

- MDN `localStorage`: https://developer\.mozilla\.org/en\-US/docs/Web/API/Window/localStorage

- MDN `File.lastModified`: https://developer\.mozilla\.org/en\-US/docs/Web/API/File/lastModified

- AWS S3 `HeadObject`: https://docs\.aws\.amazon\.com/AmazonS3/latest/API/API\_HeadObject\.html

- AWS S3 checking object integrity for data uploads: https://docs\.aws\.amazon\.com/AmazonS3/latest/userguide/checking\-object\-integrity\-upload\.html

