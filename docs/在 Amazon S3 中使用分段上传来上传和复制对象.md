

# 在 Amazon S3 中使用分段上传来上传和复制对象
<a name="mpuoverview"></a>

分段上传支持您将单个对象作为一组分段上传到 Amazon S3。每个分段都是对象数据的连续部分。您可以独立上传以及按任意顺序上传这些对象分段。对于上传，更新后的 AWS 客户端会自动计算对象的校验和，并将其连同对象的大小一起作为请求的一部分发送到 Amazon S3。如果任意分段传输失败，可以重新传输该分段且不会影响其它分段。上传完对象的所有分段后，Amazon S3 将汇集这些分段并创建对象。最佳做法是对 100 MB 或更大的对象使用分段上传，而不是在单个操作中上传它们。

使用分段上传可提供以下优势：
+ **提高吞吐量** – 您可以并行上传分段以提高吞吐量。
+ **从任何网络问题中快速恢复** – 较小的分段大小可以将由于网络错误而需重启失败的上传所产生的影响降至最低。
+ **暂停和恢复对象上传** – 您可以在一段时间内逐步上传对象分段。启动分段上传后，不存在过期期限；您必须显式地完成或停止分段上传。
+ **在您知道对象的最终大小前开始上传**：您可以在创建对象时将其上传。

我们建议您按以下方式使用分段上传：
+ 如果您在稳定的高带宽网络上传大型对象，请通过并行上传对象分段来实现多线程性能，从而使用分段上传以最大限度地利用您的可用带宽。
+ 如果您通过断点网络进行上传，请使用分段上传，通过避免重新开始上传来提高应对网络错误的复原能力。在使用分段上传时，只需重试上传在上传期间中断的分段即可。而无需从头重新开始上传对象。

**注意**  
有关将 Amazon S3 Express One Zone 存储类与目录存储桶配合使用的更多信息，请参阅 [S3 Express One Zone](directory-bucket-high-performance.md#s3-express-one-zone) 和[使用目录存储桶](directory-buckets-overview.md)。有关将分段上传用于 S3 Express One Zone 和目录存储桶的更多信息，请参阅[对目录桶使用分段上传](s3-express-using-multipart-upload.md)。

## 分段上传流程
<a name="mpu-process"></a>

分段上传分为三个步骤：开始上传、上传对象分段，以及在上传所有分段后完成分段上传。在收到完成分段上传请求后，Amazon S3 会利用上传的分段构造对象，而您可以像访问您存储桶中的任何其它对象一样访问该对象。

您可以列出所有正在执行的分段上传，或者获取为特定分段上传操作上传的分段列表。以上每个操作都在本节中进行了说明。

**分段上传开始**  
当您发送请求以开始分段上传时，请确保指定校验和类型。然后，Amazon S3 将返回具有上传 ID 的响应，此 ID 是分段上传的唯一标识符。当您上传分段、列出分段、完成上传或停止上传时，需要此上传 ID。如果您想要提供描述正上传的对象的元数据，必须在请求中提供它以便开始分段上传。匿名用户无法发起分段上传。

**分段上传**  
上传分段时，除了上传 ID 之外，还必须指定分段编号。您可以选择 1 和 10000 之间的任意分段编号。分段编号在您正在上传的对象中唯一地识别分段及其位置。您选择的分段编号不必是连续序列（例如，它可以是 1、5 和 14）。请注意，如果您使用之前上传的分段的同一分段编号上传新分段，则之前上传的分段会被覆盖。

当您上传分段时，Amazon S3 将在响应中返回校验和算法类型，其中每个分段的校验和值作为标头。对于每个分段上传，您必须记录分段编号和 ETag 值。您必须在随后的请求中包括这些值以完成分段上传。每个分段在上传时都有自己的 ETag。但是，一旦分段上传完成并且合并了所有分段，所有分段都会属于一个 ETag，作为多个校验和的校验和。

**重要**  
启动分段上传并上传一个或多个分段之后，您必须完成或停止分段上传，才能停止因存储已上传的分段而产生费用。只有在完成或停止分段上传*之后*，Amazon S3 才会释放分段存储并停止向您收取分段存储费用。  
停止分段上传后，无法再次使用该上传 ID 上传任何分段。如果分段上传正在进行中，则即使在您停止上传后，它们仍然可能会成功或失败。为了确保释放所有分段使用的所有存储，必须仅在完成所有分段的上传后才停止分段上传。

**分段上传完成**  
完成分段上传时，Amazon S3 通过按升序的分段编号规范化分段来创建对象。如果在*开始分段上传*请求中提供了任何对象元数据，则 Amazon S3 会将该元数据与对象相关联。成功*完成*请求后，分段将不再存在。

*完成分段上传* 请求必须包括上传 ID、分段编号及其相应的 ETag 值的列表。Amazon S3 响应包括可唯一地识别组合对象数据的 ETag。此 ETag 无需成为对象数据的 MD5 哈希。

当您在分段上传期间提供完整的对象校验和时，AWS SDK 会将校验和传递给 Amazon S3，而 S3 会在服务器端验证对象完整性，将其与接收到的值进行比较。然后，如果值匹配，S3 将存储对象。如果这两个值不匹配，Amazon S3 将使请求失败并出现 `BadDigest` 错误。对象的校验和还存储在对象元数据中，您稍后将使用这些元数据来验证对象的数据完整性。

**分段上传调用示例**  
 对于此示例，假设您正在为一个 100 GB 的文件生成分段上传。在这种情况下，您应在整个过程中进行以下 API 调用。总共将有 1002 个 API 调用。
+ 一个用于启动该过程的 `[CreateMultipartUpload](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CreateMultipartUpload.html)` 调用。
+ 1000 个单独的 `[UploadPart](https://docs.aws.amazon.com/AmazonS3/latest/API/API_UploadPart.html)` 调用，每次上传一个 100 MB 的分段，总大小为 100 GB。
+ 用于完成该过程的 `[CompleteMultipartUpload](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CompleteMultipartUpload.html)` 调用。

**分段上传列表**  
您可以列出特定分段上传或所有正在进行的分段上传的分段。列出分段操作将返回您已为特定分段上传而上传的分段信息。对于每个列出分段请求，Amazon S3 将返回有关特定分段上传的分段信息，最多为 1000 个分段。如果分段上传中的分段数量超过 1000 个，您必须发送一系列列出分段请求以检索所有分段。请注意，返回的分段列表不包括未完成上传的分段。使用*列出分段上传* 操作，您可以获得正在进行的分段上传的列表。

正在进行的分段上传是已开始但还未完成或停止的上传。每个请求将返回最多 1000 个分段上传。如果正在进行的分段上传超过 1000 个，您必须发送其他请求才能检索剩余的分段上传。仅使用返回的列表进行验证。

**重要**  
发送*完成分段上传* 请求时，请勿使用此列表的结果。相反，当上传分段和 Amazon S3 返回的相应 ETag 值时，请保留您自己的指定分段编号的列表。

## 使用分段上传操作的校验和
<a name="mpuchecksums"></a>

在将对象上传到 Amazon S3 时，可指定校验和算法以供 Amazon S3 使用。默认情况下，AWS SDK 和 S3 控制台对所有对象上传使用一种算法，您可以覆盖该算法。如果您使用的是较旧的 SDK，并且您上传的对象没有指定的校验和，则 Amazon S3 会自动使用 CRC-64/NVME (`CRC64NVME`) 校验和算法。（这也是高效数据完整性验证的推荐选项。） 当使用 CRC-64/NVME 时，Amazon S3 会在多分段或单分段上传完成后计算完整对象的校验和。CRC-64/NVME 校验和算法用于计算整个对象的直接校验和，或每个单独分段的多个校验和的校验和。

在使用分段上传将对象上传到 S3 后，Amazon S3 将计算每个分段或完整对象的校验和值并存储这些值。可以通过以下方式使用 S3 API 或 AWS SDK 来检索校验和值：
+ 对于单个分段，可以使用 [https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html) 或 [https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html](https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html)。如果您想在分段上传仍在进行时检索各个分段的校验和值，可以使用 [https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListParts.html](https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListParts.html)。
+ 对于整个对象，可以使用 [https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html)。如果要使用完整对象校验和执行分段上传，请通过指定完整对象校验和类型来使用 [https://docs.aws.amazon.com/AmazonS3/latest/API/API_CreateMultipartUpload](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CreateMultipartUpload) 和 [https://docs.aws.amazon.com/AmazonS3/latest/API/API_CompleteMultipartUpload](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CompleteMultipartUpload)。要验证整个对象的校验和值或要确认分段上传中使用的是哪种校验和类型，请使用 [https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListParts.html](https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListParts.html)。

**重要**  
如果您将分段上传与**校验和**结合使用，则上传每个分段（在分段上传中）时的分段编号必须使用连续的分段编号并从 1 开始。使用**校验和**时，如果您尝试使用非连续分段编号完成分段上传请求，Amazon S3 将生成 `HTTP 500 Internal Server` 错误。

 有关校验和如何处理分段上传对象的更多信息，请参阅[在 Amazon S3 中检查对象完整性](checking-object-integrity.md)。

有关用于演示如何使用分段上传以及额外的校验和来上传对象的端到端过程，请参阅[教程：通过分段上传来上传对象并验证其数据完整性](tutorial-s3-mpu-additional-checksums.md)。

## 并发分段上传操作
<a name="distributedmpupload"></a>

在分布式开发环境中，您的应用程序可以同时在同一对象上开始多个更新。您的应用程序可能会使用同一对象键开始多个分段上传。然后，对于其中每个上传，您的应用程序可以上传分段并将完成上传请求发送到 Amazon S3，以创建对象。当存储桶启用了 S3 版本控制时，完成分段上传将始终创建一个新版本。当您在启用版本控制的存储桶中启动使用相同对象键的多个分段上传时，对象的当前版本将由最新（`createdDate`）开始的上传决定。

例如，您在上午 10:00 启动对某个对象的 `CreateMultipartUpload` 请求。然后，您在上午 11:00 提交对同一对象的第二个 `CreateMultipartUpload` 请求。因为第二个请求是最新提交的，所以上午 11:00 的请求所上传的对象将成为当前版本，即使第一个上传是在第二个上传之后完成的，也是如此。对于未启用版本控制的存储桶，在启动分段上传与完成分段上传期间接收的任何其它请求都可能会优先。

另一个可以优先处理并发分段上传请求的例子是，在使用某个键开始分段上传之后，其它操作删除了该键。在完成此操作之前，完成分段上传的响应可能表示在未看到对象的情况下成功创建了对象。

## 防止在分段上传期间上传具有相同键名称的对象
<a name="multipart-upload-objects-with-same-key-name"></a>

在对上传操作使用有条件写入来创建对象之前，您可以检查存储桶中是否存在该对象。这样可以防止覆盖现有数据。当上传时，有条件写入将验证存储桶中尚不存在具有相同键名称的现有对象。

可以将有条件写入用于 [https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html) 或 [CompleteMultipartUpload](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CompleteMultipartUpload.html) 请求。

有关有条件请求的更多信息，请参阅[使用有条件请求向 S3 操作添加前提条件](conditional-requests.md)。

## 分段上传和定价
<a name="mpuploadpricing"></a>

开始分段上传后，Amazon S3 将保留所有分段，直到您完成或停止上传。在整个其生命周期内，您将支付有关此分段上传及其关联分段的所有存储、带宽和请求的费用。

将根据在上传各个分段时指定的存储类对这些分段收费。但是，如果将这些分段上传到 S3 Glacier Flexible Retrieval 或 S3 Glacier Deep Archive，则无需为这些分段付费。在上传完成之前，针对 S3 Glacier Flexible Retrieval 存储类的 PUT 请求的正在上传的分段采用 S3 Standard 存储费率按 S3 Glacier Flexible Retrieval 暂存存储计费。此外，`CreateMultipartUpload` 和 `UploadPart` 均按 S3 Standard 费率计费。只有 `CompleteMultipartUpload` 请求按 S3 Glacier Flexible Retrieval 费率计费。同样，在上传完成之前，针对 S3 Glacier Deep Archive 存储类的 PUT 请求的正在上传的分段采用 S3 Standard 存储费率按 S3 Glacier Flexible Retrieval 暂存存储计费，而只有 `CompleteMultipartUpload` 请求按 S3 Glacier Deep Archive 费率计费。

如果您停止分段上传，Amazon S3 将删除上传构件和已上传的任何分段。您无需为这些构件付费。无论指定的存储类如何，删除未完成的分段上传均不收取提前删除费用。有关定价的更多信息，请参阅 [Amazon S3 定价](https://aws.amazon.com/s3/pricing/)。

**注意**  
为了最大程度地降低存储成本，我们建议您配置生命周期规则，以便使用 `AbortIncompleteMultipartUpload` 操作在指定的天数后删除未完成的分段上传。有关创建生命周期规则以删除未完成的分段上传的更多信息，请参阅[配置存储桶生命周期配置以删除未完成的分段上传](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpu-abort-incomplete-mpu-lifecycle-config.html)。

## 分段上传的 API 支持
<a name="apisupportformpu"></a>

*Amazon Simple Storage Service API 参考*的下面几节描述了适用于分段上传的 REST API。

有关使用 AWS Lambda 函数的分段上传演练，请参阅 [Uploading large objects to Amazon S3 using multipart upload and transfer acceleration](https://aws.amazon.com/blogs/compute/uploading-large-objects-to-amazon-s3-using-multipart-upload-and-transfer-acceleration/)。
+ [创建分段上传](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CreateMultipartUpload.html)
+ [上传分段](https://docs.aws.amazon.com/AmazonS3/latest/API/API_UploadPart.html)
+ [上传分段（复制）](https://docs.aws.amazon.com/AmazonS3/latest/API/API_UploadPartCopy.html)
+ [完成分段上传](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CompleteMultipartUpload.html)
+ [中止分段上传](https://docs.aws.amazon.com/AmazonS3/latest/API/API_AbortMultipartUpload.html)
+ [列出分段](https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListParts.html)
+ [列出分段上传](https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListMultipartUploads.html)

## AWS Command Line Interface 对于分段上传的支持
<a name="clisupportformpu"></a>

AWS Command Line Interface 中的以下主题介绍了适用于分段上传的操作。
+ [开始分段上传](https://docs.aws.amazon.com/cli/latest/reference/s3api/create-multipart-upload.html)
+ [上传分段](https://docs.aws.amazon.com/cli/latest/reference/s3api/upload-part.html)
+ [上传分段（复制）](https://docs.aws.amazon.com/cli/latest/reference/s3api/upload-part-copy.html)
+ [完成分段上传](https://docs.aws.amazon.com/cli/latest/reference/s3api/complete-multipart-upload.html)
+ [中止分段上传](https://docs.aws.amazon.com/cli/latest/reference/s3api/abort-multipart-upload.html)
+ [列出分段](https://docs.aws.amazon.com/cli/latest/reference/s3api/list-parts.html)
+ [列出分段上传](https://docs.aws.amazon.com/cli/latest/reference/s3api/list-multipart-uploads.html)

## AWS SDK 对于分段上传的支持
<a name="sdksupportformpu"></a>



您可以使用 AWS SDK 分段上传对象。有关 API 操作支持的 AWS SDK 的列表，请参阅：
+ [创建分段上传](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CreateMultipartUpload.html)
+ [上传分段](https://docs.aws.amazon.com/AmazonS3/latest/API/API_UploadPart.html)
+ [上传分段（复制）](https://docs.aws.amazon.com/AmazonS3/latest/API/API_UploadPartCopy.html)
+ [完成分段上传](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CompleteMultipartUpload.html)
+ [中止分段上传](https://docs.aws.amazon.com/AmazonS3/latest/API/API_AbortMultipartUpload.html)
+ [列出分段](https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListParts.html)
+ [列出分段上传](https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListMultipartUploads.html)

## 分段上传 API 和权限
<a name="mpuAndPermissions"></a>

您必须具有使用分段上传操作的所需权限。您可以使用访问控制列表（ACL）、存储桶策略或用户策略来授予个人执行这些操作的权限。下表列出了使用 ACL、存储桶策略或用户策略时，各种分段上传操作的所需权限。


| 操作 | 所需权限 | 
| --- | --- | 
| 创建分段上传 | 必须支持您对于对象执行 `s3:PutObject` 操作，才能创建分段上传请求。<br />存储桶拥有者可以允许其他主体执行 `s3:PutObject` 操作。 | 
| 开始分段上传 | 必须支持您对于对象执行 `s3:PutObject` 操作，才能发起分段上传。<br />存储桶拥有者可以允许其他主体执行 `s3:PutObject` 操作。 | 
| 发起者 | 标识分段上传发起者的容器元素。如果发起者是 AWS 账户，此元素将提供与 Owner 元素相同的信息。如果发起者是 IAM 用户，此元素将提供用户 ARN 和显示名称。 | 
| 上传分段 | 必须允许您对对象执行 `s3:PutObject` 操作，才能上传分段。<br />存储桶拥有者必须允许发起者对对象执行 `s3:PutObject` 操作，以便发起者可以上传该对象的分段。 | 
| 上传分段（复制） | 必须允许您对对象执行 `s3:PutObject` 操作，才能上传分段。因为您正在上传现有对象的分段，因此必须允许您对源对象执行 `s3:GetObject`。<br />存储桶拥有者必须允许发起者对对象执行 `s3:PutObject` 操作，发起者才能上传该对象的分段。 | 
| 完成分段上传 | 必须允许您对对象执行 `s3:PutObject` 操作，才能完成分段上传。<br />存储桶拥有者必须允许发起者对对象执行 `s3:PutObject` 操作，以便发起者可以完成该对象的分段上传。 | 
| 停止分段上传 | 必须允许您执行 `s3:AbortMultipartUpload` 操作，才能停止分段上传。<br />默认情况下，支持存储桶拥有者和分段上传的发起者执行此操作，作为 IAM 和 S3 存储桶策略的一部分。如果发起者是 IAM 用户，也允许该用户的 AWS 账户停止此分段上传。使用 VPC 端点策略，分段上传的发起者不会自动获得执行 `s3:AbortMultipartUpload` 操作的权限。<br />除了这些默认情况之外，存储桶拥有者可以允许其他主体对对象执行 `s3:AbortMultipartUpload` 操作。存储桶拥有者可以拒绝任何主体，使其无法执行 `s3:AbortMultipartUpload` 操作。 | 
| 列出分段 | 您必须得到可以执行 `s3:ListMultipartUploadParts` 操作的允许，才能在分段上传中列出分段。<br />在默认情况下，存储桶拥有者有权为任何针对存储桶的分段上传列出分段。分段上传的发起者有权为特定分段上传列出分段。如果分段上传的发起者是 IAM 用户，则控制该 IAM 用户的 AWS 账户 同样有权列出此次上传的分段。<br /> 除了这些默认情况之外，存储桶拥有者可以允许其他主体对对象执行 `s3:ListMultipartUploadParts` 操作。存储桶拥有者也可以拒绝任何主体，使其无法执行 `s3:ListMultipartUploadParts` 操作。 | 
| 列出分段上传 | 您必须得到可以对存储桶执行 `s3:ListBucketMultipartUploads` 操作的允许，才能列出正在上传到该存储桶的分段上传。<br />除了默认情况之外，存储桶拥有者可以允许其他主体对存储桶执行 `s3:ListBucketMultipartUploads` 操作。 | 
| AWS KMS 加密和解密相关权限 | 要通过采用 AWS Key Management Service（AWS KMS）KMS 密钥的加密执行分段上传，请求者必须具有以下权限：[See the AWS documentation website for more details](http://docs.aws.amazon.com/zh_cn/AmazonS3/latest/userguide/mpuoverview.html)<br /> 这些权限是必需的，因为 Amazon S3 必须在完成分段上传之前解密并读取加密的文件段中的数据。要获得对象的校验和值，还需要 `kms:Decrypt` 权限以及具有客户提供的加密密钥的服务器端加密。如果您在使用 [https://docs.aws.amazon.com/AmazonS3/latest/API/API_CompleteMultipartUpload.html](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CompleteMultipartUpload.html) API 时没有这些必需的权限，则将在没有校验和的情况下创建对象。<br />如果 IAM 用户或角色与 KMS 密钥位于相同的 AWS 账户中，则验证您对密钥和 IAM 策略都拥有权限。如果您的 IAM 用户或角色属于与 KMS 密钥不同的账户，您必须在密钥策略和 IAM 用户或角色中具有这些权限。 | 
| SSE-C（具有客户提供的加密密钥的服务器端加密） | 使用 [https://docs.aws.amazon.com/AmazonS3/latest/API/API_CompleteMultipartUpload.html](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CompleteMultipartUpload.html) API 时，必须提供 SSE-C（具有客户提供的加密密钥的服务器端加密），否则将在没有校验和的情况下创建对象，并且不会返回校验和值。 | 

有关 ACL 权限与访问策略中的权限之间关系的信息，请参阅 [ACL 权限和访问策略权限的映射](acl-overview.md#acl-access-policy-permission-mapping)。有关 IAM 用户、角色和最佳实践的信息，请参阅《IAM 用户指南》**中的 [IAM 身份（用户、用户组和角色）](https://docs.aws.amazon.com/IAM/latest/UserGuide/id.html)。

## 使用分段上传操作的校验和
<a name="Checksums-mpu-operations"></a>

有三个 Amazon S3 API 用于执行实际的分段上传：[https://docs.aws.amazon.com/AmazonS3/latest/API/API_CreateMultipartUpload.html](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CreateMultipartUpload.html)、[https://docs.aws.amazon.com/AmazonS3/latest/API/API_UploadPart.html](https://docs.aws.amazon.com/AmazonS3/latest/API/API_UploadPart.html) 和 [https://docs.aws.amazon.com/AmazonS3/latest/API/API_CompleteMultipartUpload.html](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CompleteMultipartUpload.html)。下表指出了必须为其中每个 API 提供哪些校验和标头和值：


| 校验和算法 | 校验和类型 | `CreateMultipartUpload` | `UploadPart` | `CompleteMultipartUpoad` | 
| --- | --- | --- | --- | --- | 
| CRC-64/NVME (`CRC64NVME`) | 完整对象 | 必需的标头：`x-amz-checksum-algorithm` | 可选标头：<br />`x-amz-checksum-crc64nvme` | 可选标头：<br />`x-amz-checksum-algorithm`<br />`x-amz-crc64` | 
| CRC-32 (`CRC32`)<br />CRC 32-C (`CRC32C`) | 完整对象 | 必需的标头：<br />`x-amz-checksum-algorithm`<br />`x-amz-checksum-type` | 可选标头：<br />`x-amz-checksum-crc64nvme` | 可选标头：<br />`x-amz-checksum-algorithm`<br />`x-amz-crc32`<br />`x-amz-crc32c` | 
| CRC-32 (`CRC32`)<br />CRC-32C (`CRC32C`)<br />SHA-1 (`SHA1`)<br />SHA-256 (`SHA256`)<br />MD5 (`MD5`)<br />XXHash64 (`XXHASH64`)<br />XXHash3 (`XXHASH3`)<br />XXHash128 (`XXHASH128`)<br />SHA-512 (`SHA512`) | 复合键 | 必需的标头：<br />`x-amz-checksum-algorithm` | 必需的标头：<br />`x-amz-checksum-crc32`<br />`x-amz-checksum-crc32c`<br />`x-amz-checksum-sha1`<br />`x-amz-checksum-sha256`<br />`x-amz-checksum-md5`<br />`x-amz-checksum-xxhash64`<br />`x-amz-checksum-xxhash3`<br />`x-amz-checksum-xxhash128`<br />`x-amz-checksum-sha512` | 必需的标头：<br />所有分段级的校验和都需要包含在 `CompleteMultiPartUpload` 请求中。<br />可选标头：<br />`x-amz-checksum-crc32`<br />`x-amz-checksum-crc32c`<br />`x-amz-checksum-sha1`<br />`x-amz-checksum-sha256`<br />`x-amz-checksum-md5`<br />`x-amz-checksum-xxhash64`<br />`x-amz-checksum-xxhash3`<br />`x-amz-checksum-xxhash128`<br />`x-amz-checksum-sha512` | 

**Topics**
+ [分段上传流程](#mpu-process)
+ [使用分段上传操作的校验和](#mpuchecksums)
+ [并发分段上传操作](#distributedmpupload)
+ [防止在分段上传期间上传具有相同键名称的对象](#multipart-upload-objects-with-same-key-name)
+ [分段上传和定价](#mpuploadpricing)
+ [分段上传的 API 支持](#apisupportformpu)
+ [AWS Command Line Interface 对于分段上传的支持](#clisupportformpu)
+ [AWS SDK 对于分段上传的支持](#sdksupportformpu)
+ [分段上传 API 和权限](#mpuAndPermissions)
+ [使用分段上传操作的校验和](#Checksums-mpu-operations)
+ [配置存储桶生命周期配置以删除未完成的分段上传](mpu-abort-incomplete-mpu-lifecycle-config.md)
+ [使用分段上传操作上传对象](mpu-upload-object.md)
+ [使用高级别 .NET TransferUtility 类上传目录。](HLuploadDirDotNet.md)
+ [列出分段上传](list-mpu.md)
+ [使用 AWS SDK 跟踪分段上传](track-mpu.md)
+ [中止分段上传](abort-mpu.md)
+ [使用分段上传复制对象](CopyingObjectsMPUapi.md)
+ [教程：通过分段上传来上传对象并验证其数据完整性](tutorial-s3-mpu-additional-checksums.md)
+ [Amazon S3 分段上传限制](qfacts.md)