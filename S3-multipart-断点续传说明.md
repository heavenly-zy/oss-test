# S3 multipart 断点续传说明

```ts
const createResult = await client.send(
  new CreateMultipartUploadCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: file.type || 'application/octet-stream',
    Metadata: {
      originalName: encodeURIComponent(file.name),
    },
  }),
  { abortSignal: signal }
);

// 每次上传都视为新开一个上传任务，每次创建都是新的 UploadId
return createResult.UploadId;
```

```ts
const result = await client.send(
  new ListPartsCommand({
    Bucket: config.bucket,
    Key: key,
    // 必须提供 uploadId 按上传任务的 id 来查远端的上传进度
    // 要调用 ListPartsCommand 查分片进度就必须先知道 UploadId；UploadId 就必须存一个地方，要么存本地 localStorage、要么存业务服务器。
    UploadId: uploadId,
    PartNumberMarker: marker,
  })
);
```

## 结论

断点续传依赖的是**同一个 multipart 上传任务**，不是“同一个文件”。

- `UploadId` 标识这一次 multipart 任务
- `Key` 标识这一次要写到桶里的对象地址
- `ListPartsCommand` 只能查询**某个既有任务**已经上传了哪些分片

所以：要做断点续传，就必须先保存能重新定位到这次任务的断点信息。`localStorage` 可以满足同浏览器/同设备恢复；跨设备则需要业务服务器保存 checkpoint。

## UploadId 和 Key 分别是什么

### UploadId

`UploadId` 是对象存储在你调用 `CreateMultipartUploadCommand` 后，为这次 multipart 上传任务分配的任务 ID。

- 每新建一次分片上传任务，都会生成新的 `UploadId`
- 同一个文件重复上传，`UploadId` 也不会自动相同
- `ListPartsCommand`、`CompleteMultipartUploadCommand`、`AbortMultipartUploadCommand` 都是围绕这个任务 ID 工作的

### Key

`Key` 是对象存储里的对象路径/文件名，相当于最终要写入桶里的地址。

在这个项目里，`Key` 不是由文件内容决定的，而是前端生成的：

- `basePath/yyyy/mm/dd/randomUUID-safeFileName`
- 其中带日期和随机 UUID，所以同一个文件重新上传时，`Key` 通常也会变化

## 为什么不能只靠文件 hash

文件内容 hash 只能说明**内容可能相同**，不能说明**这是同一个上传任务**。

原因很简单：

- `UploadId` 不是我们定义的，而是对象存储在 `CreateMultipartUploadCommand` 时返回的服务端任务 ID
- 我们不能要求 S3 “同样的 hash 就返回同一个 UploadId”
- `ListPartsCommand` 也不是“按文件内容查”，而是“按 `Bucket + Key + UploadId` 查某个既有任务”

另外，同样内容也不等于同一个上传意图：

- 可能上传到不同 `Key`
- 可能上传到不同 bucket
- 可能带不同 metadata / 加密参数 / 存储参数
- 可能同时存在多个并发上传任务

## 为什么要存 checkpoint

要调用 `ListPartsCommand`，必须先知道：

- `UploadId`
- `Key`
- 以及恢复时需要的上下文，比如 `partSize`、文件标识、已知分片信息

因此需要把 checkpoint 存在某个地方：

- **localStorage**：适合同浏览器 / 同设备 / 同站点恢复
- **业务服务器**：适合跨设备恢复，或者需要统一管理上传任务

## 跨设备恢复如何设计

如果 `ListPartsCommand`、`CompleteMultipartUploadCommand`、`AbortMultipartUploadCommand` 继续由前端直连 S3 调用，那么跨设备恢复的重点就不是“后端代理分片操作”，而是**后端保存并找回上传会话**。

推荐做法是把“断点”升级成**服务端管理的上传会话**。

### 核心思路

- 业务服务器维护一条 `uploadSession`
- `uploadSessionId` 是业务侧主键
- `uploadId` 是对象存储侧 multipart 任务 ID
- 前端负责直连 S3 执行 `ListPartsCommand`、`CompleteMultipartUploadCommand`、`AbortMultipartUploadCommand`
- 后端负责保存并返回跨设备恢复所必需的 `uploadId + key + partSize + 文件标识 + 会话状态`
- 新设备恢复时，前端重新选择本地文件，再由后端按“当前用户 + 文件标识 + 未完成状态”命中旧会话
- 命中旧会话后，前端自己调用 `ListPartsCommand` 校准远端真实分片状态

### 服务端建议持久化的字段

```jsonc
{
  "uploadSessionId": "us_123456", // 业务侧上传会话 ID，前后端都用它标识这条会话
  "userId": "u_1001", // 当前登录用户 ID，从鉴权上下文获取
  "bucket": "example-bucket", // 目标 bucket
  "key": "uploads/2026/06/17/uuid-demo.pdf", // 这次上传最终写入对象存储的 Key
  "uploadId": "upload-id-from-s3", // S3 CreateMultipartUpload 返回的任务 ID
  "partSize": 5242880, // 当前会话固定使用的分片大小，恢复时必须保持一致
  "fileName": "demo.pdf", // 原始文件名
  "fileSize": 52428800, // 文件大小
  "fileType": "application/pdf", // MIME 类型，可选保存
  "lastModified": 1718600000000, // 浏览器 File.lastModified，用于辅助校验是否还是同一文件
  "status": "uploading", // 会话状态：uploading / completed / aborted / expired
  "publicUrl": null, // 上传完成后的公开访问地址，没有则为 null
  "updatedAt": "2026-06-17T10:00:00.000Z" // 最近一次状态更新时间
}
```

说明：

- 这里默认**不要求计算整文件 hash**，避免在上传前先完整读取大文件，拖慢启动
- 最小文件标识建议使用：`fileName + fileSize + lastModified`
- `status` 建议至少包含：`uploading`、`completed`、`aborted`、`expired`

## 跨设备断点续传接口设计

在“前端直连 S3”的最小方案里，后端只需要保留 **2 个接口**。

以下接口默认都要求用户已登录，`userId` 从鉴权上下文中获取，不由前端显式传入。

### 1. 创建或获取可续传会话

前端在真正上传前调用这个接口。服务端根据“当前用户 + 文件标识 + 未完成状态”判断：

- 如果存在可继续的未完成会话，则直接返回旧会话
- 如果不存在，则创建新的 multipart 任务，并持久化 `uploadId + key + partSize`

这个接口既能用于“首次上传”，也能用于“新设备恢复时查找既有会话”。

**请求**

`POST /api/upload-sessions`

```jsonc
{
  "file": {
    "name": "demo.pdf", // 文件名
    "size": 52428800, // 文件大小，单位字节
    "lastModified": 1718600000000, // 浏览器 File.lastModified
    "type": "application/pdf" // 可选；MIME 类型
  }
}
```

**响应：命中旧会话**

```jsonc
{
  "uploadSessionId": "us_123456", // 业务侧上传会话 ID
  "resume": true, // true 表示命中了可续传旧会话
  "bucket": "example-bucket", // 目标 bucket
  "key": "uploads/2026/06/17/uuid-demo.pdf", // 这次上传对应的对象 Key
  "uploadId": "upload-id-from-s3", // S3 multipart 任务 ID
  "partSize": 5242880, // 当前会话固定分片大小
  "status": "uploading" // 当前会话状态
}
```

**响应：创建新会话**

```jsonc
{
  "uploadSessionId": "us_789012", // 新创建的业务上传会话 ID
  "resume": false, // false 表示这是一次新建上传，不是恢复旧会话
  "bucket": "example-bucket", // 目标 bucket
  "key": "uploads/2026/06/17/new-uuid-demo.pdf", // 新生成的对象 Key
  "uploadId": "new-upload-id-from-s3", // 新创建 multipart 任务的 UploadId
  "partSize": 5242880, // 当前会话固定分片大小
  "status": "uploading" // 当前会话状态
}
```

说明：

- 命中旧会话后，前端再自行调用 `ListPartsCommand` 查询远端已上传分片
- 当前方案不要求整文件 hash；是否命中旧会话，先基于 `fileName + fileSize + lastModified`
- 如果后续发现误命中概率不可接受，再考虑追加采样 hash，而不是一开始就算整文件 hash

### 2. 回写会话状态

由于 `CompleteMultipartUploadCommand` 和 `AbortMultipartUploadCommand` 由前端直接调用，所以前端在完成上传或取消上传后，需要再调用一个轻量接口，把业务侧会话状态更新掉。

**请求**

`POST /api/upload-sessions/:uploadSessionId/status`

```jsonc
{
  "status": "completed", // uploading / completed / aborted / expired
  "publicUrl": "https://cdn.example.com/uploads/2026/06/17/uuid-demo.pdf", // 可选；上传完成后的访问地址
  "reason": null // 可选；如果是 aborted / expired，可补充原因
}
```

**响应**

```jsonc
{
  "ok": true, // 是否更新成功
  "uploadSessionId": "us_123456", // 当前会话 ID
  "status": "completed", // 更新后的会话状态
  "updatedAt": "2026-06-17T10:10:00.000Z" // 状态更新时间
}
```

说明：

- 当前端成功调用 `CompleteMultipartUploadCommand` 后，应把状态回写为 `completed`
- 当前端成功调用 `AbortMultipartUploadCommand` 后，应把状态回写为 `aborted`
- 如果前端长时间未恢复，服务端也可以通过定时任务把会话改为 `expired`

## 设计注意点

- 不要设计成 `fileHash -> UploadId` 一一映射，应设计成 `uploadSessionId -> UploadId`
- 当前最小方案先基于 `当前用户 + fileName + fileSize + lastModified + status=uploading` 命中旧会话
- 如果后续发现仅靠这些字段误命中概率不可接受，再考虑增加采样 hash，而不是一开始就算整文件 hash
- 跨设备恢复前，必须重新选择本地文件；服务端只能保存远端任务状态，不能替你拿到用户设备上的文件内容
- 应有定时清理机制：长时间未更新的会话标记为 `expired`，必要时调用 `AbortMultipartUploadCommand` 回收远端未完成分片

## 一句话

- **断点续传的本质是继续同一个 multipart 上传任务，不是重新上传同一个文件。**
- **`ListPartsCommand` 只能查询这个任务的远端进度，前提是你先保存好了它的 `UploadId` 和 `Key`。**
- **hash 只能辅助识别内容，不能替代 multipart 任务 ID。**