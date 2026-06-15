

 [适用于 JavaScript 的 AWS SDK V3 API 参考指南](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)详细描述了 适用于 JavaScript 的 AWS SDK 版本 3 (V3) 的所有 API 操作。

本文属于机器翻译版本。若本译文内容与英语原文存在差异，则一律以英文原文为准。

# 创建和调用服务对象。
<a name="creating-and-calling-service-objects"></a>

 JavaScript API 支持大多数可用 AWS 服务。 JavaScriptAPI 中的每项服务都为客户端类提供了一个`send`方法，您可以使用该方法来调用该服务支持的每个 API。有关 JavaScript API 中的服务类、操作和参数的更多信息，请参阅 [API 参考](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-client-transcribe/)。

在 Node.js 中使用 SDK 时，您使用 `import` 将每个所需服务的 SDK 添加到应用程序，这为所有当前服务提供支持。以下示例在 `us-west-1` 区域中创建一个 Amazon S3 服务对象。

```
// Import the Amazon S3 service client
import { S3Client } from "@aws-sdk/client-s3"; 
// Create an S3 client in the us-west-1 Region
const s3Client = new S3Client({
    region: "us-west-1"
});
```

## 指定服务对象参数
<a name="specifying-service-object-parameters"></a>

调用服务对象的方法时，根据 API 的需要在 JSON 中传递参数。例如，在 Amazon S3 中，要获取指定存储桶和键的对象，需向 `S3Client` 的 `GetObjectCommand` 方法传递以下参数。有关传递 JSON 参数的更多信息，请参阅[使用 JSON](working-with-json.md)。

```
s3Client.send(new GetObjectCommand({Bucket: 'bucketName', Key: 'keyName'}));
```

有关 Amazon S3 参数的更多信息，请参阅 API 参考中的 [@aws-sdk/client-s3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-client-s3/)。

## 对生成的客户端使用 @smithy /types TypeScript
<a name="smithy-types"></a>

如果您正在使用 TypeScript，则该`@smithy/types`软件包允许您操作客户端的输入和输出形状。

### 场景：从输入和输出结构中移除 `undefined`
<a name="remove-undefined-from-input"></a>

生成的数据形状的成员在输入形状中与 `undefined` 合并，在输出形状中标记为 `?`（可选）。对于输入，这会将验证操作推迟到服务端进行。对于输出，强烈建议您在运行时检查输出数据。

如需跳过这些步骤，请使用 `AssertiveClient` 或 `UncheckedClient` 类型帮助程序。以下示例展示了在 Amazon S3 服务中使用类型帮助程序的方法。

```
import { S3 } from "@aws-sdk/client-s3";
import type { AssertiveClient, UncheckedClient } from "@smithy/types";

const s3a = new S3({}) as AssertiveClient<S3>;
const s3b = new S3({}) as UncheckedClient<S3>;

// AssertiveClient enforces required inputs are not undefined
// and required outputs are not undefined.
const get = await s3a.getObject({
  Bucket: "",
  // @ts-expect-error (undefined not assignable to string)
  Key: undefined,
});

// UncheckedClient makes output fields non-nullable.
// You should still perform type checks as you deem
// necessary, but the SDK will no longer prompt you
// with nullability errors.
const body = await (
  await s3b.getObject({
    Bucket: "",
    Key: "",
  })
).Body.transformToString();
```

在非聚合客户端使用 `Command` 语法进行转换时，无法对输入进行验证，因为它需要经过另一个类，如下例所示。

```
import { S3Client, ListBucketsCommand, GetObjectCommand, GetObjectCommandInput } from "@aws-sdk/client-s3";
import type { AssertiveClient, UncheckedClient, NoUndefined } from "@smithy/types";

const s3 = new S3Client({}) as UncheckedClient<S3Client>;

const list = await s3.send(
  new ListBucketsCommand({
    // command inputs are not validated by the type transform.
    // because this is a separate class.
  })
);

/**
 * Although less ergonomic, you can use the NoUndefined<T>
 * transform on the input type.
 */
const getObjectInput: NoUndefined<GetObjectCommandInput> = {
  Bucket: "undefined",
  // @ts-expect-error (undefined not assignable to string)
  Key: undefined,
  // optional params can still be undefined.
  SSECustomerAlgorithm: undefined,
};

const get = s3.send(new GetObjectCommand(getObjectInput));

// outputs are still transformed.
await get.Body.TransformToString();
```

### 场景：缩小 Smithy TypeScript 生成的客户端的输出有效载荷 blob 类型
<a name="remove-undefined-from-input"></a>

这种场景主要与使用流媒体主体的操作有关，例如`S3Client`在 适用于 JavaScript 的 AWS SDK v3 中。

由于 blob 有效载荷类型取决于平台，您可能需要在应用程序中指明客户端正在特定环境中运行。这将缩小 blob 有效载荷类型的范围，如下例所示：

```
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { NodeJsClient, SdkStream, StreamingBlobPayloadOutputTypes } from "@smithy/types";
import type { IncomingMessage } from "node:http";

// default client init.
const s3Default = new S3Client({});

// client init with type narrowing.
const s3NarrowType = new S3Client({}) as NodeJsClient<S3Client>;

// The default type of blob payloads is a wide union type including multiple possible
// request handlers.
const body1: StreamingBlobPayloadOutputTypes = (await s3Default.send(new GetObjectCommand({ Key: "", Bucket: "" })))
  .Body!;

// This is of the narrower type SdkStream<IncomingMessage> representing
// blob payload responses using specifically the node:http request handler.
const body2: SdkStream<IncomingMessage> = (await s3NarrowType.send(new GetObjectCommand({ Key: "", Bucket: "" })))
  .Body!;
```
