本文介绍OSS兼容的S3 API以及OSS与S3的差异。

## OSS兼容的S3 API

OSS对S3 Bucket、Object以及Multipart操作兼容的API如下：

**说明**

通过标准 S3 协议调用 API 时，`x-oss-process`参数仅支持`image/`和`style/`两种类型，不支持`video/`及其他处理类型。

| **操作类型** | **API** |
| Bucket操作 | - PutBucket - DeleteBucket - GetBucket（ListObjects） - GetBucketV2（ListObjectsV2） - GetBucketACL - GetBucketLifecycle - GetBucketLocation - GetBucketLogging - HeadBucket - PutBucketACL - PutBucketLifecycle - PutBucketLogging |
| Object操作 | - DeleteObject - DeleteObjects - GetObject - GetObjectACL - HeadObject - PostObject - PutObject - PutObjectCopy - PutObjectACL |
| Multipart操作 | - InitiateMultipartUpload - AbortMultipartUpload - CompleteMultipartUpload - ListParts - UploadPart - UploadPartCopy |

## OSS与S3的差异

OSS与S3的差异如下：

-   请求风格
    
    S3支持路径（Path）请求风格和虚拟托管（Virtual Hosted）请求风格。路径风格将Bucket名称放在URL路径中，而虚拟托管风格将Bucket名称作为子域名。基于安全考虑，OSS仅支持虚拟托管访问方式，即Bucket名称必须作为子域名使用。因此，在S3迁移至OSS后，客户端应用和S3工具都需要进行相应设置，确保所有请求采用虚拟托管风格，否则可能导致OSS报错，并禁止访问。
    
-   ACL权限定义
    
    OSS对ACL权限的定义与S3不完全一致，二者的主要区别如下：
    
    | **级别** | **权限** | **S3** | **OSS** |
    | --- | --- | --- | --- |
    | Bucket | READ | 拥有Bucket的list权限。 | 对于Bucket下的所有Object，如果某Object没有设置Object权限，则该Object可读。 |
    | WRITE | Bucket下的Object可写入或覆盖。 | - 对于Bucket下不存在的Object，可写入。 - 对于Bucket下存在的Object，如果该Object没有设置Object权限，则该Object可被覆盖。 - 可以初始化分片上传（InitiateMultipartUpload）。 |
    | READ\\_ACP | 读取Bucket ACL | 读取Bucket ACL，仅Bucket owner和授权子账号拥有此权限。 |
    | WRITE\\_ACP | 设置Bucket ACL。 | 设置Bucket ACL，仅Bucket owner和授权子账号拥有此权限。 |
    | Object | READ | Object可读。 | Object可读。 |
    | WRITE | N/A | Object可以被覆盖。 |
    | READ\\_ACP | 读取Object ACL。 | 读取Object ACL，仅Bucket owner和授权RAM用户拥有此权限。 |
    | WRITE\\_ACP | 设置Object ACL。 | 设置Object ACL，仅Bucket owner和授权RAM用户拥有此权限。 |
    
    **重要**
    
    OSS仅支持S3中的私有、公共读和公共读写三种ACL模式。
    
-   存储类型
    
    OSS支持标准（Standard）、低频访问（IA）和归档存储（Archive）三种存储类型，分别对应Amazon S3中的STANDARD、STANDARD\_IA和GLACIER。您可以根据需要转换OSS Object的存储类型。
    
    如果未开启归档直读，归档存储类型的Object在读取之前，要先使用Restore请求进行解冻操作。与S3不同，OSS会忽略S3 API中的解冻天数设置，解冻状态默认持续1天，用户可以延长到最多7天，之后，Object又回到初始时的冷冻状态。
    
-   ETag
    
    -   对于PUT方式上传的Object，OSS Object的ETag与Amazon S3在大小写上有区别。OSS为大写，而S3为小写。如果客户端有关于ETag的校验，请忽略大小写。
        
    -   对于分片上传的Object，OSS的ETag计算方式与S3不同。