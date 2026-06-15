OSS 兼容 AWS S3 API，使用 AWS SDK 访问 OSS 时，无需改动代码，只需配置 OSS 的 **Endpoint** 和**访问凭证**。

-   **Endpoint**：使用S3兼容格式的Endpoint，将`{region}`替换为实际地域ID，如`cn-hangzhou`，完整地域列表见[地域和Endpoint](/help/zh/oss/user-guide/regions-and-endpoints)。
    
    | **类型** | **格式** |
    | --- | --- |
    | 外网Endpoint | `https://s3.oss-{region}.aliyuncs.com` |
    | 内网Endpoint | `https://s3.oss-{region}-internal.aliyuncs.com` |
    | 传输加速Endpoint | `https://s3.oss-accelerate.aliyuncs.com` |
    
    **重要**
    
    根据[策略调整](https://www.alibabacloud.com/zh/notice/oss_update_notice_policy_change_in_calling_data_api_operations_via_the_default_public_domain_name_45a)，为提升OSS服务的合规性和安全性，自**2025年3月20日起，新开通OSS服务的用户**在中国内地地域的Bucket将无法通过默认外网域名调用数据操作类API（如上传、下载文件），需[通过自定义域名](/help/zh/oss/user-guide/access-buckets-via-custom-domain-names)（CNAME）方式访问OSS服务。使用HTTPS协议访问（如控制台）时，还需为自定义域名[配置SSL证书](/help/zh/oss/user-guide/access-oss-by-https-protocol)。
    
-   **访问凭证：**在[RAM 访问控制](https://ram.console.alibabacloud.com/users/create)创建有 OSS 访问权限的 AccessKey。
    

## Java

SDK 2.x

```
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import java.net.URI;

S3Client s3Client = S3Client.builder()
    .endpointOverride(URI.create("https://s3.oss-cn-hangzhou.aliyuncs.com"))
    .region(Region.AWS_GLOBAL)
    .serviceConfiguration(
        S3Configuration.builder()
            .pathStyleAccessEnabled(false)
            .chunkedEncodingEnabled(false)
            .build()
    )
    .build();
```

SDK 1.x

```
import com.amazonaws.client.builder.AwsClientBuilder.EndpointConfiguration;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.AmazonS3ClientBuilder;

AmazonS3 s3Client = AmazonS3ClientBuilder.standard()
    .withEndpointConfiguration(new EndpointConfiguration(
        "https://s3.oss-cn-hangzhou.aliyuncs.com", 
        "cn-hangzhou"))
    .withPathStyleAccessEnabled(false)
    .withChunkedEncodingDisabled(false)
    .build();
```

SDK 1.x 的 `getObject` 返回的 `S3ObjectInputStream` 调用 `close()` 会立即丢弃未读数据，应先完整读取。

```
S3Object object = s3Client.getObject("my-bucket", "file.txt");
InputStream input = object.getObjectContent();

byte[ ] data = IOUtils.toByteArray(input);

input.close();
```

## Python

```
import boto3
from botocore.config import Config

s3 = boto3.client(
    's3',
    endpoint_url='https://s3.oss-cn-hangzhou.aliyuncs.com',
    config=Config(
        signature_version='s3',
        s3={'addressing_style': 'virtual'}
    )
)
```

## Node.js

SDK v3

```
import { S3Client } from '@aws-sdk/client-s3';

const client = new S3Client({
    endpoint: 'https://s3.oss-cn-hangzhou.aliyuncs.com',
    region: 'cn-hangzhou'
});
```

SDK v2

```
const AWS = require('aws-sdk');

const s3 = new AWS.S3({
    endpoint: 'https://s3.oss-cn-hangzhou.aliyuncs.com',
    region: 'cn-hangzhou'
});
```

## Go

SDK v2

```
import (
    "context"
    "github.com/aws/aws-sdk-go-v2/aws"
    awsconfig "github.com/aws/aws-sdk-go-v2/config"
    "github.com/aws/aws-sdk-go-v2/service/s3"
)

cfg, _ := awsconfig.LoadDefaultConfig(context.TODO(),
    awsconfig.WithEndpointResolverWithOptions(
        aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
            return aws.Endpoint{
                URL: "https://s3.oss-cn-hangzhou.aliyuncs.com",
            }, nil
        }),
    ),
)
client := s3.NewFromConfig(cfg)
```

SDK v1

```
import (
    "github.com/aws/aws-sdk-go/aws"
    "github.com/aws/aws-sdk-go/aws/session"
    "github.com/aws/aws-sdk-go/service/s3"
)

sess := session.Must(session.NewSessionWithOptions(session.Options{
    Config: aws.Config{
        Endpoint: aws.String("https://s3.oss-cn-hangzhou.aliyuncs.com"),
        Region:   aws.String("cn-hangzhou"),
    },
    SharedConfigState: session.SharedConfigEnable,
}))
svc := s3.New(sess)
```

## .NET

SDK 3.x

```
using Amazon.S3;

var config = new AmazonS3Config
{
    ServiceURL = "https://s3.oss-cn-hangzhou.aliyuncs.com"
};
var client = new AmazonS3Client(config);
```

SDK 2.x

```
using Amazon.S3;

var config = new AmazonS3Config
{
    ServiceURL = "https://s3.oss-cn-hangzhou.aliyuncs.com"
};
var client = new AmazonS3Client(config);
```

## PHP

SDK 3.x

```
<?php
require_once __DIR__ . '/vendor/autoload.php';
use Aws\S3\S3Client;

$s3Client = new S3Client([
    'version' => '2006-03-01',
    'region'  => 'cn-hangzhou',
    'endpoint' => 'https://s3.oss-cn-hangzhou.aliyuncs.com'
]);
```

SDK 2.x

```
<?php
require_once __DIR__ . '/vendor/autoload.php';
use Aws\S3\S3Client;

$s3Client = S3Client::factory([
    'version' => '2006-03-01',
    'region'  => 'cn-hangzhou',
    'base_url' => 'https://s3.oss-cn-hangzhou.aliyuncs.com'
]);
```

## Ruby

SDK 3.x

```
require 'aws-sdk-s3'

s3 = Aws::S3::Client.new(
  endpoint: 'https://s3.oss-cn-hangzhou.aliyuncs.com',
  region: 'cn-hangzhou'
)
```

SDK 2.x

```
require 'aws-sdk'

s3 = AWS::S3::Client.new(
  s3_endpoint: 's3.oss-cn-hangzhou.aliyuncs.com',
  region: 'cn-hangzhou',
  s3_force_path_style: false
)
```

## C++

要求SDK 1.7.68及以上版本。

```
#include <aws/s3/S3Client.h>
#include <aws/core/client/ClientConfiguration.h>

Aws::Client::ClientConfiguration config;
config.endpointOverride = "s3.oss-cn-hangzhou.aliyuncs.com";
config.region = "cn-hangzhou";

Aws::S3::S3Client s3_client(config);
```

## Browser

Web前端应用使用STS临时凭证，禁止在客户端硬编码永久AccessKey。服务端调用[AssumeRole](https://api.aliyun.com/api/Sts/2015-04-01/AssumeRole?RegionId=cn-hangzhou)获取临时凭证并返回给客户端。完整教程见[使用STS临时访问凭证访问OSS](/help/zh/oss/developer-reference/use-temporary-access-credentials-provided-by-sts-to-access-oss)。

```
import { S3Client } from '@aws-sdk/client-s3';

// 从服务端获取STS临时凭证
async function getSTSCredentials() {
    const response = await fetch('https://your-server.com/api/sts-token');
    return await response.json();
}

// 使用临时凭证初始化S3客户端
const client = new S3Client({
    region: 'cn-hangzhou',
    endpoint: 'https://s3.oss-cn-hangzhou.aliyuncs.com',
    credentials: async () => {
        const creds = await getSTSCredentials();
        return {
            accessKeyId: creds.accessKeyId,
            secretAccessKey: creds.secretAccessKey,
            sessionToken: creds.securityToken,
            expiration: new Date(creds.expiration)
        };
    }
});
```

## Android

移动应用（Android）使用STS临时凭证，禁止在客户端硬编码永久AccessKey。服务端调用[AssumeRole](https://api.aliyun.com/api/Sts/2015-04-01/AssumeRole?RegionId=cn-hangzhou)获取临时凭证并返回给客户端。完整教程见[使用STS临时访问凭证访问OSS](/help/zh/oss/developer-reference/use-temporary-access-credentials-provided-by-sts-to-access-oss)。

```
import com.amazonaws.auth.AWSCredentialsProvider;
import com.amazonaws.auth.BasicSessionCredentials;
import com.amazonaws.client.builder.AwsClientBuilder.EndpointConfiguration;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.AmazonS3Client;

// 实现凭证提供器，从服务端获取STS临时凭证
public class OSSCredentialsProvider implements AWSCredentialsProvider {
    @Override
    public AWSCredentials getCredentials() {
        // 从您的服务端获取STS临时凭证
        // 请求 https://your-server.com/api/sts-token
        String accessKeyId = fetchFromServer("accessKeyId");
        String secretKeyId = fetchFromServer("secretKeyId");
        String securityToken = fetchFromServer("securityToken");
        
        return new BasicSessionCredentials(accessKeyId, secretKeyId, securityToken);
    }
    
    @Override
    public void refresh() {
        // 刷新凭证
    }
}

// 创建S3客户端
AmazonS3 s3Client = AmazonS3Client.builder()
    .withCredentials(new OSSCredentialsProvider())
    .withEndpointConfiguration(new EndpointConfiguration(
        "https://s3.oss-cn-hangzhou.aliyuncs.com", ""))
    .build();

// 业务代码
s3Client.putObject("my-bucket", "test.txt", "Hello OSS");
```

## iOS

移动应用（iOS）使用STS临时凭证，禁止在客户端硬编码永久AccessKey。服务端调用[AssumeRole](https://api.aliyun.com/api/Sts/2015-04-01/AssumeRole?RegionId=cn-hangzhou)获取临时凭证并返回给客户端。完整教程见[使用STS临时访问凭证访问OSS](/help/zh/oss/developer-reference/use-temporary-access-credentials-provided-by-sts-to-access-oss)。

```
#import <AWSS3/AWSS3.h>

// 实现凭证提供器
@interface OSSCredentialsProvider : NSObject <AWSCredentialsProvider>
@end

@implementation OSSCredentialsProvider

- (AWSTask<AWSCredentials *> *)credentials {
    return [[AWSTask taskWithResult:nil] continueWithBlock:^id(AWSTask *task) {
        // 从服务端获取STS临时凭证
        NSString *accessKey = [self fetchFromServer:@"accessKeyId"];
        NSString *secretKey = [self fetchFromServer:@"secretKeyId"];
        NSString *sessionToken = [self fetchFromServer:@"securityToken"];
        
        AWSCredentials *credentials = [[AWSCredentials alloc]
            initWithAccessKey:accessKey
            secretKey:secretKey
            sessionKey:sessionToken
            expiration:[NSDate dateWithTimeIntervalSinceNow:3600]];
        
        return [AWSTask taskWithResult:credentials];
    }];
}

@end

// 配置S3客户端
AWSEndpoint *endpoint = [[AWSEndpoint alloc] initWithURLString:@"https://s3.oss-cn-hangzhou.aliyuncs.com"];
AWSServiceConfiguration *configuration = [[AWSServiceConfiguration alloc]
    initWithRegion:AWSRegionUnknown
    endpoint:endpoint
    credentialsProvider:[[OSSCredentialsProvider alloc] init]];

[AWSS3 registerS3WithConfiguration:configuration forKey:@"OSS"];
AWSS3 *s3 = [AWSS3 S3ForKey:@"OSS"];

// 业务代码
AWSS3PutObjectRequest *request = [AWSS3PutObjectRequest new];
request.bucket = @"my-bucket";
request.key = @"test.txt";
request.body = [@"Hello OSS" dataUsingEncoding:NSUTF8StringEncoding];

[[s3 putObject:request] continueWithBlock:^id(AWSTask *task) {
    if (task.error) {
        NSLog(@"Error: %@", task.error);
    } else {
        NSLog(@"Success");
    }
    return nil;
}];
```

## 常见问题

#### **上传失败：InvalidArgument: aws-chunked encoding is not supported**

**症状**：上传文件时报错：

```
InvalidArgument: aws-chunked encoding is not supported with the specified x-amz-content-sha256 value
```

**根本原因**：

这是使用AWS SDK访问OSS最常见的问题。OSS支持AWS Signature V4签名算法，但在传输编码上有差异：

-   **AWS S3**：默认使用chunked encoding传输大文件
    
-   **OSS**：不支持chunked encoding传输
    

**原因分析**：

部分SDK的V4签名实现绑定了chunked encoding：

-   **Python (boto3)**：V4签名强制使用chunked encoding，无法禁用 → 改用V2签名
    
-   **Java**：可以通过配置禁用chunked encoding
    
-   **Go/Node.js**：默认不使用chunked encoding，无需特殊处理
    

**解决方案（按SDK分类）**：

| **SDK** | **解决方案** | **原因** |
| --- | --- | --- |
| **Python (boto3)** | 使用V2签名：`signature_version='s3'` | boto3的V4实现绑定chunked encoding，无法禁用 |
| **Java 1.x** | V4签名 + `.withChunkedEncodingDisabled(true)` | 可以禁用chunked encoding |
| **Java 2.x** | V4签名 + `.chunkedEncodingEnabled(false)` | 可以禁用chunked encoding |
| **Go v1** | V4签名 | 默认不使用chunked encoding |
| **Go v2** | V4签名；Manager上传大文件需注意 | Manager功能可能使用chunked encoding |
| **Node.js v3** | V4签名 | 默认不使用chunked encoding |

**Python示例（修复前后）**：

```
# 错误配置（boto3的V4实现使用chunked encoding）
s3 = boto3.client('s3',
    endpoint_url='https://oss-cn-hongkong.aliyuncs.com',
    config=Config(signature_version='v4'))

# 正确配置（boto3使用V2签名）
s3 = boto3.client('s3',
    endpoint_url='https://oss-cn-hongkong.aliyuncs.com',
    config=Config(signature_version='s3'))  # V2签名是boto3的稳定方案
```

**技术说明**：

OSS的V4签名遵循AWS Signature Version 4规范，但要求：

-   请求头包含：`x-oss-content-sha256: UNSIGNED-PAYLOAD`
    
-   不使用`Transfer-Encoding: chunked`传输方式
    

大部分SDK可以通过配置实现兼容，但boto3的V4签名实现与chunked encoding强耦合，因此boto3需使用V2签名。

#### **SDK版本和签名版本选择**

**版本选择参考**：

| **语言** | **SDK版本** | **签名版本** | **配置要点** |
| --- | --- | --- | --- |
| **Python** | boto3最新版 | V2签名（`s3`） | boto3的V4实现与OSS不兼容 |
| **Java 1.x** | 最新1.x | V4签名 | 需禁用chunked encoding |
| **Java 2.x** | 最新2.x | V4签名 | 需禁用chunked encoding |
| **Node.js** | v3  | V4签名（默认） | \\- |
| **Go v1** | 最新v1 | V4签名（默认） | \\- |
| **Go v2** | 最新v2 | V4签名（默认） | Manager上传大文件需注意 |

**签名版本说明**：

-   **OSS V4签名**：OSS完整支持AWS Signature V4算法
    
-   **V2签名**：boto3特殊情况，因SDK实现限制需使用V2
    
-   **兼容性**：除boto3外，其他SDK均可使用V4签名访问OSS
    

**新项目版本选择参考**：

| **场景** | **可选方案** | **原因** |
| --- | --- | --- |
| **Python新项目** | boto3 + V2签名 | boto3暂不支持OSS V4 |
| **Java新项目** | Java 2.x + V4签名 | 性能更好 |
| **Node.js新项目** | v3 + V4签名 | \\- |
| **Go新项目** | Go v1 + V4签名 | 推荐  |
| **已有项目迁移** | 保持当前SDK版本 | 最小化改动风险 |

#### **签名错误：SignatureDoesNotMatch**

可能遇到`SignatureDoesNotMatch`错误，提示服务端计算的签名与客户端提供的签名不匹配。

最常见的原因是代码中仍在使用AWS的AccessKey而不是OSS的AccessKey。AWS的访问凭证和OSS的访问凭证是完全独立的两套系统，不能混用。检查代码中的`aws_access_key_id`、`aws_secret_access_key`等参数，确保使用的是OSS控制台中创建的AccessKey ID和AccessKey Secret。

第二个常见原因是服务器时钟偏差。S3签名算法会在签名中包含时间戳，OSS服务端会验证请求时间与服务器时间的差异。如果你的服务器时间与标准时间相差超过15分钟，所有请求都会被拒绝。可以通过`date -u`命令检查服务器的UTC时间，如果时间不准确，使用`ntpdate`或系统时间同步服务校正时间。

第三个原因是endpoint配置错误。如果endpoint仍然指向AWS域名（如`s3.amazonaws.com`），或者使用了错误的OSS region，签名计算会失败。OSS endpoint的标准格式是`https://oss-{region}.aliyuncs.com`，其中region与bucket所在的OSS区域一致，比如`oss-cn-hangzhou`、`oss-cn-beijing`等。

使用boto3时，还有一个特殊原因：如果未配置`signature_version='s3'`，boto3会使用默认的V4签名，这会导致签名失败。正确的boto3配置包含`Config(signature_version='s3')`参数。

验证配置是否正确的一个简单方法是使用ossutil命令行工具。运行`ossutil ls oss://your-bucket --access-key-id <key> --access-key-secret <secret> --endpoint oss-cn-hangzhou.aliyuncs.com`，如果能成功列出bucket内容，说明访问凭证和endpoint配置是正确的，问题出在代码配置上。

#### **Bucket访问错误**

`NoSuchBucket`或`AccessDenied`错误表示无法访问指定的bucket。最常见的原因是endpoint与bucket所在region不匹配。

OSS的每个bucket都属于特定的region，比如`cn-hangzhou`、`cn-beijing`等。访问bucket时，endpoint使用bucket所在region的域名。如果您的bucket在杭州region，endpoint是`oss-cn-hangzhou.aliyuncs.com`，而不能使用北京region的`oss-cn-beijing.aliyuncs.com`。这与AWS S3不同，AWS S3允许跨region访问，但会自动重定向。OSS不支持跨region访问，错误的endpoint会直接返回`NoSuchBucket`错误。

第二个原因是RAM权限配置问题。检查您的OSS AccessKey对应的RAM用户是否有访问目标bucket的权限。在OSS控制台的RAM管理页面，确认该账号被授予了`oss:ListObjects`、`oss:GetObject`、`oss:PutObject`等必需的权限。

第三个原因与bucket命名规范有关。OSS支持两种URL样式：虚拟主机样式（`bucket-name.oss-cn-hangzhou.aliyuncs.com`）和路径样式（`oss-cn-hangzhou.aliyuncs.com/bucket-name`）。当使用虚拟主机样式时，bucket名称符合DNS命名规范，不能包含下划线字符。如果您的bucket名称包含下划线，需要在SDK配置中使用路径样式，或者创建新的符合命名规范的bucket。

#### **性能优化**

大文件上传和下载是对象存储应用中的常见需求。AWS SDK提供了多种传输加速机制，这些机制在OSS上同样有效。

使用Python boto3时，可以通过`TransferConfig`配置分片上传参数。当上传文件大于配置的阈值时，boto3会自动将文件分成多个部分并发上传，显著提高传输速度。`multipart_threshold`参数控制启用分片上传的文件大小阈值，`max_concurrency`控制并发上传的线程数，`multipart_chunksize`控制每个分片的大小。合理配置这些参数可以让100MB以上的大文件上传速度提升数倍。

使用Java SDK时，`TransferManager`类封装了分片上传、并发传输、自动重试等功能。`TransferManager`会根据文件大小自动选择最优的传输策略，无需手动处理分片逻辑。

使用Go SDK时，应该调用`s3manager.Uploader`而不是直接调用`PutObject`。`Uploader`内置了并发分片上传功能，可以自动将大文件分割并发上传，同时处理上传失败的重试逻辑。

使用Node.js SDK时，可以使用`@aws-sdk/lib-storage`包提供的`Upload`类。这个类支持流式上传，可以在读取文件的同时开始上传，减少内存占用。前面Node.js章节已经展示了使用示例。

所有这些传输加速机制都是基于S3的分片上传API（Multipart Upload），OSS完全兼容这些API，因此可以直接使用，无需修改代码。