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

## 秒传能不能只靠前端和 S3

不能。可靠的业务秒传需要业务后端参与。

这里要区分两个概念：

- **断点续传**：继续同一个未完成的 multipart 任务，核心标识是 `UploadId + Key`
- **秒传**：发现业务系统里已经存在同一个已完成文件，直接复用已有对象，不再上传内容

前端可以做的事情是计算文件指纹，比如整文件 hash 或首尾采样 hash，然后把指纹交给业务后端判断。S3 只能按 `Bucket + Key` 读写对象，不能按“文件内容 hash”查询已经存在的对象，也不能把 hash 自动映射回某个 `UploadId`。

所以秒传的可信判断应该在业务后端：

- 前端负责计算 `fileSize + hash/sampleHash`
- 后端按 `userId + fileSize + hash` 查询已经完成的对象记录
- 命中后，后端返回已有对象的 `key/publicUrl`，前端直接展示完成
- 未命中时，再创建或恢复 multipart 上传会话

如果只做前端 localStorage 秒传，也只能算“同浏览器本地缓存优化”：它不能跨设备，不能证明远端对象还存在，也不能作为业务可信结果。

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
- 前端使用 STS 临时凭证直连 S3，执行分片上传、查询进度、合成对象和终止任务
- 后端负责保存并返回跨设备恢复所必需的 `uploadId + key + partSize + 文件标识 + 会话状态`
- 新设备恢复时，前端重新选择本地文件，再由后端按“当前用户 + 文件标识 + 未完成状态”命中旧会话
- 命中旧会话后，前端自己调用 `ListPartsCommand` 校准远端真实分片状态
- 前端成功调用 `CompleteMultipartUploadCommand` 后，再回写业务会话状态；后端不代理合成对象，但要校验对象是否真的已完成

这里有一个必须明确的选择：

- **推荐方案**：后端在创建 `uploadSession` 时调用 `CreateMultipartUploadCommand`，拿到 `uploadId` 后返回给前端。这样业务侧只需要下面 2 个会话接口。
- **沿用当前 demo 方案**：`CreateMultipartUploadCommand` 也由前端调用。那就不能让“创建会话接口”直接返回新的 `uploadId`，需要先创建一条 `initializing` 会话并返回 `key + partSize`，前端创建 multipart 成功后，再把 `uploadId` 绑定回这条会话。

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
  "etag": null, // 上传完成后对象存储返回或 HeadObject 校验得到的 ETag，没有完成则为 null
  "publicUrl": null, // 上传完成后的公开访问地址，没有则为 null
  "updatedAt": "2026-06-17T10:00:00.000Z", // 最近一次状态更新时间
  "expiresAt": "2026-06-18T10:00:00.000Z" // 可选；超过该时间未更新则可标记 expired
}
```

说明：

- 这里默认**不要求计算整文件 hash**，避免在上传前先完整读取大文件，拖慢启动
- 最小文件标识建议使用：`fileName + fileSize + lastModified`
- `status` 建议至少包含：`uploading`、`completed`、`aborted`、`expired`

## 跨设备断点续传接口设计

在“前端直连 S3”的最小方案里，后端除了已有的 STS 临时凭证接口外，只需要新增 **2 个业务会话接口**。

以下接口默认都要求用户已登录，`userId` 从鉴权上下文中获取，不由前端显式传入。

下面的请求/响应先按“推荐方案：后端创建 multipart 任务”描述，因为这样接口最少、会话从一开始就有 `uploadId`。如果要完全沿用当前 demo 的前端 `CreateMultipartUploadCommand`，见本节末尾的变体说明。

前提：

- 前端已经能通过类似 `/api/s3-sts-token` 的接口获取短期有效、权限受限的 STS 凭证
- STS 权限应限制到当前用户允许写入的 bucket / key 前缀，并只开放上传所需的 S3 action
- 如果没有 STS 或预签名上传机制，仅靠下面 2 个业务接口是不够的
- 跨设备会话方案中，最终可信的 `bucket`、`key`、`uploadId`、`partSize` 都应来自服务端保存的 `uploadSession`

### 1. 创建或获取可续传会话

前端在真正上传前调用这个接口。服务端先尝试秒传，再根据“当前用户 + 文件标识 + 未完成状态”判断是否恢复旧会话：

- 如果已经存在可复用的已完成对象，则直接返回 `completed`
- 如果存在可继续的未完成会话，则直接返回旧会话
- 如果不存在，则创建新的 multipart 任务，并持久化 `uploadId + key + partSize`

这个接口既能用于“首次上传”，也能用于“秒传检查”和“新设备恢复时查找既有会话”。

服务端实现时要注意幂等和并发：同一用户、同一文件标识、同一未完成状态下，应通过唯一约束、事务或锁保证不会同时创建出多个 active multipart 任务。

**请求**

`POST /api/upload-sessions`

```jsonc
{
  "file": {
    "name": "demo.pdf", // 文件名
    "size": 52428800, // 文件大小，单位字节
    "lastModified": 1718600000000, // 浏览器 File.lastModified
    "type": "application/pdf", // 可选；MIME 类型
    "hash": "optional-full-file-sha256", // 可选；整文件 hash，用于可信秒传
    "sampleHash": "optional-sample-hash" // 可选；首尾采样 hash，用于降低续传误命中概率
  }
}
```

**响应：命中已完成对象（秒传）**

```jsonc
{
  "uploadSessionId": null, // 秒传不需要创建新的 multipart 会话
  "resume": false, // false 表示不是恢复未完成任务
  "status": "completed", // 已有对象可以直接复用
  "bucket": "example-bucket", // 已完成对象所在 bucket
  "key": "uploads/2026/06/17/existing-demo.pdf", // 已完成对象 Key
  "publicUrl": "https://cdn.example.com/uploads/2026/06/17/existing-demo.pdf" // 服务端根据 key 生成
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

- 秒传命中必须基于后端保存的已完成对象记录，不能只相信前端传来的 hash
- 如果要做可信秒传，建议使用整文件 hash；`sampleHash` 更适合辅助降低续传误命中概率，不适合单独作为最终秒传依据
- 如果请求没有提供整文件 hash，服务端可以直接跳过可信秒传检查，继续判断是否存在可续传会话
- 命中旧会话后，前端再自行调用 `ListPartsCommand` 查询远端已上传分片
- 仅做断点续传时不要求整文件 hash；是否命中旧会话，先基于 `fileName + fileSize + lastModified`
- 如果后续发现误命中概率不可接受，再考虑追加采样 hash，而不是一开始就算整文件 hash
- 当前单机 demo 中 `Key` 可以由前端生成；升级为服务端会话后，更推荐由服务端生成并持久化，或者由服务端严格校验前端传入的 `Key` 是否属于当前用户允许的前缀

### 2. 回写会话状态

由于 `CompleteMultipartUploadCommand` 和 `AbortMultipartUploadCommand` 由前端直接调用，所以前端在完成上传、取消上传或保活时，需要再调用一个轻量接口，把业务侧会话状态更新掉。

这个接口不是“让后端执行 complete”，而是“前端已经执行完 S3 操作后，通知后端更新业务会话”。因此后端不能完全信任前端传来的状态，尤其是 `completed`。

**请求**

`POST /api/upload-sessions/:uploadSessionId/status`

```jsonc
{
  "status": "completed", // uploading / completed / aborted；expired 建议只由服务端定时任务设置
  "etag": "\"complete-object-etag\"", // 可选；CompleteMultipartUploadCommand 返回的 ETag，仅作为提示，不能作为唯一可信依据
  "location": "https://example-bucket.s3.example.com/uploads/2026/06/17/uuid-demo.pdf", // 可选；S3 返回值，仅作为提示
  "reason": null // 可选；如果是 aborted，可补充原因；expired 建议由服务端内部记录
}
```

**响应**

```jsonc
{
  "ok": true, // 是否更新成功
  "uploadSessionId": "us_123456", // 当前会话 ID
  "status": "completed", // 更新后的会话状态
  "publicUrl": "https://cdn.example.com/uploads/2026/06/17/uuid-demo.pdf", // 服务端根据 session.key 生成的访问地址
  "updatedAt": "2026-06-17T10:10:00.000Z" // 状态更新时间
}
```

说明：

- 当前端成功调用 `CompleteMultipartUploadCommand` 后，应把状态回写为 `completed`
- 后端收到 `completed` 后，应按 `uploadSessionId + userId` 找到会话，再用会话里保存的 `bucket/key/fileSize` 校验对象是否真的存在并且大小匹配；校验失败时不要标记为 `completed`
- 当前端成功调用 `AbortMultipartUploadCommand` 后，应把状态回写为 `aborted`
- 当前端上传过程中可以定期回写 `uploading` 作为 heartbeat，只更新 `updatedAt`，避免大文件长时间上传被服务端误判过期
- 如果前端长时间未恢复，服务端也可以通过定时任务把会话改为 `expired`
- `publicUrl` 建议由服务端根据持久化的 `key` 生成，不要直接信任前端传入的 URL

### 如果沿用当前 demo 的前端 Create

当前代码里，`CreateMultipartUploadCommand`、`UploadPartCommand`、`ListPartsCommand`、`CompleteMultipartUploadCommand`、`AbortMultipartUploadCommand` 都在前端执行。若保持这个模式，流程要稍微改一下：

1. 前端先调用 `POST /api/upload-sessions`，只做“查找旧会话 / 创建 initializing 业务会话”。新会话响应里返回 `uploadSessionId + key + partSize`，但此时还没有 `uploadId`。
2. 前端用返回的 `key` 调用 `CreateMultipartUploadCommand`。
3. 前端再调用 `POST /api/upload-sessions/:uploadSessionId/status`，传 `status: "uploading"` 和本次创建得到的 `uploadId`，后端只允许在 `initializing -> uploading` 这一次绑定 `uploadId`。

这个变体可以继续使用同两个接口路径，但状态接口需要多承担一次“绑定 uploadId”的职责。好处是更贴近当前代码；代价是状态机比“后端创建 multipart 任务”复杂一点。

## 设计注意点

- 不要设计成 `fileHash -> UploadId` 一一映射，应设计成 `uploadSessionId -> UploadId`
- 秒传可以使用 `fileHash -> completedObject`，但这是业务后端的已完成对象索引，不是 S3 multipart 的任务索引
- 当前最小方案先基于 `当前用户 + fileName + fileSize + lastModified + status=uploading` 命中旧会话
- 如果后续发现仅靠这些字段误命中概率不可接受，再考虑增加采样 hash，而不是一开始就算整文件 hash
- 跨设备恢复前，必须重新选择本地文件；服务端只能保存远端任务状态，不能替你拿到用户设备上的文件内容
- 应有定时清理机制：长时间未更新的会话标记为 `expired`，必要时调用 `AbortMultipartUploadCommand` 回收远端未完成分片
- `CompleteMultipartUploadCommand` 需要提交完整的 `PartNumber + ETag` 列表，并按 `PartNumber` 升序排列；恢复时应先 `ListPartsCommand` 分页查询远端真实分片，再与本地 checkpoint 合并
- 分片数量和分片大小要受 S3 multipart 限制约束：除最后一片外分片不能太小，总分片数也不能超过对象存储允许的上限
- 如果同一文件标识下已经存在多个未完成会话，说明并发幂等没有兜住；应选择一个明确策略，例如返回最近更新的会话，并把其他会话标记为待清理，而不是随机返回
- 前端直连 S3 时，STS 凭证权限边界就是安全边界；不要给浏览器长期 AK/SK，也不要给超过上传所需范围的 bucket 权限

## 一句话

- **断点续传的本质是继续同一个 multipart 上传任务，不是重新上传同一个文件。**
- **`ListPartsCommand` 只能查询这个任务的远端进度，前提是你先保存好了它的 `UploadId` 和 `Key`。**
- **hash 只能辅助识别内容，不能替代 multipart 任务 ID。**
- **秒传不是查 S3 的 UploadId，而是查业务后端保存的已完成对象索引。**
