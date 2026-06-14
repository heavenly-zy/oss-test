默认情况下，OSS存储空间中文件的读写权限是私有，仅文件拥有者可以上传。但文件拥有者可以对指定的文件生成具有临时访问权限的预签名URL，以允许他人使用该预签名URL在有效期内上传文件。该功能适用于授权合作伙伴上传合同，用户上传头像等场景。

## **注意事项**

-   本文以华东1（杭州）外网Endpoint为例。如果您希望通过与OSS同地域的其他阿里云产品访问OSS，请使用内网Endpoint。关于OSS支持的Region与Endpoint的对应关系，请参见[地域和Endpoint](https://help.aliyun.com/zh/oss/user-guide/regions-and-endpoints#concept-zt4-cvy-5db)。
    
-   预签名URL无需权限即可生成，但仅当您拥有`oss:PutObject`权限时，第三方才能通过该预签名URL成功上传文件。具体授权操作，请参见[为RAM用户授权自定义的权限策略](https://help.aliyun.com/zh/oss/common-examples-of-ram-policies#section-flo-x8e-e94)。
    
-   预签名URL上传不支持上传FormData格式，若需使用FormData上传数据，建议使用[OSS表单上传](https://help.aliyun.com/zh/oss/user-guide/form-upload)。
    

## **流程概览**

使用预签名URL上传文件的过程如下：

![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5781993771/CAEQVRiBgMCE2f6hrBkiIDA1NWFmNTkzNDNjOTRkMDg4MDlhMTEyNzYyMzY1Y2Rj4751395_20241112152822.507.svg)

## **使用预签名URL上传单个文件**

1.  Bucket拥有者生成PUT方法的预签名URL
    
    **说明**
    
    通过SDK生成的预签名URL，最大有效时长为7天。若使用STSToken来生成预签名URL，则最大有效时长为43200秒（12小时）。
    
    ### **Java**
    
    更多SDK信息，请参见[Java使用预签名URL上传文件](https://help.aliyun.com/zh/oss/developer-reference/upload-an-object-using-a-signed-url-generated-with-oss-sdk-for-java#f063d81500vor)。
    
    ```
    import com.aliyun.oss.*;
    import com.aliyun.oss.common.auth.*;
    import com.aliyun.oss.common.comm.SignVersion;
    import com.aliyun.oss.model.GeneratePresignedUrlRequest;
    import java.net.URL;
    import java.util.*;
    import java.util.Date;
    
    public class GetSignUrl {
        public static void main(String[] args) throws Throwable {
            // 以华东1（杭州）的外网Endpoint为例，其它Region请按实际情况填写。
            String endpoint = "https://oss-cn-hangzhou.aliyuncs.com";
            // 从环境变量中获取访问凭证。运行本代码示例之前，请确保已设置环境变量OSS_ACCESS_KEY_ID和OSS_ACCESS_KEY_SECRET。
            EnvironmentVariableCredentialsProvider credentialsProvider = CredentialsProviderFactory.newEnvironmentVariableCredentialsProvider();
            // 填写Bucket名称，例如examplebucket。
            String bucketName = "examplebucket";
            // 填写Object完整路径，例如exampleobject.txt。Object完整路径中不能包含Bucket名称。
            String objectName = "exampleobject.txt";
            // 填写Bucket所在地域。以华东1（杭州）为例，Region填写为cn-hangzhou。
            String region = "cn-hangzhou";
    
            // 创建OSSClient实例。
            // 当OSSClient实例不再使用时，调用shutdown方法以释放资源。
            ClientBuilderConfiguration clientBuilderConfiguration = new ClientBuilderConfiguration();
            clientBuilderConfiguration.setSignatureVersion(SignVersion.V4);
            OSS ossClient = OSSClientBuilder.create()
                    .endpoint(endpoint)
                    .credentialsProvider(credentialsProvider)
                    .clientConfiguration(clientBuilderConfiguration)
                    .region(region)
                    .build();
    
            URL signedUrl = null;
            try {
                // 指定生成的预签名URL过期时间，单位为毫秒。本示例以设置过期时间为1小时为例。
                Date expiration = new Date(new Date().getTime() + 3600 * 1000L);
    
                // 生成预签名URL。
                GeneratePresignedUrlRequest request = new GeneratePresignedUrlRequest(bucketName, objectName, HttpMethod.PUT);
                // 设置过期时间。
                request.setExpiration(expiration);
                // 通过HTTP PUT请求生成预签名URL。
                signedUrl = ossClient.generatePresignedUrl(request);
                // 打印预签名URL。
                System.out.println("signed url for putObject: " + signedUrl);
    
            } catch (OSSException oe) {
                System.out.println("Caught an OSSException, which means your request made it to OSS, "
                        + "but was rejected with an error response for some reason.");
                System.out.println("Error Message:" + oe.getErrorMessage());
                System.out.println("Error Code:" + oe.getErrorCode());
                System.out.println("Request ID:" + oe.getRequestId());
                System.out.println("Host ID:" + oe.getHostId());
            } catch (ClientException ce) {
                System.out.println("Caught an ClientException, which means the client encountered "
                        + "a serious internal problem while trying to communicate with OSS, "
                        + "such as not being able to access the network.");
                System.out.println("Error Message:" + ce.getMessage());
            }
        }
    }       
    ```
    
    ### **Go**
    
    更多SDK信息，请参见[Go使用预签名URL上传文件。](https://help.aliyun.com/zh/oss/developer-reference/v2-presign-upload#f525f2af2ardv)
    
    ```
    package main
    
    import (
    	"context"
    	"flag"
    	"log"
    	"time"
    
    	"github.com/aliyun/alibabacloud-oss-go-sdk-v2/oss"
    	"github.com/aliyun/alibabacloud-oss-go-sdk-v2/oss/credentials"
    )
    
    // 定义全局变量
    var (
    	region     string // 存储区域
    	bucketName string // 存储空间名称
    	objectName string // 对象名称
    )
    
    // init函数用于初始化命令行参数
    func init() {
    	flag.StringVar(&region, "region", "", "The region in which the bucket is located.")
    	flag.StringVar(&bucketName, "bucket", "", "The name of the bucket.")
    	flag.StringVar(&objectName, "object", "", "The name of the object.")
    }
    
    func main() {
    	// 解析命令行参数
    	flag.Parse()
    
    	// 检查bucket名称是否为空
    	if len(bucketName) == 0 {
    		flag.PrintDefaults()
    		log.Fatalf("invalid parameters, bucket name required")
    	}
    
    	// 检查region是否为空
    	if len(region) == 0 {
    		flag.PrintDefaults()
    		log.Fatalf("invalid parameters, region required")
    	}
    
    	// 检查object名称是否为空
    	if len(objectName) == 0 {
    		flag.PrintDefaults()
    		log.Fatalf("invalid parameters, object name required")
    	}
    
    	// 加载默认配置并设置凭证提供者和区域
    	cfg := oss.LoadDefaultConfig().
    		WithCredentialsProvider(credentials.NewEnvironmentVariableCredentialsProvider()).
    		WithRegion(region)
    
    	// 创建OSS客户端
    	client := oss.NewClient(cfg)
    
    	// 生成PutObject的预签名URL
    	result, err := client.Presign(context.TODO(), &oss.PutObjectRequest{
    		Bucket: oss.Ptr(bucketName),
    		Key:    oss.Ptr(objectName),
    	},
    		oss.PresignExpires(10*time.Minute),
    	)
    	if err != nil {
    		log.Fatalf("failed to put object presign %v", err)
    	}
    
    	log.Printf("request method:%v\n", result.Method)
    	log.Printf("request expiration:%v\n", result.Expiration)
    	log.Printf("request url:%v\n", result.URL)
    	if len(result.SignedHeaders) > 0 {
    		//当返回结果包含签名头时，使用签名URL发送Put请求时，需要设置相应的请求头
    		log.Printf("signed headers:\n")
    		for k, v := range result.SignedHeaders {
    			log.Printf("%v: %v\n", k, v)
    		}
    	}
    }
    ```
    
    ### **Python**
    
    更多SDK信息，请参见[Python使用预签名URL上传文件](https://help.aliyun.com/zh/oss/developer-reference/upload-an-object-using-a-signed-url-generated-with-oss-sdk-for-python-v2)。
    
    ```
    import argparse
    import requests
    import alibabacloud_oss_v2 as oss
    
    from datetime import datetime, timedelta
    
    # 创建命令行参数解析器，并描述脚本用途：生成对象预签名PUT请求链接（Presign Put Object）
    parser = argparse.ArgumentParser(description="presign put object sample")
    
    # 定义命令行参数，包括必需的区域、存储空间名称、endpoint以及对象键名
    parser.add_argument('--region', help='The region in which the bucket is located.', required=True)
    parser.add_argument('--bucket', help='The name of the bucket.', required=True)
    parser.add_argument('--endpoint', help='The domain names that other services can use to access OSS')
    parser.add_argument('--key', help='The name of the object.', required=True)
    
    def main():
        # 解析命令行参数，获取用户输入的值
        args = parser.parse_args()
    
        # 从环境变量中加载访问凭证信息，用于身份验证
        credentials_provider = oss.credentials.EnvironmentVariableCredentialsProvider()
    
        # 使用SDK默认配置创建配置对象，并设置认证提供者
        cfg = oss.config.load_default()
        cfg.credentials_provider = credentials_provider
    
        # 设置配置对象的区域属性，根据用户提供的命令行参数
        cfg.region = args.region
    
        # 如果提供了自定义endpoint，则更新配置对象中的endpoint属性
        if args.endpoint is not None:
            cfg.endpoint = args.endpoint
    
        # 使用上述配置初始化OSS客户端，准备与OSS交互
        client = oss.Client(cfg)
    
        # 发送请求以生成指定对象的预签名PUT请求
        pre_result = client.presign(oss.PutObjectRequest(
            bucket=args.bucket,  # 存储空间名
            key=args.key,  # 对象键名
        ),expires=timedelta(seconds=3600)) # 设置过期时间，单位为秒，此处设置为3600秒
    
        # 打印预签名请求的方法、过期时间和URL，以便确认预签名链接的有效性
        print(f'method: {pre_result.method},'
              f' expiration: {pre_result.expiration.strftime("%Y-%m-%dT%H:%M:%S.000Z")},'
              f' url: {pre_result.url}'
              )
    
        # 打印预签名请求的已签名头信息，这些信息在发送实际请求时会被包含在HTTP头部
        for key, value in pre_result.signed_headers.items():
            print(f'signed headers key: {key}, signed headers value: {value}')
    
    # 当此脚本被直接执行时，调用main函数开始处理逻辑
    if __name__ == "__main__":
        main()  # 脚本入口点，控制程序流程从这里开始
    ```
    
    ### **Node.js**
    
    此处仅列举普通场景，如何生成带图片处理参数的预签名URL、如何生成带versionID的预签名URL，请参见[Node.js使用预签名URL上传](https://help.aliyun.com/zh/oss/developer-reference/upload-objects-using-a-signed-url-generated-with-oss-sdk-for-node-js)。
    
    ```
    const OSS = require("ali-oss");
    
    // 定义一个生成签名 URL 的函数
    async function generateSignatureUrl(fileName) {
      // 获取预签名URL
      const client = await new OSS({
          accessKeyId: 'yourAccessKeyId',
          accessKeySecret: 'yourAccessKeySecret',
          bucket: 'examplebucket',
          region: 'oss-cn-hangzhou',
          authorizationV4: true
      });
    
      return await client.signatureUrlV4('PUT', 3600, {
          headers: {} // 请根据实际发送的请求头设置此处的请求头
      }, fileName);
    }
    // 调用函数并传入文件名
    generateSignatureUrl('yourFileName').then(url => {
      console.log('Generated Signature URL:', url);
    }).catch(err => {
      console.error('Error generating signature URL:', err);
    });
    ```
    
    ### **PHP**
    
    此处仅列举普通场景，如何生成带versionID的预签名URL，请参见[PHP使用预签名URL上传](https://help.aliyun.com/zh/oss/developer-reference/upload-objects-using-a-signed-url-generated-with-oss-sdk-for-php)。
    
    ```
    <?php
    if (is_file(__DIR__ . '/../autoload.php')) {
        require_once __DIR__ . '/../autoload.php';
    }
    if (is_file(__DIR__ . '/../vendor/autoload.php')) {
        require_once __DIR__ . '/../vendor/autoload.php';
    }
    
    use OSS\OssClient;
    use OSS\Core\OssException;
    use OSS\Http\RequestCore;
    use OSS\Http\ResponseCore;
    use OSS\Credentials\EnvironmentVariableCredentialsProvider;
    
    // 从环境变量中获取访问凭证。运行本代码示例之前，请确保已设置环境变量OSS_ACCESS_KEY_ID和OSS_ACCESS_KEY_SECRET。
    $provider = new EnvironmentVariableCredentialsProvider();
    // yourEndpoint填写Bucket所在地域对应的Endpoint。以华东1（杭州）为例，Endpoint填写为https://oss-cn-hangzhou.aliyuncs.com。
    $endpoint = "yourEndpoint";
    // 填写Bucket名称。
    $bucket= "examplebucket";
    // 填写不包含Bucket名称在内的Object完整路径。
    $object = "exampleobject.txt";
    // 指定预签名URL的过期时间为600s（最长可达32400s）。
    $timeout = 600;
    try {
        $config = array(  
            "provider" => $provider,
            "endpoint" => $endpoint,
            'signatureVersion'=>OssClient::OSS_SIGNATURE_VERSION_V4,
            "region"=> "cn-hangzhou"
        );
        $ossClient = new OssClient($config);
        // 生成预签名URL。
        $signedUrl = $ossClient->signUrl($bucket, $object, $timeout, "PUT");
        print_r($signedUrl);
    } catch (OssException $e) {
        printf(__FUNCTION__ . ": FAILED\n");
        printf($e->getMessage() . "\n");
        return;
    }           
    ```
    
    ### **Android**
    
    更多SDK信息，请参见[Android使用预签名URL上传文件](https://help.aliyun.com/zh/oss/developer-reference/authorize-access)。
    
    ```
    // 填写Bucket名称，例如examplebucket。
    String bucketName = "examplebucket";
    // 填写不包含Bucket名称在内源Object的完整路径，例如exampleobject.txt。
    String objectKey = "exampleobject.txt";
    // 设置content-type。
    String contentType = "application/octet-stream";
    String url = null;
    try {
        // 生成用于上传文件的预签名URL。
        GeneratePresignedUrlRequest request = new GeneratePresignedUrlRequest(bucketName, objectKey);
        // 设置预签名URL的过期时间为30分钟。
        request.setExpiration(30*60);
        request.setContentType(contentType);    
        request.setMethod(HttpMethod.PUT);
        url = oss.presignConstrainedObjectURL(request);
        Log.d("url", url);
    } catch (ClientException e) {
        e.printStackTrace();
    }
    ```
    
    ## C++
    
    更多SDK信息，请参见[C++使用预签名URL上传文件](https://help.aliyun.com/zh/oss/developer-reference/authorized-access-4)。
    
    ```
    #include <alibabacloud/oss/OssClient.h>
    using namespace AlibabaCloud::OSS;
    
    int main(void)
    {
        /* 初始化OSS账号信息。*/
                
        /* yourEndpoint填写Bucket所在地域对应的Endpoint。以华东1（杭州）为例，Endpoint填写为https://oss-cn-hangzhou.aliyuncs.com。*/
        std::string Endpoint = "yourEndpoint";
        /* yourRegion填写Bucket所在地域对应的Region。以华东1（杭州）为例，Region填写为cn-hangzhou。*/
        std::string Region = "yourRegion";
        /* 填写Bucket名称，例如examplebucket。*/
        std::string BucketName = "examplebucket";
        /* 填写Object完整路径，完整路径中不能包含Bucket名称，例如exampledir/exampleobject.txt。*/   
        std::string PutobjectUrlName = "exampledir/exampleobject.txt";
    
         /* 初始化网络等资源。*/
        InitializeSdk();
    
        ClientConfiguration conf;
        conf.signatureVersion = SignatureVersionType::V4;
        /* 从环境变量中获取访问凭证。运行本代码示例之前，请确保已设置环境变量OSS_ACCESS_KEY_ID和OSS_ACCESS_KEY_SECRET。*/
        auto credentialsProvider = std::make_shared<EnvironmentVariableCredentialsProvider>();
        OssClient client(Endpoint, credentialsProvider, conf);
        client.SetRegion(Region);
    
        /* 设置签名有效时长，最大有效时间为32400秒。*/
        std::time_t t = std::time(nullptr) + 1200;
        /* 生成预签名URL。*/
        auto genOutcome = client.GeneratePresignedUrl(BucketName, PutobjectUrlName, t, Http::Put);
        if (genOutcome.isSuccess()) {
            std::cout << "GeneratePresignedUrl success, Gen url:" << genOutcome.result().c_str() << std::endl;
        }
        else {
            /* 异常处理。*/
            std::cout << "GeneratePresignedUrl fail" <<
            ",code:" << genOutcome.error().Code() <<
            ",message:" << genOutcome.error().Message() <<
            ",requestId:" << genOutcome.error().RequestId() << std::endl;
            return -1;
        }
    
        /* 释放网络等资源。*/
        ShutdownSdk();
        return 0;
    }
    ```
    
    ### **iOS**
    
    更多SDK信息，请参见[iOS使用预签名URL上传文件](https://help.aliyun.com/zh/oss/developer-reference/authorize-access-4)。
    
    ```
    // 填写Bucket名称。
    NSString *bucketName = @"examplebucket";
    // 填写Object名称。
    NSString *objectKey = @"exampleobject.txt";
    NSURL *file = [NSURL fileURLWithPath:@"<filePath>"];
    NSString *contentType = [OSSUtil detemineMimeTypeForFilePath:file.absoluteString uploadName:objectKey];
    __block NSString *urlString;
    // 生成用于上传的预签名URL，并指定预签名URL过期时间为30分钟。
    OSSTask *task = [client presignConstrainURLWithBucketName:bucketName
                                                withObjectKey:objectKey
                                                   httpMethod:@"PUT"
                                       withExpirationInterval:30 * 60
                                               withParameters:@{}
                                                  contentType:contentType
                                                   contentMd5:nil];
    [task continueWithBlock:^id _Nullable(OSSTask * _Nonnull task) {
        if (task.error) {
            NSLog(@"presign error: %@", task.error);
        } else {
            urlString = task.result;
            NSLog(@"url: %@", urlString);
        }
        return nil;
    }];
    ```
    
    ## .NET
    
    更多SDK信息，请参见[.NET使用预签名URL上传](https://help.aliyun.com/zh/oss/developer-reference/upload-objects-using-presigned-urls-generated-with-sdk-for-net)。
    
    ```
    using Aliyun.OSS;
    using Aliyun.OSS.Common;
    // 填写Bucket所在地域对应的Endpoint。以华东1（杭州）为例，Endpoint填写为https://oss-cn-hangzhou.aliyuncs.com。
    var endpoint = "https://oss-cn-hangzhou.aliyuncs.com";
    // 从环境变量中获取访问凭证。运行本代码示例之前，请确保已设置环境变量OSS_ACCESS_KEY_ID和OSS_ACCESS_KEY_SECRET。
    var accessKeyId = Environment.GetEnvironmentVariable("OSS_ACCESS_KEY_ID");
    var accessKeySecret = Environment.GetEnvironmentVariable("OSS_ACCESS_KEY_SECRET");
    // 填写Bucket名称，例如examplebucket。
    var bucketName = "examplebucket";
    // 填写Object完整路径，完整路径中不包含Bucket名称，例如exampledir/exampleobject.txt。
    var objectName = "exampledir/exampleobject.txt";
    var objectContent = "More than just cloud.";
    // 填写Bucket所在地域对应的Region。以华东1（杭州）为例，Region填写为cn-hangzhou。
    const string region = "cn-hangzhou";
    
    // 创建ClientConfiguration实例，按照您的需要修改默认参数。
    var conf = new ClientConfiguration();
    
    // 设置v4签名。
    conf.SignatureVersion = SignatureVersion.V4;
    
    // 创建OssClient实例。
    var client = new OssClient(endpoint, accessKeyId, accessKeySecret, conf);
    client.SetRegion(region);
    try
    {
        // 生成预签名URL。
        var generatePresignedUriRequest = new GeneratePresignedUriRequest(bucketName, objectName, SignHttpMethod.Put)
        {
            // 设置预签名URL过期时间，默认值为3600秒。
            Expiration = DateTime.Now.AddHours(1),
        };
        var signedUrl = client.GeneratePresignedUri(generatePresignedUriRequest);
    }
    catch (OssException ex)
    {
        Console.WriteLine("Failed with error code: {0}; Error info: {1}. \nRequestID:{2}\tHostID:{3}",
            ex.ErrorCode, ex.Message, ex.RequestId, ex.HostId);
    }
    catch (Exception ex)
    {
        Console.WriteLine("Failed with error info: {0}", ex.Message);
    }
    ```
    
    ## C
    
    更多SDK信息，请参见[C使用预签名URL下载文件](https://help.aliyun.com/zh/oss/developer-reference/authorized-access-1)。
    
    ```
    #include "oss_api.h"
    #include "aos_http_io.h"
    /* yourEndpoint填写Bucket所在地域对应的Endpoint。以华东1（杭州）为例，Endpoint填写为https://oss-cn-hangzhou.aliyuncs.com。*/
    const char *endpoint = "yourEndpoint";
    
    /* 填写Bucket名称，例如examplebucket。*/
    const char *bucket_name = "examplebucket";
    /* 填写Object完整路径，完整路径中不能包含Bucket名称，例如exampledir/exampleobject.txt。*/
    const char *object_name = "exampledir/exampleobject.txt";
    /* 填写本地文件的完整路径。*/
    const char *local_filename = "yourLocalFilename";
    void init_options(oss_request_options_t *options)
    {
        options->config = oss_config_create(options->pool);
        /* 用char*类型的字符串初始化aos_string_t类型。*/
        aos_str_set(&options->config->endpoint, endpoint);
        /* 从环境变量中获取访问凭证。运行本代码示例之前，请确保已设置环境变量OSS_ACCESS_KEY_ID和OSS_ACCESS_KEY_SECRET。*/
        aos_str_set(&options->config->access_key_id, getenv("OSS_ACCESS_KEY_ID"));
        aos_str_set(&options->config->access_key_secret, getenv("OSS_ACCESS_KEY_SECRET"));
        /* 是否使用CNAME访问OSS服务。0表示不使用。*/
        options->config->is_cname = 0;
        /* 设置网络相关参数，例如超时时间等。*/
        options->ctl = aos_http_controller_create(options->pool, 0);
    }
    int main(int argc, char *argv[])
    {
        /* 在程序入口调用aos_http_io_initialize方法来初始化网络、内存等全局资源。*/
        if (aos_http_io_initialize(NULL, 0) != AOSE_OK) {
            exit(1);
        }
        /* 用于内存管理的内存池（pool），等价于apr_pool_t。其实现代码在apr库中。*/
        aos_pool_t *pool;
        /* 重新创建一个内存池，第二个参数是NULL，表示没有继承其它内存池。*/
        aos_pool_create(&pool, NULL);
        /* 创建并初始化options，该参数包括endpoint、access_key_id、acces_key_secret、is_cname、curl等全局配置信息。*/
        oss_request_options_t *oss_client_options;
        /* 在内存池中分配内存给options。*/
        oss_client_options = oss_request_options_create(pool);
        /* 初始化Client的选项oss_client_options。*/
        init_options(oss_client_options);
        /* 初始化参数。*/
        aos_string_t bucket;
        aos_string_t object;
        aos_string_t file;    
        aos_http_request_t *req;
        apr_time_t now;
        char *url_str;
        aos_string_t url;
        int64_t expire_time; 
        int one_hour = 3600;
        aos_str_set(&bucket, bucket_name);
        aos_str_set(&object, object_name);
        aos_str_set(&file, local_filename);
        expire_time = now / 1000000 + one_hour;    
        req = aos_http_request_create(pool);
        req->method = HTTP_PUT;
        now = apr_time_now(); 
        /* 单位：微秒 */
        expire_time = now / 1000000 + one_hour;
        /* 生成预签名URL。*/
        url_str = oss_gen_signed_url(oss_client_options, &bucket, &object, expire_time, req);
        aos_str_set(&url, url_str);
        printf("临时上传URL: %s\n", url_str);    
        /* 释放内存池，相当于释放了请求过程中各资源分配的内存。*/
        aos_pool_destroy(pool);
        /* 释放之前分配的全局资源。*/
        aos_http_io_deinitialize();
        return 0;
    }
    ```
    

2.  其他人使用PUT方法生成的预签名URL上传文件。
    
    **重要**
    
    预签名URL在有效期内可多次访问，但多次执行上传操作，会有文件覆盖的风险。超期后，需执行[步骤一](#ab7e12fef62e4)重新生成预签名URL以继续访问文件。
    
    ### curl
    
    ```
    curl -X PUT -T /path/to/local/file "https://exampleobject.oss-cn-hangzhou.aliyuncs.com/exampleobject.txt?x-oss-date=20241112T083238Z&x-oss-expires=3599&x-oss-signature-version=OSS4-HMAC-SHA256&x-oss-credential=LTAI****************%2F20241112%2Fcn-hangzhou%2Foss%2Faliyun_v4_request&x-oss-signature=ed5a******************************************************"
    ```
    
    ### Java
    
    ```
    import org.apache.http.HttpEntity;
    import org.apache.http.client.methods.CloseableHttpResponse;
    import org.apache.http.client.methods.HttpPut;
    import org.apache.http.entity.FileEntity;
    import org.apache.http.impl.client.CloseableHttpClient;
    import org.apache.http.impl.client.HttpClients;
    import java.io.*;
    import java.net.URL;
    import java.util.*;
    
    public class SignUrlUpload {
        public static void main(String[] args) throws Throwable {
            CloseableHttpClient httpClient = null;
            CloseableHttpResponse response = null;
    
            // 将<signedUrl>替换为授权URL。
            URL signedUrl = new URL("<signedUrl>");
    
            // 填写本地文件的完整路径。如果未指定本地路径，则默认从示例程序所属项目对应本地路径中上传文件。
            String pathName = "C:\\Users\\demo.txt";
    
            try {
                HttpPut put = new HttpPut(signedUrl.toString());
                System.out.println(put);
                HttpEntity entity = new FileEntity(new File(pathName));
                put.setEntity(entity);
                httpClient = HttpClients.createDefault();
                response = httpClient.execute(put);
    
                System.out.println("返回上传状态码："+response.getStatusLine().getStatusCode());
                if(response.getStatusLine().getStatusCode() == 200){
                    System.out.println("使用网络库上传成功");
                }
                System.out.println(response.toString());
            } catch (Exception e){
                e.printStackTrace();
            } finally {
                 if (response != null) {
                     response.close();
                 }
                 if (httpClient != null) {
                     httpClient.close();
                 }
             }
        }
    }       
    ```
    
    ### Go
    
    ```
    package main
    
    import (
    	"fmt"
    	"io"
    	"net/http"
    	"os"
    )
    
    func uploadFile(signedUrl, filePath string) error {
    	// 打开文件
    	file, err := os.Open(filePath)
    	if err != nil {
    		return fmt.Errorf("无法打开文件: %w", err)
    	}
    	defer file.Close()
    
    	// 创建一个新的HTTP客户端
    	client := &http.Client{}
    
    	// 创建一个PUT请求
    	req, err := http.NewRequest("PUT", signedUrl, file)
    	if err != nil {
    		return fmt.Errorf("创建请求失败: %w", err)
    	}
    
    	// 发送请求
    	resp, err := client.Do(req)
    	if err != nil {
    		return fmt.Errorf("发送请求失败: %w", err)
    	}
    	defer resp.Body.Close()
    
    	// 读取响应
    	body, err := io.ReadAll(resp.Body)
    	if err != nil {
    		return fmt.Errorf("读取响应失败: %w", err)
    	}
    
    	fmt.Printf("返回上传状态码: %d\n", resp.StatusCode)
    	if resp.StatusCode == 200 {
    		fmt.Println("使用网络库上传成功")
    	}
    	fmt.Println(string(body))
    
    	return nil
    }
    
    func main() {
    	// 将<signedUrl>替换为授权URL。
    	signedUrl := "<signedUrl>"
    
    	// 填写本地文件的完整路径。如果未指定本地路径，则默认从示例程序所属项目对应本地路径中上传文件。
    	filePath := "C:\\Users\\demo.txt"
    
    	err := uploadFile(signedUrl, filePath)
    	if err != nil {
    		fmt.Println("发生错误:", err)
    	}
    }
    ```
    
    ### python
    
    ```
    import requests
    
    def upload_file(signed_url, file_path):
        try:
            # 打开文件
            with open(file_path, 'rb') as file:
                # 发送PUT请求上传文件
                response = requests.put(signed_url, data=file)
         
            print(f"返回上传状态码：{response.status_code}")
            if response.status_code == 200:
                print("使用网络库上传成功")
            print(response.text)
     
        except Exception as e:
            print(f"发生错误：{e}")
    
    if __name__ == "__main__":
        # 将<signedUrl>替换为授权URL。
        signed_url = "<signedUrl>"
        
        # 填写本地文件的完整路径。如果未指定本地路径，则默认从示例程序所属项目对应本地路径中上传文件。
        file_path = "C:\\Users\\demo.txt"
    
        upload_file(signed_url, file_path)
    ```
    
    ### Node.js
    
    ```
    const fs = require('fs');
    const axios = require('axios');
    
    async function uploadFile(signedUrl, filePath) {
        try {
            // 创建读取流
            const fileStream = fs.createReadStream(filePath);
            
            // 发送PUT请求上传文件
            const response = await axios.put(signedUrl, fileStream, {
                headers: {
                    'Content-Type': 'application/octet-stream' // 根据实际情况调整Content-Type
                }
            });
    
            console.log(`返回上传状态码：${response.status}`);
            if (response.status === 200) {
                console.log('使用网络库上传成功');
            }
            console.log(response.data);
        } catch (error) {
            console.error(`发生错误：${error.message}`);
        }
    }
    
    // 主函数
    (async () => {
        // 将<signedUrl>替换为授权URL。
        const signedUrl = '<signedUrl>';
        
        // 填写本地文件的完整路径。如果未指定本地路径，则默认从示例程序所属项目对应本地路径中上传文件。
        const filePath = 'C:\\Users\\demo.txt';
    
        await uploadFile(signedUrl, filePath);
    })();
    ```
    
    ### browser.js
    
    **重要**
    
    如果您使用 Browser.js 上传文件时遇到 403 签名不匹配错误，通常是因为浏览器会自动添加 Content-Type 请求头，而生成预签名 URL 时未指定该请求头，导致签名验证失败。为解决此问题，您需要在生成预签名 URL 时指定 Content-Type 请求头。
    
    ```
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>File Upload Example</title>
    </head>
    <body>
        <h1>File Upload Example</h1>
    
        <!-- 选择文件 -->
        <input type="file" id="fileInput" />
        <button id="uploadButton">Upload File</button>
    
        <script>
            // 请将此替换为步骤一生成的预签名 URL。
            const signedUrl = "<signedUrl>"; 
    
    
            document.getElementById('uploadButton').addEventListener('click', async () => {
                const fileInput = document.getElementById('fileInput');
                const file = fileInput.files[0];
    
                if (!file) {
                    alert('Please select a file to upload.');
                    return;
                }
    
                try {
                    await upload(file, signedUrl);
                    alert('File uploaded successfully!');
                } catch (error) {
                    console.error('Error during upload:', error);
                    alert('Upload failed: ' + error.message);
                }
            });
    
            /**
             * 上传文件到 OSS
             * @param {File} file - 需要上传的文件
             * @param {string} presignedUrl - 预签名 URL
             */
            const upload = async (file, presignedUrl) => {
                const response = await fetch(presignedUrl, {
                    method: 'PUT',
                    body: file,  // 直接上传整个文件
                });
    
                if (!response.ok) {
                    throw new Error(`Upload failed, status: ${response.status}`);
                }
    
                console.log('File uploaded successfully');
            };
        </script>
    </body>
    </html>
    ```
    
    ### C#
    
    ```
    using System.Net.Http.Headers;
    
    // 填写本地文件的完整路径。如果未指定本地路径，则默认从示例程序所属项目对应本地路径中上传文件
    var filePath = "C:\\Users\\demo.txt";
    // 将<signedUrl>替换为授权URL
    var presignedUrl = "<signedUrl>";
    
    // 创建HTTP客户端并打开本地文件流
    using var httpClient = new HttpClient(); 
    using var fileStream = new FileStream(filePath, FileMode.Open, FileAccess.Read);
    using var content = new StreamContent(fileStream);
                
    // 创建PUT请求
    var request = new HttpRequestMessage(HttpMethod.Put, presignedUrl);
    request.Content = content;
    
    // 发送请求
    var response = await httpClient.SendAsync(request);
    
    // 处理响应
    if (response.IsSuccessStatusCode)
    {
        Console.WriteLine($"上传成功！状态码: {response.StatusCode}");
        Console.WriteLine("响应头部:");
        foreach (var header in response.Headers)
        {
            Console.WriteLine($"{header.Key}: {string.Join(", ", header.Value)}");
        }
    }
    else
    {
        string responseContent = await response.Content.ReadAsStringAsync();
        Console.WriteLine($"上传失败！状态码: {response.StatusCode}");
        Console.WriteLine("响应内容: " + responseContent);
    }
    ```
    
    ### C++
    
    ```
    #include <iostream>
    #include <fstream>
    #include <curl/curl.h>
    
    void uploadFile(const std::string& signedUrl, const std::string& filePath) {
        CURL *curl;
        CURLcode res;
    
        curl_global_init(CURL_GLOBAL_DEFAULT);
        curl = curl_easy_init();
    
        if (curl) {
            // 设置URL
            curl_easy_setopt(curl, CURLOPT_URL, signedUrl.c_str());
    
            // 设置请求方法为PUT
            curl_easy_setopt(curl, CURLOPT_UPLOAD, 1L);
    
            // 打开文件
            FILE *file = fopen(filePath.c_str(), "rb");
            if (!file) {
                std::cerr << "无法打开文件: " << filePath << std::endl;
                return;
            }
    
            // 获取文件大小
            fseek(file, 0, SEEK_END);
            long fileSize = ftell(file);
            fseek(file, 0, SEEK_SET);
    
            // 设置文件大小
            curl_easy_setopt(curl, CURLOPT_INFILESIZE_LARGE, (curl_off_t)fileSize);
    
            // 设置输入文件句柄
            curl_easy_setopt(curl, CURLOPT_READDATA, file);
    
            // 执行请求
            res = curl_easy_perform(curl);
    
            if (res != CURLE_OK) {
                std::cerr << "curl_easy_perform() 失败: " << curl_easy_strerror(res) << std::endl;
            } else {
                long httpCode = 0;
                curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &httpCode);
                std::cout << "返回上传状态码: " << httpCode << std::endl;
    
                if (httpCode == 200) {
                    std::cout << "使用网络库上传成功" << std::endl;
                }
            }
    
            // 关闭文件
            fclose(file);
    
            // 清理
            curl_easy_cleanup(curl);
        }
    
        curl_global_cleanup();
    }
    
    int main() {
        // 将<signedUrl>替换为授权URL。
        std::string signedUrl = "<signedUrl>";
    
        // 填写本地文件的完整路径。如果未指定本地路径，则默认从示例程序所属项目对应本地路径中上传文件。
        std::string filePath = "C:\\Users\\demo.txt";
    
        uploadFile(signedUrl, filePath);
    
        return 0;
    }
    ```
    
    ### Android
    
    ```
    package com.example.signurlupload;
    
    import android.os.AsyncTask;
    import android.util.Log;
    
    import java.io.DataOutputStream;
    import java.io.FileInputStream;
    import java.io.IOException;
    import java.net.HttpURLConnection;
    import java.net.URL;
    
    public class SignUrlUploadActivity {
    
        private static final String TAG = "SignUrlUploadActivity";
    
        public void uploadFile(String signedUrl, String filePath) {
            new UploadTask().execute(signedUrl, filePath);
        }
    
        private class UploadTask extends AsyncTask<String, Void, String> {
    
            @Override
            protected String doInBackground(String... params) {
                String signedUrl = params[0];
                String filePath = params[1];
    
                HttpURLConnection connection = null;
                DataOutputStream dos = null;
                FileInputStream fis = null;
    
                try {
                    URL url = new URL(signedUrl);
                    connection = (HttpURLConnection) url.openConnection();
                    connection.setRequestMethod("PUT");
                    connection.setDoOutput(true);
                    connection.setRequestProperty("Content-Type", "application/octet-stream");
    
                    fis = new FileInputStream(filePath);
                    dos = new DataOutputStream(connection.getOutputStream());
    
                    byte[] buffer = new byte[1024];
                    int length;
    
                    while ((length = fis.read(buffer)) != -1) {
                        dos.write(buffer, 0, length);
                    }
    
                    dos.flush();
                    dos.close();
                    fis.close();
    
                    int responseCode = connection.getResponseCode();
                    Log.d(TAG, "返回上传状态码: " + responseCode);
    
                    if (responseCode == 200) {
                        Log.d(TAG, "使用网络库上传成功");
                    }
    
                    return "上传完成，状态码: " + responseCode;
    
                } catch (IOException e) {
                    e.printStackTrace();
                    return "上传失败: " + e.getMessage();
                } finally {
                    if (connection != null) {
                        connection.disconnect();
                    }
                }
            }
    
            @Override
            protected void onPostExecute(String result) {
                Log.d(TAG, result);
            }
        }
    
        public static void main(String[] args) {
            SignUrlUploadActivity activity = new SignUrlUploadActivity();
            // 将<signedUrl>替换为授权URL。
            String signedUrl = "<signedUrl>";
            // 填写本地文件的完整路径。如果未指定本地路径，则默认从示例程序所属项目对应本地路径中上传文件。
            String filePath = "C:\\Users\\demo.txt";
            activity.uploadFile(signedUrl, filePath);
        }
    }
    ```
    

## **使用预签名URL分片上传文件**

当客户端无法集成OSS SDK，但需上传大文件时，可采用预签名 URL 分片上传方案。该方式由服务端初始化上传任务，并为每个分片生成带有权限的预签名 URL，供客户端或第三方应用上传。上传完成后，服务端再发起合并，生成完整文件。

**重要**

由于预签名 URL 分片上传相对复杂，客户端必须按URL中的 partNumber 上传对应的分片，缺失或错位都会导致最终合并的文件不正确。因此，若您的客户端支持集成 OSS SDK，更推荐使用STS授权实现[客户端直传](https://help.aliyun.com/zh/oss/user-guide/obtain-signature-information-from-the-server-and-upload-data-to-oss#171c63c7b53y9)，开发更简单，上传更稳定。

| ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5781993771/CAEQWhiBgMDt6_etuBkiIDMyNDkzNWY1NWY1MzRmNzFhNDdlYmE1MWE1NjQyMWQ14751395_20241112152822.507.svg) |     |
| --- | --- |

1.  **客户端发起上传请求**
    
    客户端向服务端发起上传请求，传入文件名、文件大小、期望的分片大小（不超过5GB，推荐5MB）。
    
    示例如下，其中`https://yourserver.com/init-upload`是您服务端提供的初始化接口地址，请根据实际替换。
    
    ```
    curl -X POST https://yourserver.com/init-upload \
      -H "Content-Type: application/json" \
      -d '{
        "fileName": "exampleobject.jpg",
        "fileSize": 104857600,
        "partSize": 5242880
    }'
    ```
    
2.  **服务端初始化上传任务并生成预签名 URL**
    
    1.  调用InitiateMultipartUpload初始化上传任务，获取UploadId
        
    2.  根据文件大小和期望的分片大小，计算分片个数
        
    3.  为每个分片生成对应的预签名URL
        
    4.  返回URL列表（JSON 格式）
        
    
    **说明**
    
    服务端应记录UploadId，并确保它能与上传的文件建立唯一对应关系，以便后续完成分片校验与合并。您可结合业务需求，使用缓存或数据库等方式存储UploadId。
    
    **示例代码：初始化上传请求并生成预签名 URL**
    
    ## Java
    
    ```
    import com.aliyun.oss.ClientBuilderConfiguration;
    import com.aliyun.oss.HttpMethod;
    import com.aliyun.oss.OSS;
    import com.aliyun.oss.OSSClientBuilder;
    import com.aliyun.oss.common.auth.CredentialsProviderFactory;
    import com.aliyun.oss.common.auth.EnvironmentVariableCredentialsProvider;
    import com.aliyun.oss.common.comm.SignVersion;
    import com.aliyun.oss.model.GeneratePresignedUrlRequest;
    import com.aliyun.oss.model.InitiateMultipartUploadRequest;
    import com.aliyun.oss.model.InitiateMultipartUploadResult;
    
    import java.net.URL;
    import java.util.Date;
    import java.util.HashMap;
    import java.util.Map;
    public class InitAndGenerateURL {
        public static void main(String[] args) throws Throwable {
            // 模拟客户端传来的参数（单位：字节）
            long fileSize = 15 * 1024 * 1024L;   // 模拟 15MB 文件
            long partSize = 5 * 1024 * 1024L;    // 模拟期望每个分片 5MB
    
            // 计算分片数量
            int totalParts = (int) ((fileSize + partSize - 1) / partSize);
    
            // 以华东1（杭州）的外网Endpoint为例
            String endpoint = "https://oss-cn-hangzhou.aliyuncs.com";
            String region = "cn-hangzhou";
            String bucketName = "exampleBucket";
            String objectName = "exampleObject.jpeg";
            long expireTime = 3600 * 1000L; // URL 1小时过期
    
            EnvironmentVariableCredentialsProvider credentialsProvider = CredentialsProviderFactory.newEnvironmentVariableCredentialsProvider();
            ClientBuilderConfiguration config = new ClientBuilderConfiguration();
            config.setSignatureVersion(SignVersion.V4);
    
            OSS ossClient = OSSClientBuilder.create()
                    .endpoint(endpoint)
                    .region(region)
                    .credentialsProvider(credentialsProvider)
                    .clientConfiguration(config)
                    .build();
    
            // 初始化上传任务
            InitiateMultipartUploadRequest initRequest = new InitiateMultipartUploadRequest(bucketName, objectName);
            InitiateMultipartUploadResult initResult = ossClient.initiateMultipartUpload(initRequest);
            String uploadId = initResult.getUploadId();
            System.out.println("Upload ID: " + uploadId);
            System.out.println("Total parts: " + totalParts);
    
            // 为每个分片生成预签名 URL
            for (int i = 1; i <= totalParts; i++) {
                Map<String, String> headers = new HashMap<>();
                String signedUrl = generatePresignedUrl(ossClient, bucketName, objectName, HttpMethod.PUT,
                        expireTime, i, uploadId, headers);
                System.out.println("Part " + i + " URL: " + signedUrl);
            }
    
            ossClient.shutdown();
        }
    
        public static String generatePresignedUrl(OSS ossClient, String bucketName, String objectName, HttpMethod method,
                                                  long expireTime, int partNum, String uploadId, Map<String, String> headers) {
            Date expiration = new Date(System.currentTimeMillis() + expireTime);
            GeneratePresignedUrlRequest request = new GeneratePresignedUrlRequest(bucketName, objectName, method);
            request.setExpiration(expiration);
            request.setHeaders(headers);
            request.addQueryParameter("partNumber", String.valueOf(partNum));
            request.addQueryParameter("uploadId", uploadId);
            URL url = ossClient.generatePresignedUrl(request);
            return url.toString();
        }
    }
    ```
    
    ## Go
    
    ```
    package main
    
    import (
    	"context"
    	"encoding/json"
    	"flag"
    	"fmt"
    	"log"
    	"time"
    
    	"github.com/aliyun/alibabacloud-oss-go-sdk-v2/oss"
    	"github.com/aliyun/alibabacloud-oss-go-sdk-v2/oss/credentials"
    )
    
    type SignedPart struct {
    	PartNumber int    `json:"part_number"`
    	URL        string `json:"url"`
    	Method     string `json:"method"`
    }
    
    type UploadInitResponse struct {
    	UploadId string       `json:"upload_id"`
    	Parts    []SignedPart `json:"parts"`
    }
    
    // 全局参数变量
    var (
    	region     string
    	bucketName string
    	objectName string
    )
    
    func init() {
    	flag.StringVar(&region, "region", "", "The region in which the bucket is located.")
    	flag.StringVar(&bucketName, "bucket", "", "The name of the bucket.")
    	flag.StringVar(&objectName, "object", "", "The name of the object.")
    }
    
    func main() {
    	flag.Parse()
    
    	// 假设文件大小为15MB，分片大小为5MB
    	fileSize := int64(15 * 1024 * 1024)
    	partSize := int64(5 * 1024 * 1024)
    	totalParts := int((fileSize + partSize - 1) / partSize)
    
    	cfg := oss.LoadDefaultConfig().
    		WithCredentialsProvider(credentials.NewEnvironmentVariableCredentialsProvider()).
    		WithRegion(region)
    
    	client := oss.NewClient(cfg)
    
    	// 初始化分片上传
    	resp, err := client.InitiateMultipartUpload(context.TODO(), &oss.InitiateMultipartUploadRequest{
    		Bucket: oss.Ptr(bucketName),
    		Key:    oss.Ptr(objectName),
    	})
    	if err != nil {
    		log.Fatalf("Failed to initiate multipart upload: %v", err)
    	}
    	uploadId := resp.UploadId
    	fmt.Println("Upload ID:", *uploadId)
    	fmt.Println("Total parts:", totalParts)
    
    	// 生成每个分片的预签名URL
    	expire := time.Hour // 预签名 URL 的有效期设置为 1 小时
    	var parts []SignedPart
    	for i := 1; i <= totalParts; i++ {
    		req := &oss.UploadPartRequest{
    			Bucket:     oss.Ptr(bucketName),
    			Key:        oss.Ptr(objectName),
    			PartNumber: int32(i),
    			UploadId:   uploadId,
    		}
    		presignResult, err := client.Presign(context.TODO(), req, oss.PresignExpiration(time.Now().Add(expire)))
    		if err != nil {
    			log.Fatalf("Failed to generate signed URL for part %d: %v", i, err)
    		}
    		parts = append(parts, SignedPart{
    			PartNumber: i,
    			URL:        presignResult.URL,
    			Method:     "PUT",
    		})
    	}
    
    	// 输出 JSON
    	out := UploadInitResponse{
    		UploadId: *uploadId,
    		Parts:    parts,
    	}
    	outJSON, _ := json.MarshalIndent(out, "", "  ")
    	fmt.Println(string(outJSON))
    }
    ```
    
    ## Python
    
    ```
    import argparse
    import json
    import alibabacloud_oss_v2 as oss
    
    # 模拟文件参数
    FILE_SIZE = 15 * 1024 * 1024  # 模拟上传文件大小（15MB）
    PART_SIZE = 5 * 1024 * 1024   # 每个分片大小：5MB
    EXPIRE_TIME = 3600            # 预签名URL有效期（单位：秒）
    
    def main():
        # 创建命令行参数解析器，并描述脚本用途
        parser = argparse.ArgumentParser(description="presign multipart upload sample")
    
        # 添加命令行参数 --region，表示存储空间所在的区域，必需参数
        parser.add_argument('--region', help='The region in which the bucket is located.', required=True)
        # 添加命令行参数 --bucket，表示要上传对象的存储空间名称，必需参数
        parser.add_argument('--bucket', help='The name of the bucket.', required=True)
        # 添加命令行参数 --endpoint，表示其他服务可用来访问OSS的域名，非必需参数
        parser.add_argument('--endpoint', help='The domain names that other services can use to access OSS')
        # 添加命令行参数 --key，表示对象（文件）在OSS中的键名，必需参数
        parser.add_argument('--key', help='The name of the object.', required=True)
    
        args = parser.parse_args()
    
        # 配置 OSS 客户端
        credentials_provider = oss.credentials.EnvironmentVariableCredentialsProvider()
        cfg = oss.config.load_default()
        cfg.credentials_provider = credentials_provider
        cfg.region = args.region
        # 如果提供了自定义endpoint，则更新配置对象中的endpoint属性
        if args.endpoint is not None:
            cfg.endpoint = args.endpoint
        
        # 初始化 OSS 客户端
        client = oss.Client(cfg)
    
        # 发送初始化分片上传请求，获取 upload_id
        init_result = client.presign(oss.InitiateMultipartUploadRequest(
            bucket=args.bucket,
            key=args.key,
        ))
    
        # 使用预签名 URL 发起初始化请求并获取 upload_id
        import requests
        with requests.post(init_result.url, headers=init_result.signed_headers) as resp:
            obj = oss.InitiateMultipartUploadResult()
            oss.serde.deserialize_xml(xml_data=resp.content, obj=obj)
            upload_id = obj.upload_id
    
        # 根据文件大小计算分片数量，并生成每个分片的预签名URL
        total_parts = (FILE_SIZE + PART_SIZE - 1) // PART_SIZE
        parts = []
    
        for part_number in range(1, total_parts + 1):
            req = oss.UploadPartRequest(
                bucket=args.bucket,
                key=args.key,
                part_number=part_number,
                upload_id=upload_id,
                expiration_in_seconds=EXPIRE_TIME
            )
            presign_result = client.presign(req)
            parts.append({
                "part_number": part_number,
                "url": presign_result.url,
                "method": "PUT"
            })
    
        # 输出 upload_id 和所有分片的预签名URL（JSON格式）
        output = {
            "upload_id": upload_id,
            "parts": parts
        }
    
        print(json.dumps(output, indent=2))
    
    if __name__ == "__main__":
        main()
    ```
    
3.  **客户端上传分片数据**
    
    客户端使用服务端返回的预签名 URL 列表，通过 HTTP PUT 上传各个分片数据，方式与[上传单个文件](#3d7864c074ncj)相同。全部分片上传完成后，需通知服务端发起合并。
    
    **说明**
    
    支持并发上传，但必须确保：每个 URL 上传的内容是对应位置的分片。即URL 中的 partNumber=N，只能上传文件第 N 个分片，不能混用或跳过。
    
    示例如下，上传第 1 个分片，/path/to/local/file 是本地分片路径。
    
    ```
    curl -X PUT -T /path/to/local/file "https://examplebucket.oss-cn-hangzhou.aliyuncs.com/exampleobject.jpg?partNumber=1&uploadId=BE2D0BC931BE4DE1B23F339AABFA49EE&x-oss-credential=LTAI********************%2F20250520%2Fcn-hangzhou%2Foss%2Faliyun_v4_request&x-oss-date=20250520T082728Z&x-oss-expires=3600&x-oss-signature=81f3d2e5eaa67c432291577ed20af3b3f60df05ab3cddedcdce168ef707f7ad0&x-oss-signature-version=OSS4-HMAC-SHA256"
    ```
    
4.  **（可选）服务端校验已上传分片**
    
    服务端收到“上传完成”通知后，可选择调用 ListParts 接口校验：
    
    -   分片数量是否完整
        
    -   每个分片大小是否符合预期
        
    
    **说明**
    
    该操作使用之前记录的 UploadId。
    
    **示例代码：服务端校验**
    
    ## Java
    
    ```
    import com.aliyun.oss.ClientBuilderConfiguration;
    import com.aliyun.oss.OSS;
    import com.aliyun.oss.OSSClientBuilder;
    import com.aliyun.oss.common.auth.CredentialsProviderFactory;
    import com.aliyun.oss.common.auth.EnvironmentVariableCredentialsProvider;
    import com.aliyun.oss.common.comm.SignVersion;
    import com.aliyun.oss.model.*;
    
    import java.util.ArrayList;
    import java.util.List;
    public class complete {
    
        public static void main(String[] args) throws Exception {
            // OSS服务的访问域名（根据实际Region填写，这里是华东1-杭州）
            String endpoint = "https://oss-cn-hangzhou.aliyuncs.com";
            //替换成您的bucket名称，此处以examplebucket为例
            String bucketName = "examplebucket";
            //替换成您的Object的完整路径，完整路径中不能包含Bucket名称，例如exampledir/exampleobject.jpeg。
            String objectName = "exampleobject.jpeg";
            //分片上传任务ID
            String uploadId = "4B78****************************";
            //替换为您的Region，此处以华东1-杭州为例
            String region = "cn-hangzhou";
    
            // 通过环境变量获取凭证，构造 OSSClient
            EnvironmentVariableCredentialsProvider credentialsProvider = CredentialsProviderFactory.newEnvironmentVariableCredentialsProvider();
            ClientBuilderConfiguration config = new ClientBuilderConfiguration();
            config.setSignatureVersion(SignVersion.V4);
    
            OSS ossClient = OSSClientBuilder.create()
                    .endpoint(endpoint)
                    .region(region)
                    .credentialsProvider(credentialsProvider)
                    .clientConfiguration(config)
                    .build();
    
            try {
                // 列举当前上传任务中已上传的所有分片
                ListPartsRequest listPartsRequest = new ListPartsRequest(bucketName, objectName, uploadId);
                PartListing partListing = ossClient.listParts(listPartsRequest);
    
                // 收集分片的 ETag 信息用于后续合并
                List<PartETag> partETags = new ArrayList<>();
                for (PartSummary part : partListing.getParts()) {
                    partETags.add(new PartETag(part.getPartNumber(), part.getETag()));
                }
    
                if (partETags.isEmpty()) {
                    System.out.println("没有找到已上传的分片，终止合并。");
                    return;
                }
    
                // 提交合并请求，完成分片上传
                System.out.println("开始合并分片...");
                CompleteMultipartUploadRequest completeRequest =
                        new CompleteMultipartUploadRequest(bucketName, objectName, uploadId, partETags);
    
                CompleteMultipartUploadResult result = ossClient.completeMultipartUpload(completeRequest);
                System.out.println("合并分片成功！");
                System.out.println("ETag: " + result.getETag());
    
            } catch (Exception e) {
                System.err.println("合并分片失败: " + e.getMessage());
                e.printStackTrace();
            } finally {
                if (ossClient != null) {
                    ossClient.shutdown();
                }
            }
        }
    }
    ```
    
    ## Go
    
    ```
    package main
    
    import (
    	"context"
    	"flag"
    	"log"
    
    	"github.com/aliyun/alibabacloud-oss-go-sdk-v2/oss"
    	"github.com/aliyun/alibabacloud-oss-go-sdk-v2/oss/credentials"
    )
    
    var (
    	region     string
    	bucketName string
    	objectName string
    	uploadId   string
    )
    
    func init() {
    	flag.StringVar(&region, "region", "", "The region in which the bucket is located.")
    	flag.StringVar(&bucketName, "bucket", "", "The name of the bucket.")
    	flag.StringVar(&objectName, "object", "", "The name of the object.")
    	flag.StringVar(&uploadId, "uploadId", "", "The upload ID.")
    }
    
    func main() {
    	flag.Parse()
    
    	if region == "" || bucketName == "" || objectName == "" || uploadId == "" {
    		flag.PrintDefaults()
    		log.Fatal("Missing required parameters.")
    	}
    
    	cfg := oss.LoadDefaultConfig().
    		WithCredentialsProvider(credentials.NewEnvironmentVariableCredentialsProvider()).
    		WithRegion(region)
    
    	client := oss.NewClient(cfg)
    
    	// 列举已上传分片，构建完整分片列表
    	partListResp, err := client.ListParts(context.TODO(), &oss.ListPartsRequest{
    		Bucket:   oss.Ptr(bucketName),
    		Key:      oss.Ptr(objectName),
    		UploadId: oss.Ptr(uploadId),
    	})
    	if err != nil {
    		log.Fatalf("failed to list parts: %v", err)
    	}
    
    	var parts []oss.UploadPart
    	for _, p := range partListResp.Parts {
    		parts = append(parts, oss.UploadPart{
    			PartNumber: p.PartNumber,
    			ETag:       p.ETag,
    		})
    	}
    
    	// 合并已上传的分片
    	completeResult, err := client.CompleteMultipartUpload(context.TODO(), &oss.CompleteMultipartUploadRequest{
    		Bucket:   oss.Ptr(bucketName),
    		Key:      oss.Ptr(objectName),
    		UploadId: oss.Ptr(uploadId),
    		CompleteMultipartUpload: &oss.CompleteMultipartUpload{
    			Parts: parts,
    		},
    	})
    	if err != nil {
    		log.Fatalf("failed to complete multipart upload: %v", err)
    	}
    
    	// 打印合并结果
    	log.Println("Upload completed successfully.")
    	log.Printf("Bucket:   %s\n", oss.ToString(completeResult.Bucket))
    	log.Printf("Key:      %s\n", oss.ToString(completeResult.Key))
    	log.Printf("ETag:     %s\n", oss.ToString(completeResult.ETag))
    	log.Printf("Status:   %s\n", completeResult.Status)
    }
    ```
    
    ## Python
    
    ```
    # -*- coding: utf-8 -*-
    import argparse
    import alibabacloud_oss_v2 as oss
    
    def main():
        # 创建一个命令行参数解析器，并描述脚本用途
        parser = argparse.ArgumentParser(description="presign multipart upload sample")
        # 添加命令行参数 --region，表示存储空间所在的区域，必需参数
        parser.add_argument('--region', help='The region in which the bucket is located.', required=True)
        # 添加命令行参数 --bucket，表示要上传对象的存储空间名称，必需参数
        parser.add_argument('--bucket', help='The name of the bucket.', required=True)
        # 添加命令行参数 --endpoint，表示其他服务可用来访问OSS的域名，非必需参数
        parser.add_argument('--endpoint', help='The domain names that other services can use to access OSS')
        # 添加命令行参数 --key，表示对象（文件）在OSS中的键名，必需参数
        parser.add_argument('--key', help='The name of the object.', required=True)
        # 添加命令行参数 --upload_id，表示分片上传任务的Upload ID，必需参数
        parser.add_argument('--upload_id', help='The upload ID to list parts for.',required=True)
    
        args = parser.parse_args()
    
        # 初始化客户端配置和凭证
        credentials_provider = oss.credentials.EnvironmentVariableCredentialsProvider()
        cfg = oss.config.load_default()
        cfg.credentials_provider = credentials_provider
        cfg.region = args.region
        if args.endpoint:
            cfg.endpoint = args.endpoint
    
        client = oss.Client(cfg)
    
        try:
            # 获取所有已上传分片
            list_parts_result = client.list_parts(oss.ListPartsRequest(
                bucket=args.bucket,
                key=args.key,
                upload_id=args.upload_id
            ))
    
            # 构造分片列表
            upload_parts = [
                oss.UploadPart(part_number=part.part_number, etag=part.etag)
                for part in list_parts_result.parts
            ]
    
            if not upload_parts:
                print("未找到任何已上传的分片，终止操作。")
                return
    
            # 构造并发送合并请求
            request = oss.CompleteMultipartUploadRequest(
                bucket=args.bucket,
                key=args.key,
                upload_id=args.upload_id,
                complete_multipart_upload=oss.CompleteMultipartUpload(parts=upload_parts)
            )
    
            result = client.complete_multipart_upload(request)
    
            print("合并成功！")
            print(f"ETag: {result.etag}")
            print(f"Bucket: {result.bucket}")
            print(f"Key: {result.key}")
    
        except Exception as e:
            print("合并分片失败:", e)
    
    if __name__ == "__main__":
        main()
    ```
    
5.  **服务端合并分片并返回结果**
    
    校验通过后，服务端调用CompleteMultipartUpload完成文件合并，并将上传结果返回给客户端。
    
    **示例代码：服务端合并分片**
    
    ## Java
    
    ```
    import com.aliyun.oss.ClientBuilderConfiguration;
    import com.aliyun.oss.OSS;
    import com.aliyun.oss.OSSClientBuilder;
    import com.aliyun.oss.common.auth.CredentialsProviderFactory;
    import com.aliyun.oss.common.auth.EnvironmentVariableCredentialsProvider;
    import com.aliyun.oss.common.comm.SignVersion;
    import com.aliyun.oss.model.*;
    
    import java.util.ArrayList;
    import java.util.List;
    public class complete {
    
        public static void main(String[] args) throws Exception {
            // OSS服务的访问域名（根据实际Region填写，这里是华东1-杭州）
            String endpoint = "https://oss-cn-hangzhou.aliyuncs.com";
            //替换成您的bucket名称，此处以examplebucket为例
            String bucketName = "examplebucket";
            //替换成您的Object的完整路径，完整路径中不能包含Bucket名称，例如exampledir/exampleobject.jpeg。
            String objectName = "exampleobject.jpeg";
            //分片上传任务ID
            String uploadId = "4B78****************************";
            //替换为您的Region，此处以华东1-杭州为例
            String region = "cn-hangzhou";
    
            // 通过环境变量获取凭证，构造 OSSClient
            EnvironmentVariableCredentialsProvider credentialsProvider = CredentialsProviderFactory.newEnvironmentVariableCredentialsProvider();
            ClientBuilderConfiguration config = new ClientBuilderConfiguration();
            config.setSignatureVersion(SignVersion.V4);
    
            OSS ossClient = OSSClientBuilder.create()
                    .endpoint(endpoint)
                    .region(region)
                    .credentialsProvider(credentialsProvider)
                    .clientConfiguration(config)
                    .build();
    
            try {
                // 列举当前上传任务中已上传的所有分片
                ListPartsRequest listPartsRequest = new ListPartsRequest(bucketName, objectName, uploadId);
                PartListing partListing = ossClient.listParts(listPartsRequest);
    
                // 收集分片的 ETag 信息用于后续合并
                List<PartETag> partETags = new ArrayList<>();
                for (PartSummary part : partListing.getParts()) {
                    partETags.add(new PartETag(part.getPartNumber(), part.getETag()));
                }
    
                if (partETags.isEmpty()) {
                    System.out.println("没有找到已上传的分片，终止合并。");
                    return;
                }
    
                // 提交合并请求，完成分片上传
                System.out.println("开始合并分片...");
                CompleteMultipartUploadRequest completeRequest =
                        new CompleteMultipartUploadRequest(bucketName, objectName, uploadId, partETags);
    
                CompleteMultipartUploadResult result = ossClient.completeMultipartUpload(completeRequest);
                System.out.println("合并分片成功！");
                System.out.println("ETag: " + result.getETag());
    
            } catch (Exception e) {
                System.err.println("合并分片失败: " + e.getMessage());
                e.printStackTrace();
            } finally {
                if (ossClient != null) {
                    ossClient.shutdown();
                }
            }
        }
    }
    ```
    
    ## Go
    
    ```
    package main
    
    import (
    	"context"
    	"flag"
    	"log"
    
    	"github.com/aliyun/alibabacloud-oss-go-sdk-v2/oss"
    	"github.com/aliyun/alibabacloud-oss-go-sdk-v2/oss/credentials"
    )
    
    var (
    	region     string
    	bucketName string
    	objectName string
    	uploadId   string
    )
    
    func init() {
    	flag.StringVar(&region, "region", "", "The region in which the bucket is located.")
    	flag.StringVar(&bucketName, "bucket", "", "The name of the bucket.")
    	flag.StringVar(&objectName, "object", "", "The name of the object.")
    	flag.StringVar(&uploadId, "uploadId", "", "The upload ID.")
    }
    
    func main() {
    	flag.Parse()
    
    	if region == "" || bucketName == "" || objectName == "" || uploadId == "" {
    		flag.PrintDefaults()
    		log.Fatal("Missing required parameters.")
    	}
    
    	cfg := oss.LoadDefaultConfig().
    		WithCredentialsProvider(credentials.NewEnvironmentVariableCredentialsProvider()).
    		WithRegion(region)
    
    	client := oss.NewClient(cfg)
    
    	// 列举已上传分片，构建完整分片列表
    	partListResp, err := client.ListParts(context.TODO(), &oss.ListPartsRequest{
    		Bucket:   oss.Ptr(bucketName),
    		Key:      oss.Ptr(objectName),
    		UploadId: oss.Ptr(uploadId),
    	})
    	if err != nil {
    		log.Fatalf("failed to list parts: %v", err)
    	}
    
    	var parts []oss.UploadPart
    	for _, p := range partListResp.Parts {
    		parts = append(parts, oss.UploadPart{
    			PartNumber: p.PartNumber,
    			ETag:       p.ETag,
    		})
    	}
    
    	// 合并已上传的分片
    	completeResult, err := client.CompleteMultipartUpload(context.TODO(), &oss.CompleteMultipartUploadRequest{
    		Bucket:   oss.Ptr(bucketName),
    		Key:      oss.Ptr(objectName),
    		UploadId: oss.Ptr(uploadId),
    		CompleteMultipartUpload: &oss.CompleteMultipartUpload{
    			Parts: parts,
    		},
    	})
    	if err != nil {
    		log.Fatalf("failed to complete multipart upload: %v", err)
    	}
    
    	// 打印合并结果
    	log.Println("Upload completed successfully.")
    	log.Printf("Bucket:   %s\n", oss.ToString(completeResult.Bucket))
    	log.Printf("Key:      %s\n", oss.ToString(completeResult.Key))
    	log.Printf("ETag:     %s\n", oss.ToString(completeResult.ETag))
    	log.Printf("Status:   %s\n", completeResult.Status)
    }
    ```
    
    ## Python
    
    ```
    # -*- coding: utf-8 -*-
    import argparse
    import alibabacloud_oss_v2 as oss
    
    def main():
        # 创建一个命令行参数解析器，并描述脚本用途
        parser = argparse.ArgumentParser(description="presign multipart upload sample")
        # 添加命令行参数 --region，表示存储空间所在的区域，必需参数
        parser.add_argument('--region', help='The region in which the bucket is located.', required=True)
        # 添加命令行参数 --bucket，表示要上传对象的存储空间名称，必需参数
        parser.add_argument('--bucket', help='The name of the bucket.', required=True)
        # 添加命令行参数 --endpoint，表示其他服务可用来访问OSS的域名，非必需参数
        parser.add_argument('--endpoint', help='The domain names that other services can use to access OSS')
        # 添加命令行参数 --key，表示对象（文件）在OSS中的键名，必需参数
        parser.add_argument('--key', help='The name of the object.', required=True)
        # 添加命令行参数 --upload_id，表示分片上传任务的Upload ID，必需参数
        parser.add_argument('--upload_id', help='The upload ID to list parts for.',required=True)
    
        args = parser.parse_args()
    
        # 初始化客户端配置和凭证
        credentials_provider = oss.credentials.EnvironmentVariableCredentialsProvider()
        cfg = oss.config.load_default()
        cfg.credentials_provider = credentials_provider
        cfg.region = args.region
        if args.endpoint:
            cfg.endpoint = args.endpoint
    
        client = oss.Client(cfg)
    
        try:
            # 获取所有已上传分片
            list_parts_result = client.list_parts(oss.ListPartsRequest(
                bucket=args.bucket,
                key=args.key,
                upload_id=args.upload_id
            ))
    
            # 构造分片列表
            upload_parts = [
                oss.UploadPart(part_number=part.part_number, etag=part.etag)
                for part in list_parts_result.parts
            ]
    
            if not upload_parts:
                print("未找到任何已上传的分片，终止操作。")
                return
    
            # 构造并发送合并请求
            request = oss.CompleteMultipartUploadRequest(
                bucket=args.bucket,
                key=args.key,
                upload_id=args.upload_id,
                complete_multipart_upload=oss.CompleteMultipartUpload(parts=upload_parts)
            )
    
            result = client.complete_multipart_upload(request)
    
            print("合并成功！")
            print(f"ETag: {result.etag}")
            print(f"Bucket: {result.bucket}")
            print(f"Key: {result.key}")
    
        except Exception as e:
            print("合并分片失败:", e)
    
    if __name__ == "__main__":
        main()
    ```
    

## **设置Header定义上传策略**

您可以在生成预签名URL时，通过指定Header参数定义上传策略。例如，您可以设置文件存储类型`x-oss-storage-class`和文件类型`Content-Type`（如下代码示例）。

**重要**

生成预签名URL时指定了Header参数，实际使用预签名URL上传文件时，也必须传递相同的Header。否则，OSS将因为签名校验失败返回403错误。

关于可设置的OSS系统Header，请参见[PutObject](https://help.aliyun.com/zh/oss/developer-reference/putobject)。您还可以设置自定义Header来管理文件，详情请参见[管理文件元数据](https://help.aliyun.com/zh/oss/user-guide/manage-object-metadata-10/#3cc2d29237cvb)。

1.  文件拥有者生成带Header参数的预签名URL。
    
    ## Java
    
    ```
    import com.aliyun.oss.*;
    import com.aliyun.oss.common.auth.*;
    import com.aliyun.oss.common.comm.SignVersion;
    import com.aliyun.oss.internal.OSSHeaders;
    import com.aliyun.oss.model.GeneratePresignedUrlRequest;
    import com.aliyun.oss.model.StorageClass;
    
    import java.net.URL;
    import java.util.*;
    import java.util.Date;
    
    public class GetSignUrl {
        public static void main(String[] args) throws Throwable {
            // 以华东1（杭州）的外网Endpoint为例，其它Region请按实际情况填写。
            String endpoint = "https://oss-cn-hangzhou.aliyuncs.com";
            // 从环境变量中获取访问凭证。运行本代码示例之前，请确保已设置环境变量OSS_ACCESS_KEY_ID和OSS_ACCESS_KEY_SECRET。
            EnvironmentVariableCredentialsProvider credentialsProvider = CredentialsProviderFactory.newEnvironmentVariableCredentialsProvider();
            // 填写Bucket名称，例如examplebucket。
            String bucketName = "examplebucket";
            // 填写Object完整路径，例如exampleobject.txt。Object完整路径中不能包含Bucket名称。
            String objectName = "exampleobject.txt";
            // 填写Bucket所在地域。以华东1（杭州）为例，Region填写为cn-hangzhou。
            String region = "cn-hangzhou";
    
            // 创建OSSClient实例。
            // 当OSSClient实例不再使用时，调用shutdown方法以释放资源。
            ClientBuilderConfiguration clientBuilderConfiguration = new ClientBuilderConfiguration();
            clientBuilderConfiguration.setSignatureVersion(SignVersion.V4);
            OSS ossClient = OSSClientBuilder.create()
                    .endpoint(endpoint)
                    .credentialsProvider(credentialsProvider)
                    .clientConfiguration(clientBuilderConfiguration)
                    .region(region)
                    .build();
    
            // 设置请求头。
            Map<String, String> headers = new HashMap<String, String>();
            // 指定StorageClass。
            headers.put(OSSHeaders.STORAGE_CLASS, StorageClass.Standard.toString());
            // 指定ContentType。
            headers.put(OSSHeaders.CONTENT_TYPE, "text/plain; charset=utf8");
    
            // 设置用户自定义元数据。
            Map<String, String> userMetadata = new HashMap<String, String>();
            userMetadata.put("key1","value1");
            userMetadata.put("key2","value2");
    
            URL signedUrl = null;
            try {
                // 指定生成的预签名URL过期时间，单位为毫秒。本示例以设置过期时间为1小时为例。
                Date expiration = new Date(new Date().getTime() + 3600 * 1000L);
    
                // 生成预签名URL。
                GeneratePresignedUrlRequest request = new GeneratePresignedUrlRequest(bucketName, objectName, HttpMethod.PUT);
                // 设置过期时间。
                request.setExpiration(expiration);
    
                // 将请求头加入到request中。
                request.setHeaders(headers);
                // 添加用户自定义元数据。
                request.setUserMetadata(userMetadata);
    
                // 通过HTTP PUT请求生成预签名URL。
                signedUrl = ossClient.generatePresignedUrl(request);
                // 打印预签名URL。
                System.out.println("signed url for putObject: " + signedUrl);
    
            } catch (OSSException oe) {
                System.out.println("Caught an OSSException, which means your request made it to OSS, "
                        + "but was rejected with an error response for some reason.");
                System.out.println("Error Message:" + oe.getErrorMessage());
                System.out.println("Error Code:" + oe.getErrorCode());
                System.out.println("Request ID:" + oe.getRequestId());
                System.out.println("Host ID:" + oe.getHostId());
            } catch (ClientException ce) {
                System.out.println("Caught an ClientException, which means the client encountered "
                        + "a serious internal problem while trying to communicate with OSS, "
                        + "such as not being able to access the network.");
                System.out.println("Error Message:" + ce.getMessage());
            }
        }
    }       
    ```
    
    ## Go
    
    ```
    package main
    
    import (
    	"context"
    	"flag"
    	"log"
    	"time"
    
    	"github.com/aliyun/alibabacloud-oss-go-sdk-v2/oss"
    	"github.com/aliyun/alibabacloud-oss-go-sdk-v2/oss/credentials"
    )
    
    // 定义全局变量
    var (
    	region     string // 存储区域
    	bucketName string // 存储空间名称
    	objectName string // 对象名称
    )
    
    // init函数用于初始化命令行参数
    func init() {
    	flag.StringVar(&region, "region", "", "The region in which the bucket is located.")
    	flag.StringVar(&bucketName, "bucket", "", "The name of the bucket.")
    	flag.StringVar(&objectName, "object", "", "The name of the object.")
    }
    
    func main() {
    	// 解析命令行参数
    	flag.Parse()
    
    	// 检查bucket名称是否为空
    	if len(bucketName) == 0 {
    		flag.PrintDefaults()
    		log.Fatalf("invalid parameters, bucket name required")
    	}
    
    	// 检查region是否为空
    	if len(region) == 0 {
    		flag.PrintDefaults()
    		log.Fatalf("invalid parameters, region required")
    	}
    
    	// 检查object名称是否为空
    	if len(objectName) == 0 {
    		flag.PrintDefaults()
    		log.Fatalf("invalid parameters, object name required")
    	}
    
    	// 加载默认配置并设置凭证提供者和区域
    	cfg := oss.LoadDefaultConfig().
    		WithCredentialsProvider(credentials.NewEnvironmentVariableCredentialsProvider()).
    		WithRegion(region)
    
    	// 创建OSS客户端
    	client := oss.NewClient(cfg)
    
    	// 生成PutObject的预签名URL
    	result, err := client.Presign(context.TODO(), &oss.PutObjectRequest{
    		Bucket:      oss.Ptr(bucketName),
    		Key:         oss.Ptr(objectName),
    		ContentType:  oss.Ptr("text/plain;charset=utf8"),                    // 请确保在服务端生成该签名URL时设置的ContentType与在使用URL时设置的ContentType一致
    		StorageClass: oss.StorageClassStandard,                              // 请确保在服务端生成该签名URL时设置的StorageClass与在使用URL时设置的StorageClass一致
    		Metadata:    map[string]string{"key1": "value1", "key2": "value2"}, // 请确保在服务端生成该签名URL时设置的Metadata与在使用URL时设置的Metadata一致
    	},
    		oss.PresignExpires(10*time.Minute),
    	)
    	if err != nil {
    		log.Fatalf("failed to put object presign %v", err)
    	}
    
    	log.Printf("request method:%v\n", result.Method)
    	log.Printf("request expiration:%v\n", result.Expiration)
    	log.Printf("request url:%v\n", result.URL)
    	if len(result.SignedHeaders) > 0 {
    		//当返回结果包含签名头时，使用预签名URL发送Put请求时，需要设置相应的请求头
    		log.Printf("signed headers:\n")
    		for k, v := range result.SignedHeaders {
    			log.Printf("%v: %v\n", k, v)
    		}
    	}
    }
    ```
    
    ## Python
    
    ```
    import argparse
    import requests
    import alibabacloud_oss_v2 as oss
    
    from datetime import datetime, timedelta
    
    # 创建命令行参数解析器，并描述脚本用途：生成对象预签名PUT请求链接（Presign Put Object）
    parser = argparse.ArgumentParser(description="presign put object sample")
    
    # 定义命令行参数，包括必需的区域、存储空间名称、endpoint以及对象键名
    parser.add_argument('--region', help='The region in which the bucket is located.', required=True)
    parser.add_argument('--bucket', help='The name of the bucket.', required=True)
    parser.add_argument('--endpoint', help='The domain names that other services can use to access OSS')
    parser.add_argument('--key', help='The name of the object.', required=True)
    
    def main():
        # 解析命令行参数，获取用户输入的值
        args = parser.parse_args()
    
        # 从环境变量中加载访问凭证信息，用于身份验证
        credentials_provider = oss.credentials.EnvironmentVariableCredentialsProvider()
    
        # 使用SDK默认配置创建配置对象，并设置认证提供者
        cfg = oss.config.load_default()
        cfg.credentials_provider = credentials_provider
    
        # 设置配置对象的区域属性，根据用户提供的命令行参数
        cfg.region = args.region
    
        # 如果提供了自定义endpoint，则更新配置对象中的endpoint属性
        if args.endpoint is not None:
            cfg.endpoint = args.endpoint
    
        # 使用上述配置初始化OSS客户端，准备与OSS交互
        client = oss.Client(cfg)
    
        # 发送请求以生成指定对象的预签名PUT请求
        pre_result = client.presign(oss.PutObjectRequest(
            bucket=args.bucket,  # 存储空间名
            key=args.key,  # 对象键名
            content_type='text/plain;charset=utf8',  # 指定内容类型
            storage_class='Standard',  # 指定存储类型
            metadata={
                'key1': 'value1',   # 指定元数据
                'key2': 'value2'    # 指定元数据
            }
        ),expires=timedelta(seconds=3600)) # 设置过期时间，单位为秒，此处设置为3600秒
    
    
        # 打印预签名请求的方法、过期时间和URL，以便确认预签名链接的有效性
        print(f'method: {pre_result.method},'
              f' expiration: {pre_result.expiration.strftime("%Y-%m-%dT%H:%M:%S.000Z")},'
              f' url: {pre_result.url}'
              )
    
        # 打印预签名请求的已签名头信息，这些信息在发送实际请求时会被包含在HTTP头部
        for key, value in pre_result.signed_headers.items():
            print(f'signed headers key: {key}, signed headers value: {value}')
    
    # 当此脚本被直接执行时，调用main函数开始处理逻辑
    if __name__ == "__main__":
        main()  # 脚本入口点，控制程序流程从这里开始
    ```
    
2.  其他人使用预签名URL上传文件并传递相同Header。
    
    ### curl
    
    ```
    curl -X PUT \
         -H "Content-Type: text/plain;charset=utf8" \
         -H "x-oss-storage-class: Standard" \
         -H "x-oss-meta-key1: value1" \
         -H "x-oss-meta-key2: value2" \
         -T "C:\\Users\\demo.txt" \
         "https://exampleobject.oss-cn-hangzhou.aliyuncs.com/exampleobject.txt?x-oss-date=20241112T083238Z&x-oss-expires=3599&x-oss-signature-version=OSS4-HMAC-SHA256&x-oss-credential=LTAI****************%2F20241112%2Fcn-hangzhou%2Foss%2Faliyun_v4_request&x-oss-signature=ed5a******************************************************"
    ```
    
    ### Java
    
    ```
    package com.aliyun.sample;
    
    import com.aliyun.oss.internal.OSSHeaders;
    import com.aliyun.oss.model.StorageClass;
    import org.apache.http.HttpEntity;
    import org.apache.http.client.methods.CloseableHttpResponse;
    import org.apache.http.client.methods.HttpPut;
    import org.apache.http.entity.FileEntity;
    import org.apache.http.impl.client.CloseableHttpClient;
    import org.apache.http.impl.client.HttpClients;
    import java.io.*;
    import java.net.URL;
    import java.util.*;
    
    public class SignUrlUpload {
        public static void main(String[] args) throws Throwable {
            CloseableHttpClient httpClient = null;
            CloseableHttpResponse response = null;
    
            // 将<signedUrl>替换为授权URL。
            URL signedUrl = new URL("<signedUrl>");
    
            // 填写本地文件的完整路径。如果未指定本地路径，则默认从示例程序所属项目对应本地路径中上传文件。
            String pathName = "C:\\Users\\demo.txt";
    
            // 设置请求头，这里的请求头信息需要与生成URL时的信息一致。
            Map<String, String> headers = new HashMap<String, String>();
            //指定Object的存储类型。
            headers.put(OSSHeaders.STORAGE_CLASS, StorageClass.Standard.toString());
            //指定ContentType。
            headers.put(OSSHeaders.CONTENT_TYPE, "text/plain;charset=utf8");
    
            // 设置用户自定义元数据，这里的用户自定义元数据需要与生成URL时的信息一致。
            Map<String, String> userMetadata = new HashMap<String, String>();
            userMetadata.put("key1","value1");
            userMetadata.put("key2","value2");
    
            try {
                HttpPut put = new HttpPut(signedUrl.toString());
                System.out.println(put);
                HttpEntity entity = new FileEntity(new File(pathName));
                put.setEntity(entity);
                // 如果生成预签名URL时设置了header参数，例如用户元数据，存储类型等，则调用预签名URL上传文件时，也需要将这些参数发送至服务端。如果签名和发送至服务端的不一致，会报签名错误。
                for(Map.Entry<String, String> header: headers.entrySet()){
                    put.addHeader(header.getKey(), header.getValue());
                }
                for(Map.Entry<String, String> meta: userMetadata.entrySet()){
                    // 如果使用userMeta，sdk内部会为userMeta拼接"x-oss-meta-"前缀。当您使用其他方式生成预签名URL进行上传时，userMeta也需要拼接"x-oss-meta-"前缀。
                    put.addHeader("x-oss-meta-"+meta.getKey(), meta.getValue());
                }
    
                httpClient = HttpClients.createDefault();
    
                response = httpClient.execute(put);
    
                System.out.println("返回上传状态码："+response.getStatusLine().getStatusCode());
                if(response.getStatusLine().getStatusCode() == 200){
                    System.out.println("使用网络库上传成功");
                }
                System.out.println(response.toString());
            } catch (Exception e){
                e.printStackTrace();
            } finally {
                if (response != null) {
                    response.close();
                }
                if (httpClient != null) {
                    httpClient.close();
                }
            }
        }
    }
    ```
    
    ### Go
    
    ```
    package main
    
    import (
    	"bytes"
    	"fmt"
    	"io/ioutil"
    	"net/http"
    	"os"
    )
    
    func uploadFile(signedUrl string, filePath string, headers map[string]string, metadata map[string]string) error {
    	// 打开文件
    	file, err := os.Open(filePath)
    	if err != nil {
    		return err
    	}
    	defer file.Close()
    
    	// 读取文件内容
    	fileBytes, err := ioutil.ReadAll(file)
    	if err != nil {
    		return err
    	}
    
    	// 创建请求
    	req, err := http.NewRequest("PUT", signedUrl, bytes.NewBuffer(fileBytes))
    	if err != nil {
    		return err
    	}
    
    	// 设置请求头
    	for key, value := range headers {
    		req.Header.Set(key, value)
    	}
    
    	// 设置用户自定义元数据
    	for key, value := range metadata {
    		req.Header.Set(fmt.Sprintf("x-oss-meta-%s", key), value)
    	}
    
    	// 发送请求
    	client := &http.Client{}
    	resp, err := client.Do(req)
    	if err != nil {
    		return err
    	}
    	defer resp.Body.Close()
    
    	// 处理响应
    	fmt.Printf("返回上传状态码：%d\n", resp.StatusCode)
    	if resp.StatusCode == 200 {
    		fmt.Println("使用网络库上传成功")
    	} else {
    		fmt.Println("上传失败")
    	}
    	body, _ := ioutil.ReadAll(resp.Body)
    	fmt.Println(string(body))
    
    	return nil
    }
    
    func main() {
    	// 将<signedUrl>替换为授权URL。
    	signedUrl := "<signedUrl>"
    
    	// 填写本地文件的完整路径。如果未指定本地路径，则默认从示例程序所属项目对应本地路径中上传文件。
    	filePath := "C:\\Users\\demo.txt"
    
    	// 设置请求头，这里的请求头信息需要与生成URL时的信息一致。
    	headers := map[string]string{
    		"Content-Type": "text/plain;charset=utf8",
    		"x-oss-storage-class": "Standard",
    	}
    
    	// 设置用户自定义元数据，这里的用户自定义元数据需要与生成URL时的信息一致。
    	metadata := map[string]string{
    		"key1": "value1",
    		"key2": "value2",
    	}
    
    	err := uploadFile(signedUrl, filePath, headers, metadata)
    	if err != nil {
    		fmt.Printf("发生错误：%v\n", err)
    	}
    }
    ```
    
    ### Python
    
    ```
    import requests
    from requests.auth import HTTPBasicAuth
    import os
    
    def upload_file(signed_url, file_path, headers=None, metadata=None):
        """
        使用预签名的URL上传文件到OSS。
    
        :param signed_url: 预签名的URL。
        :param file_path: 要上传的文件的完整路径。
        :param headers: 可选，自定义HTTP头部。
        :param metadata: 可选，自定义元数据。
        :return: None
        """
        if not headers:
            headers = {}
        if not metadata:
            metadata = {}
    
        # 更新headers，添加元数据前缀
        for key, value in metadata.items():
            headers[f'x-oss-meta-{key}'] = value
    
        try:
            with open(file_path, 'rb') as file:
                response = requests.put(signed_url, data=file, headers=headers)
                print(f"返回上传状态码：{response.status_code}")
                if response.status_code == 200:
                    print("使用网络库上传成功")
                else:
                    print("上传失败")
                print(response.text)
        except Exception as e:
            print(f"发生错误：{e}")
    
    if __name__ == "__main__":
        # 将<signedUrl>替换为授权URL。
        signed_url = "<signedUrl>"
       
        # 填写本地文件的完整路径。如果未指定本地路径，则默认从脚本所在目录中上传文件。
        file_path = "C:\\Users\\demo.txt"
    
        # 设置请求头，这里的请求头信息需要与生成URL时的信息一致。
        headers = {
             "Content-Type": "text/plain;charset=utf8",
             "x-oss-storage-class": "Standard"
        }
    
        # 设置用户自定义元数据，这里的用户自定义元数据需要与生成URL时的信息一致。
        metadata = {
             "key1": "value1",
             "key2": "value2"
        }
    
        upload_file(signed_url, file_path, headers, metadata)
    ```
    
    ### Node.js
    
    ```
    const fs = require('fs');
    const axios = require('axios');
    
    async function uploadFile(signedUrl, filePath, headers = {}, metadata = {}) {
        try {
            // 更新headers，添加元数据前缀
            for (const [key, value] of Object.entries(metadata)) {
                headers[`x-oss-meta-${key}`] = value;
            }
    
            // 读取文件流
            const fileStream = fs.createReadStream(filePath);
    
            // 发送PUT请求
            const response = await axios.put(signedUrl, fileStream, {
                headers: headers
            });
    
            console.log(`返回上传状态码：${response.status}`);
            if (response.status === 200) {
                console.log("使用网络库上传成功");
            } else {
                console.log("上传失败");
            }
            console.log(response.data);
        } catch (error) {
            console.error(`发生错误：${error.message}`);
        }
    }
    
    // 主函数
    (async () => {
        // 将<signedUrl>替换为授权URL。
        const signedUrl = "<signedUrl>";
    
        // 填写本地文件的完整路径。如果未指定本地路径，则默认从脚本所在目录中上传文件。
        const filePath = "C:\\Users\\demo.txt";
    
        // 设置请求头，这里的请求头信息需要与生成URL时的信息一致。
        const headers = {
             "Content-Type": "text/plain;charset=utf8",
             "x-oss-storage-class": "Standard"
        };
    
        // 设置用户自定义元数据，这里的用户自定义元数据需要与生成URL时的信息一致。
        const metadata = {
             "key1": "value1",
             "key2": "value2"
        };
    
        await uploadFile(signedUrl, filePath, headers, metadata);
    })();
    ```
    
    ### Browser.js
    
    **重要**
    
    如果您使用 Browser.js 上传文件时遇到 403 签名不匹配错误，通常是因为浏览器会自动添加 Content-Type 请求头，而生成预签名 URL 时未指定该请求头，导致签名验证失败。为解决此问题，您需要在生成预签名 URL 时指定 Content-Type 请求头。
    
    ```
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>File Upload Example</title>
    </head>
    <body>
        <h1>File Upload Example（Java SDK）</h1>
    
        <input type="file" id="fileInput" />
        <button id="uploadButton">Upload File</button>
    
        <script>
            // 请替换为实际的预签名URL
            const signedUrl = "<signedUrl>"; 
    
            document.getElementById('uploadButton').addEventListener('click', async () => {
                const fileInput = document.getElementById('fileInput');
                const file = fileInput.files[0];
    
                if (file) {
                    try {
                        await upload(file, signedUrl);
                    } catch (error) {
                        console.error('Error during upload:', error);
                        alert('Upload failed: ' + error.message);
                    }
                } else {
                    alert('Please select a file to upload.');
                }
            });
    
            const upload = async (file, presignedUrl) => {
                const headers = {
                    "Content-Type": "text/plain;charset=utf8",
                    'x-oss-storage-class': 'Standard',
                    'x-oss-meta-key1': 'value1',
                    'x-oss-meta-key2': 'value2'
                };
    
                const response = await fetch(presignedUrl, {
                    method: 'PUT',
                    headers: headers,
                    body: file
                });
    
                if (!response.ok) {
                    throw new Error(`Upload failed, status: ${response.status}`);
                }
    
                alert('File uploaded successfully');
                console.log('File uploaded successfully');
            };
        </script>
    </body>
    </html>
    ```
    
    ### C#
    
    ```
    using System.Net.Http.Headers;
    
    // 填写本地文件的完整路径。如果未指定本地路径，则默认从示例程序所属项目对应本地路径中上传文件
    var filePath = "C:\\Users\\demo.txt";
    // 将<signedUrl>替换为授权URL
    var presignedUrl = "<signedUrl>";
    
    // 创建HTTP客户端并打开本地文件流
    using var httpClient = new HttpClient(); 
    using var fileStream = new FileStream(filePath, FileMode.Open, FileAccess.Read);
    using var content = new StreamContent(fileStream);
                
    // 创建PUT请求
    var request = new HttpRequestMessage(HttpMethod.Put, presignedUrl);
    request.Content = content;
    
    // 如果生成预签名URL时设置了header参数，例如用户元数据，存储类型等，则调用预签名URL上传文件时，也需要将这些参数发送至服务端。如果签名和发送至服务端的不一致，会报签名错误。
    // 设置请求头，这里的请求头信息需要与生成URL时的信息一致
    request.Content.Headers.ContentType = new MediaTypeHeaderValue("text/plain") { CharSet = "utf8" };  // 指定ContentType       
    // 设置用户自定义元数据，这里的用户自定义元数据需要与生成URL时的信息一致。
    request.Content.Headers.Add("x-oss-meta-key1", "value1");
    request.Content.Headers.Add("x-oss-meta-key2", "value2");
    // 指定Object的存储类型
    request.Content.Headers.Add("x-oss-storage-class", "Standard");
    
    // 输出请求头部
    Console.WriteLine("请求头部:");
    foreach (var header in request.Content.Headers)
    {
        Console.WriteLine($"{header.Key}: {string.Join(", ", header.Value)}");
    }
    
    // 发送请求
    var response = await httpClient.SendAsync(request);
    
    // 处理响应
    if (response.IsSuccessStatusCode)
    {
        Console.WriteLine($"上传成功！状态码: {response.StatusCode}");
        Console.WriteLine("响应头部:");
        foreach (var header in response.Headers)
        {
            Console.WriteLine($"{header.Key}: {string.Join(", ", header.Value)}");
        }
    }
    else
    {
        string responseContent = await response.Content.ReadAsStringAsync();
        Console.WriteLine($"上传失败！状态码: {response.StatusCode}");
        Console.WriteLine("响应内容: " + responseContent);
    }
    ```
    
    ### C++
    
    ```
    #include <iostream>
    #include <fstream>
    #include <curl/curl.h>
    #include <map>
    #include <string>
    
    // 回调函数，用于处理HTTP响应
    size_t WriteCallback(void* contents, size_t size, size_t nmemb, std::string* output) {
        size_t totalSize = size * nmemb;
        output->append((char*)contents, totalSize);
        return totalSize;
    }
    
    void uploadFile(const std::string& signedUrl, const std::string& filePath, const std::map<std::string, std::string>& headers, const std::map<std::string, std::string>& metadata) {
        CURL* curl;
        CURLcode res;
        std::string readBuffer;
    
        curl_global_init(CURL_GLOBAL_DEFAULT);
        curl = curl_easy_init();
    
        if (curl) {
            // 设置URL
            curl_easy_setopt(curl, CURLOPT_URL, signedUrl.c_str());
    
            // 设置请求方法为PUT
            curl_easy_setopt(curl, CURLOPT_UPLOAD, 1L);
    
            // 打开文件
            FILE* file = fopen(filePath.c_str(), "rb");
            if (!file) {
                std::cerr << "无法打开文件: " << filePath << std::endl;
                return;
            }
    
            // 设置文件大小
            fseek(file, 0, SEEK_END);
            long fileSize = ftell(file);
            rewind(file);
    
            // 设置文件读取回调
            curl_easy_setopt(curl, CURLOPT_READDATA, file);
            curl_easy_setopt(curl, CURLOPT_INFILESIZE_LARGE, (curl_off_t)fileSize);
    
            // 设置请求头
            struct curl_slist* chunk = nullptr;
            for (const auto& header : headers) {
                std::string headerStr = header.first + ": " + header.second;
                chunk = curl_slist_append(chunk, headerStr.c_str());
            }
            for (const auto& meta : metadata) {
                std::string metaStr = "x-oss-meta-" + meta.first + ": " + meta.second;
                chunk = curl_slist_append(chunk, metaStr.c_str());
            }
            curl_easy_setopt(curl, CURLOPT_HTTPHEADER, chunk);
    
            // 设置响应处理回调
            curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
            curl_easy_setopt(curl, CURLOPT_WRITEDATA, &readBuffer);
    
            // 执行请求
            res = curl_easy_perform(curl);
    
            // 检查响应
            if (res != CURLE_OK) {
                std::cerr << "curl_easy_perform() failed: " << curl_easy_strerror(res) << std::endl;
            } else {
                long responseCode;
                curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &responseCode);
                std::cout << "返回上传状态码: " << responseCode << std::endl;
                if (responseCode == 200) {
                    std::cout << "使用网络库上传成功" << std::endl;
                } else {
                    std::cout << "上传失败" << std::endl;
                }
                std::cout << readBuffer << std::endl;
            }
    
            // 清理
            fclose(file);
            curl_slist_free_all(chunk);
            curl_easy_cleanup(curl);
        }
    
        curl_global_cleanup();
    }
    
    int main() {
        // 将<signedUrl>替换为授权URL。
        std::string signedUrl = "<signedUrl>";
    
        // 填写本地文件的完整路径。如果未指定本地路径，则默认从示例程序所属项目对应本地路径中上传文件。
        std::string filePath = "C:\\Users\\demo.txt";
    
        // 设置请求头，这里的请求头信息需要与生成URL时的信息一致。
        std::map<std::string, std::string> headers = {
             {"Content-Type", "text/plain;charset=utf8"},
             {"x-oss-storage-class", "Standard"}
        };
    
        // 设置用户自定义元数据，这里的用户自定义元数据需要与生成URL时的信息一致。
        std::map<std::string, std::string> metadata = {
             {"key1", "value1"},
             {"key2", "value2"}
        };
    
        uploadFile(signedUrl, filePath, headers, metadata);
    
        return 0;
    }
    ```
    
    ### Android
    
    ```
    import android.os.AsyncTask;
    import android.util.Log;
    
    import java.io.DataOutputStream;
    import java.io.File;
    import java.io.FileInputStream;
    import java.io.IOException;
    import java.io.InputStream;
    import java.net.HttpURLConnection;
    import java.net.URL;
    import java.util.HashMap;
    import java.util.Map;
    import java.util.Map.Entry;
    
    public class SignUrlUploadActivity extends AppCompatActivity {
    
        private static final String TAG = "SignUrlUploadActivity";
    
        @Override
        protected void onCreate(Bundle savedInstanceState) {
            super.onCreate(savedInstanceState);
            setContentView(R.layout.activity_main);
    
            // 将<signedUrl>替换为授权URL。
            String signedUrl = "<signedUrl>";
    
            // 填写本地文件的完整路径。如果未指定本地路径，则默认从示例程序所属项目对应本地路径中上传文件。
            String pathName = "/storage/emulated/0/demo.txt";
    
            // 设置请求头，这里的请求头信息需要与生成URL时的信息一致。
            Map<String, String> headers = new HashMap<>();
            headers.put("Content-Type", "text/plain;charset=utf8");
            headers.put("x-oss-storage-class", "Standard");
    
            // 设置用户自定义元数据，这里的用户自定义元数据需要与生成URL时的信息一致。
            Map<String, String> userMetadata = new HashMap<>();
            userMetadata.put("key1", "value1");
            userMetadata.put("key2", "value2");
    
            new UploadTask().execute(signedUrl, pathName, headers, userMetadata);
        }
    
        private class UploadTask extends AsyncTask<Object, Void, Integer> {
            @Override
            protected Integer doInBackground(Object... params) {
                String signedUrl = (String) params[0];
                String pathName = (String) params[1];
                Map<String, String> headers = (Map<String, String>) params[2];
                Map<String, String> userMetadata = (Map<String, String>) params[3];
    
                try {
                    URL url = new URL(signedUrl);
                    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                    connection.setRequestMethod("PUT");
                    connection.setDoOutput(true);
                    connection.setUseCaches(false);
    
                    // 设置请求头
                    for (Entry<String, String> header : headers.entrySet()) {
                        connection.setRequestProperty(header.getKey(), header.getValue());
                    }
    
                    // 设置用户自定义元数据
                    for (Entry<String, String> meta : userMetadata.entrySet()) {
                        connection.setRequestProperty("x-oss-meta-" + meta.getKey(), meta.getValue());
                    }
    
                    // 读取文件
                    File file = new File(pathName);
                    FileInputStream fileInputStream = new FileInputStream(file);
                    DataOutputStream dos = new DataOutputStream(connection.getOutputStream());
    
                    byte[] buffer = new byte[1024];
                    int count;
                    while ((count = fileInputStream.read(buffer)) != -1) {
                        dos.write(buffer, 0, count);
                    }
    
                    fileInputStream.close();
                    dos.flush();
                    dos.close();
    
                    // 获取响应
                    int responseCode = connection.getResponseCode();
                    Log.d(TAG, "返回上传状态码：" + responseCode);
                    if (responseCode == 200) {
                        Log.d(TAG, "使用网络库上传成功");
                    } else {
                        Log.d(TAG, "上传失败");
                    }
    
                    InputStream is = connection.getInputStream();
                    byte[] responseBuffer = new byte[1024];
                    StringBuilder responseStringBuilder = new StringBuilder();
                    while ((count = is.read(responseBuffer)) != -1) {
                        responseStringBuilder.append(new String(responseBuffer, 0, count));
                    }
                    Log.d(TAG, responseStringBuilder.toString());
    
                    return responseCode;
                } catch (IOException e) {
                    e.printStackTrace();
                    return -1;
                }
            }
    
            @Override
            protected void onPostExecute(Integer result) {
                super.onPostExecute(result);
                if (result == 200) {
                    Toast.makeText(SignUrlUploadActivity.this, "上传成功", Toast.LENGTH_SHORT).show();
                } else {
                    Toast.makeText(SignUrlUploadActivity.this, "上传失败", Toast.LENGTH_SHORT).show();
                }
            }
        }
    }
    ```
    

## **设置上传回调**

上传时，您可以添加回调参数，让文件上传成功后自动通知应用服务器。回调的详细原理，请参见 [Callback](https://help.aliyun.com/zh/oss/developer-reference/callback)。

1.  文件拥有者生成携带上传回调参数的PUT方法的预签名URL。
    
    ## Python
    
    ```
    import argparse
    import base64
    import requests
    import alibabacloud_oss_v2 as oss
    
    from datetime import datetime, timedelta
    
    # 创建命令行参数解析器，并描述脚本用途：生成对象预签名PUT请求链接（Presign Put Object）
    parser = argparse.ArgumentParser(description="presign put object sample")
    
    # 定义命令行参数，包括必需的区域、存储空间名称、endpoint以及对象键名
    parser.add_argument('--region', help='The region in which the bucket is located.', required=True)
    parser.add_argument('--bucket', help='The name of the bucket.', required=True)
    parser.add_argument('--endpoint', help='The domain names that other services can use to access OSS')
    parser.add_argument('--key', help='The name of the object.', required=True)
    
    def main():
        # 解析命令行参数，获取用户输入的值
        args = parser.parse_args()
    
        # 从环境变量中加载访问凭证信息，用于身份验证
        credentials_provider = oss.credentials.EnvironmentVariableCredentialsProvider()
    
        # 使用SDK默认配置创建配置对象，并设置认证提供者
        cfg = oss.config.load_default()
        cfg.credentials_provider = credentials_provider
    
        # 设置配置对象的区域属性，根据用户提供的命令行参数
        cfg.region = args.region
    
        # 如果提供了自定义endpoint，则更新配置对象中的endpoint属性
        if args.endpoint is not None:
            cfg.endpoint = args.endpoint
    
        # 使用上述配置初始化OSS客户端，准备与OSS交互
        client = oss.Client(cfg)
    
        # 请填写您的自定义回调地址
        call_back_url = "http://www.example.com/callback"
        # 构造回调参数（callback）：指定回调地址和回调请求体，使用 Base64 编码
        callback=base64.b64encode(str('{\"callbackUrl\":\"' + call_back_url + '\",\"callbackBody\":\"bucket=${bucket}&object=${object}&my_var_1=${x:var1}&my_var_2=${x:var2}\"}').encode()).decode()
        # 构造自定义变量（callback-var），使用 Base64 编码
        callback_var=base64.b64encode('{\"x:var1\":\"value1\",\"x:var2\":\"value2\"}'.encode()).decode()
    
        # 发送请求以生成指定对象的预签名PUT请求
        pre_result = client.presign(oss.PutObjectRequest(
            bucket=args.bucket,  # 存储空间名
            key=args.key,  # 对象键名
            callback=callback,
            callback_var=callback_var,
        ),expires=timedelta(seconds=3600)) # 设置过期时间，单位为秒，此处设置为3600秒
    
        # 打印预签名请求的方法、过期时间和URL，以便确认预签名链接的有效性
        print(f'method: {pre_result.method},'
              f' expiration: {pre_result.expiration.strftime("%Y-%m-%dT%H:%M:%S.000Z")},'
              f' url: {pre_result.url}'
              )
    
        # 打印预签名请求的已签名头信息，这些信息在发送实际请求时会被包含在HTTP头部
        for key, value in pre_result.signed_headers.items():
            print(f'signed headers key: {key}, signed headers value: {value}')
    
    # 当此脚本被直接执行时，调用main函数开始处理逻辑
    if __name__ == "__main__":
        main()  # 脚本入口点，控制程序流程从这里开始
    ```
    
    ## Go
    
    ```
    package main
    
    import (
    	"context"
    	"encoding/base64"
    	"encoding/json"
    	"flag"
    	"log"
    	"time"
    
    	"github.com/aliyun/alibabacloud-oss-go-sdk-v2/oss"
    	"github.com/aliyun/alibabacloud-oss-go-sdk-v2/oss/credentials"
    )
    
    // 定义全局变量
    var (
    	region     string // 存储区域
    	bucketName string // 存储空间名称
    	objectName string // 对象名称
    )
    
    // init函数用于初始化命令行参数
    func init() {
    	flag.StringVar(&region, "region", "", "The region in which the bucket is located.")
    	flag.StringVar(&bucketName, "bucket", "", "The name of the bucket.")
    	flag.StringVar(&objectName, "object", "", "The name of the object.")
    }
    
    func main() {
    	// 解析命令行参数
    	flag.Parse()
    
    	// 检查bucket名称是否为空
    	if len(bucketName) == 0 {
    		flag.PrintDefaults()
    		log.Fatalf("invalid parameters, bucket name required")
    	}
    
    	// 检查region是否为空
    	if len(region) == 0 {
    		flag.PrintDefaults()
    		log.Fatalf("invalid parameters, region required")
    	}
    
    	// 检查object名称是否为空
    	if len(objectName) == 0 {
    		flag.PrintDefaults()
    		log.Fatalf("invalid parameters, object name required")
    	}
    
    	// 加载默认配置并设置凭证提供者和区域
    	cfg := oss.LoadDefaultConfig().
    		WithCredentialsProvider(credentials.NewEnvironmentVariableCredentialsProvider()).
    		WithRegion(region)
    
    	// 创建OSS客户端
    	client := oss.NewClient(cfg)
    
    	// 定义回调参数
    	callbackMap := map[string]string{
    		"callbackUrl":      "http://example.com:23450",                                                                   // 设置回调服务器的URL，例如https://example.com:23450。
    		"callbackBody":     "bucket=${bucket}&object=${object}&size=${size}&my_var_1=${x:my_var1}&my_var_2=${x:my_var2}", // 设置回调请求体。
    		"callbackBodyType": "application/x-www-form-urlencoded",                                                          //设置回调请求体类型。
    	}
    
    	// 将回调参数转换为JSON并进行Base64编码，以便将其作为回调参数传递
    	callbackStr, err := json.Marshal(callbackMap)
    	if err != nil {
    		log.Fatalf("failed to marshal callback map: %v", err)
    	}
    	callbackBase64 := base64.StdEncoding.EncodeToString(callbackStr)
    
    	callbackVarMap := map[string]string{}
    	callbackVarMap["x:my_var1"] = "this is var 1"
    	callbackVarMap["x:my_var2"] = "this is var 2"
    	callbackVarStr, err := json.Marshal(callbackVarMap)
    	if err != nil {
    		log.Fatalf("failed to marshal callback var: %v", err)
    	}
    	callbackVarBase64 := base64.StdEncoding.EncodeToString(callbackVarStr)
    
    	// 生成PutObject的预签名URL
    	result, err := client.Presign(context.TODO(), &oss.PutObjectRequest{
    		Bucket:      oss.Ptr(bucketName),
    		Key:         oss.Ptr(objectName),
    		Callback:    oss.Ptr(callbackBase64),    // 设置回调参数，此处为Base64编码后的JSON字符串
    		CallbackVar: oss.Ptr(callbackVarBase64), // 设置自定义回调参数，此处为Base64编码后的JSON字符串
    	},
    		oss.PresignExpires(10*time.Minute),
    	)
    	if err != nil {
    		log.Fatalf("failed to put object presign %v", err)
    	}
    
    	log.Printf("request method:%v\n", result.Method)
    	log.Printf("request expiration:%v\n", result.Expiration)
    	log.Printf("request url:%v\n", result.URL)
    	if len(result.SignedHeaders) > 0 {
    		//当返回结果包含签名头时，使用签名URL发送Put请求时，需要设置相应的请求头
    		log.Printf("signed headers:\n")
    		for k, v := range result.SignedHeaders {
    			log.Printf("%v: %v\n", k, v)
    		}
    	}
    }
    ```
    
    ## Java
    
    ```
    import com.aliyun.oss.*;
    import com.aliyun.oss.common.auth.CredentialsProviderFactory;
    import com.aliyun.oss.common.auth.EnvironmentVariableCredentialsProvider;
    import com.aliyun.oss.common.comm.SignVersion;
    import com.aliyun.oss.internal.OSSHeaders;
    import com.aliyun.oss.model.GeneratePresignedUrlRequest;
    
    import java.net.URL;
    import java.text.SimpleDateFormat;
    import java.util.*;
    
    public class OssPresignExample {
        public static void main(String[] args) throws Throwable {
            // 以华东1（杭州）的外网Endpoint为例，其它Region请按实际情况填写。
            String endpoint = "https://oss-cn-hangzhou.aliyuncs.com";
            // 从环境变量中获取访问凭证。运行本代码示例之前，请确保已设置环境变量OSS_ACCESS_KEY_ID和OSS_ACCESS_KEY_SECRET。
            EnvironmentVariableCredentialsProvider credentialsProvider = CredentialsProviderFactory.newEnvironmentVariableCredentialsProvider();
            // 填写Bucket名称，例如examplebucket。
            String bucketName = "examplebucket";
            // 填写Object完整路径，例如exampleobject.txt。Object完整路径中不能包含Bucket名称。
            String objectName = "exampleobject.txt";
            // 填写Bucket所在地域。以华东1（杭州）为例，Region填写为cn-hangzhou。
            String region = "cn-hangzhou";
    
            // 创建OSSClient实例。
            // 当OSSClient实例不再使用时，调用shutdown方法以释放资源。
            ClientBuilderConfiguration clientBuilderConfiguration = new ClientBuilderConfiguration();
            clientBuilderConfiguration.setSignatureVersion(SignVersion.V4);
            OSS ossClient = OSSClientBuilder.create()
                    .endpoint(endpoint)
                    .credentialsProvider(credentialsProvider)
                    .clientConfiguration(clientBuilderConfiguration)
                    .region(region)
                    .build();
    
            URL signedUrl = null;
            try {
                // 构造回调参数
                String callbackUrl = "http://www.example.com/callback";
                String callbackBody = "{\"callbackUrl\":\"" + callbackUrl + "\",\"callbackBody\":\"bucket=${bucket}&object=${object}&my_var_1=${x:var1}&my_var_2=${x:var2}\"}";
                String callbackBase64 = Base64.getEncoder().encodeToString(callbackBody.getBytes());
    
                String callbackVarJson = "{\"x:var1\":\"value1\",\"x:var2\":\"value2\"}";
                String callbackVarBase64 = Base64.getEncoder().encodeToString(callbackVarJson.getBytes());
                // 设置请求头。
                Map<String, String> headers = new HashMap<String, String>();
                // 指定CALLBACK。
                headers.put(OSSHeaders.OSS_HEADER_CALLBACK, callbackBase64);
                // 指定CALLBACK-VAR。
                headers.put(OSSHeaders.OSS_HEADER_CALLBACK_VAR, callbackVarBase64);
    
                // 设置过期时间（3600秒后）
                Date expiration = new Date(new Date().getTime() + 3600 * 1000);
    
                // 格式化过期时间
                SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
                dateFormat.setTimeZone(TimeZone.getTimeZone("UTC"));
                String expirationStr = dateFormat.format(expiration);
    
                // 构造请求
                GeneratePresignedUrlRequest request = new GeneratePresignedUrlRequest(bucketName, objectName);
                request.setMethod(HttpMethod.PUT);
                request.setExpiration(expiration);
                // 将请求头加入到request中。
                request.setHeaders(headers);
    
                //打印callback参数和callback-var参数
                System.out.println("callback:"+callbackBase64);
                System.out.println("callback-var:"+callbackVarBase64);
    
                // 生成预签名URL
                URL url = ossClient.generatePresignedUrl(request);
    
                // 输出结果
                System.out.println("method: PUT,");
                System.out.println(" expiration: " + expirationStr + ",");
                System.out.println(" url: " + url);
    
            } catch (OSSException oe) {
                System.out.println("Caught an OSSException, which means your request made it to OSS, "
                        + "but was rejected with an error response for some reason.");
                System.out.println("Error Message:" + oe.getErrorMessage());
                System.out.println("Error Code:" + oe.getErrorCode());
                System.out.println("Request ID:" + oe.getRequestId());
                System.out.println("Host ID:" + oe.getHostId());
            } catch (ClientException ce) {
                System.out.println("Caught an ClientException, which means the client encountered "
                        + "a serious internal problem while trying to communicate with OSS, "
                        + "such as not being able to access the network.");
                System.out.println("Error Message:" + ce.getMessage());
            }
        }
    }
    ```
    
    ## PHP
    
    ```
    <?php
    
    // 引入自动加载文件，确保依赖库能够正确加载
    require_once __DIR__ . '/../vendor/autoload.php';
    
    use AlibabaCloud\Oss\V2 as Oss;
    
    // 定义命令行参数的描述信息
    $optsdesc = [
        "region" => ['help' => 'The region in which the bucket is located.', 'required' => True], // Bucket所在的地域（必填）
        "endpoint" => ['help' => 'The domain names that other services can use to access OSS.', 'required' => False], // 访问域名（可选）
        "bucket" => ['help' => 'The name of the bucket', 'required' => True], // Bucket名称（必填）
        "key" => ['help' => 'The name of the object', 'required' => True], // 对象名称（必填）
    ];
    
    // 将参数描述转换为getopt所需的长选项格式
    // 每个参数后面加上":"表示该参数需要值
    $longopts = \array_map(function ($key) {
        return "$key:";
    }, array_keys($optsdesc));
    
    // 解析命令行参数
    $options = getopt("", $longopts);
    
    // 验证必填参数是否存在
    foreach ($optsdesc as $key => $value) {
        if ($value['required'] === True && empty($options[$key])) {
            $help = $value['help']; // 获取参数的帮助信息
            echo "Error: the following arguments are required: --$key, $help" . PHP_EOL;
            exit(1); // 如果必填参数缺失，则退出程序
        }
    }
    
    // 从解析的参数中提取值
    $region = $options["region"]; // Bucket所在的地域
    $bucket = $options["bucket"]; // Bucket名称
    $key = $options["key"];       // 对象名称
    
    // 加载环境变量中的凭证信息
    // 使用EnvironmentVariableCredentialsProvider从环境变量中读取Access Key ID和Access Key Secret
    $credentialsProvider = new Oss\Credentials\EnvironmentVariableCredentialsProvider();
    
    // 使用SDK的默认配置
    $cfg = Oss\Config::loadDefault();
    $cfg->setCredentialsProvider($credentialsProvider); // 设置凭证提供者
    $cfg->setRegion($region); // 设置Bucket所在的地域
    if (isset($options["endpoint"])) {
        $cfg->setEndpoint($options["endpoint"]); // 如果提供了访问域名，则设置endpoint
    }
    
    // 创建OSS客户端实例
    $client = new Oss\Client($cfg);
    
    // 添加x-oss-callback和x-oss-callback-var头部信息
    // 定义回调地址
    $call_back_url = "http://www.example.com/callback";
    
    // 构造回调参数（callback）：指定回调地址和回调请求体，使用 Base64 编码
    // 使用占位符 {var1} 和 {var2} 替代 ${x:var1} 和 ${x:var2}
    $callback_body_template = "bucket={bucket}&object={object}&my_var_1={var1}&my_var_2={var2}";
    $callback_body_replaced = str_replace(
        ['{bucket}', '{object}', '{var1}', '{var2}'],
        [$bucket, $key, 'value1', 'value2'],
        $callback_body_template
    );
    $callback = base64_encode(json_encode([
        "callbackUrl" => $call_back_url,
        "callbackBody" => $callback_body_replaced
    ]));
    
    // 构造自定义变量（callback-var），使用 Base64 编码
    $callback_var = base64_encode(json_encode([
        "x:var1" => "value1",
        "x:var2" => "value2"
    ]));
    
    // 创建PutObjectRequest对象，用于上传对象。
    // 注意：此处添加了contentType、metadata和headers参数，用于签名计算。
    $request = new Oss\Models\PutObjectRequest(
        bucket: $bucket,
        key: $key,
        callback:$callback,
        callbackVar:$callback_var,
    );
    
    // 调用presign方法生成预签名URL
    $result = $client->presign($request);
    
    // 打印预签名结果，输出预签名URL，用户可以直接使用该URL进行上传操作
    print(
        'put object presign result:' . var_export($result, true) . PHP_EOL .
        'put object url:' . $result->url . PHP_EOL
    );
    ```
    
2.  其他人使用PUT方法的预签名URL上传文件。
    
    ### curl
    
    ```
    curl -X PUT \
         -H "x-oss-callback: eyJjYWxsYmFja1VybCI6Imh0dHA6Ly93d3cuZXhhbXBsZS5jb20vY2FsbGJhY2siLCJjYWxsYmFja0JvZHkiOiJidWNrZXQ9JHtidWNrZXR9Jm9iamVjdD0ke29iamVjdH0mbXlfdmFyXzE9JHt4OnZhcjF9Jm15X3Zhcl8yPSR7eDp2YXIyfSJ9" \
         -H "x-oss-callback-var: eyJ4OnZhcjEiOiJ2YWx1ZTEiLCJ4OnZhcjIiOiJ2YWx1ZTIifQ==" \
         -T "C:\\Users\\demo.txt" \
         "https://exampleobject.oss-cn-hangzhou.aliyuncs.com/exampleobject.txt?x-oss-date=20241112T083238Z&x-oss-expires=3599&x-oss-signature-version=OSS4-HMAC-SHA256&x-oss-credential=LTAI****************%2F20241112%2Fcn-hangzhou%2Foss%2Faliyun_v4_request&x-oss-signature=ed5a******************************************************"
    ```
    
    ### Python
    
    ```
    import requests
    
    def upload_file(signed_url, file_path, headers=None):
        """
        使用预签名的URL上传文件到OSS。
    
        :param signed_url: 预签名的URL。
        :param file_path: 要上传的文件的完整路径。
        :param headers: 可选，自定义HTTP头部。
        :return: None
        """
        if not headers:
            headers = {}
    
        try:
            with open(file_path, 'rb') as file:
                response = requests.put(signed_url, data=file, headers=headers)
                print(f"返回上传状态码：{response.status_code}")
                if response.status_code == 200:
                    print("使用网络库上传成功")
                else:
                    print("上传失败")
                print(response.text)
        except Exception as e:
            print(f"发生错误：{e}")
    
    if __name__ == "__main__":
        # 将<signedUrl>替换为授权URL。
        signed_url = "<signedUrl>"
    
        # 填写本地文件的完整路径。如果未指定本地路径，则默认从脚本所在目录中上传文件。
        file_path = "C:\\Users\\demo.txt"
    
        headers = {
            "x-oss-callback": "eyJjYWxsYmFja1VybCI6Imh0dHA6Ly93d3cuZXhhbXBsZS5jb20vY2FsbGJhY2siLCJjYWxsYmFja0JvZHkiOiJidWNrZXQ9JHtidWNrZXR9Jm9iamVjdD0ke29iamVjdH0mbXlfdmFyXzE9JHt4OnZhcjF9Jm15X3Zhcl8yPSR7eDp2YXIyfSJ9",
            "x-oss-callback-var": "eyJ4OnZhcjEiOiJ2YWx1ZTEiLCJ4OnZhcjIiOiJ2YWx1ZTIifQ==",
        }
    
        upload_file(signed_url,  file_path, headers)
    ```
    
    ### Go
    
    ```
    package main
    
    import (
        "bytes"
        "fmt"
        "io"
        "net/http"
        "os"
    )
    
    func uploadFile(signedUrl string, filePath string, headers map[string]string) error {
        // 打开文件
        file, err := os.Open(filePath)
        if err != nil {
            return err
        }
        defer file.Close()
    
        // 读取文件内容
        fileBytes, err := io.ReadAll(file)
        if err != nil {
            return err
        }
    
        // 创建请求
        req, err := http.NewRequest("PUT", signedUrl, bytes.NewBuffer(fileBytes))
        if err != nil {
            return err
        }
    
        // 设置请求头
        for key, value := range headers {
            req.Header.Add(key, value)
        }
    
        // 发送请求
        client := &http.Client{}
        resp, err := client.Do(req)
        if err != nil {
            return err
        }
        defer resp.Body.Close()
    
        // 处理响应
        fmt.Printf("返回上传状态码：%d\n", resp.StatusCode)
        if resp.StatusCode == 200 {
            fmt.Println("使用网络库上传成功")
        } else {
            fmt.Println("上传失败")
        }
        body, _ := io.ReadAll(resp.Body)
        fmt.Println(string(body))
    
        return nil
    }
    
    func main() {
        // 将<signedUrl>替换为授权URL。
        signedUrl := "<signedUrl>"
        // 填写本地文件的完整路径。如果未指定本地路径，则默认从示例程序所属项目对应本地路径中上传文件。
        filePath := "C:\\Users\\demo.txt"
    
        // 设置请求头，这里的请求头信息需要与生成URL时的信息一致。
        headers := map[string]string{
            "x-oss-callback":     "eyJjYWxsYmFja0JvZHkiOiJidWNrZXQ9JHtidWNrZXR9XHUwMDI2b2JqZWN0PSR7b2JqZWN0fVx1MDAyNnNpemU9JHtzaXplfVx1MDAyNm15X3Zhcl8xPSR7eDpteV92YXIxfVx1MDAyNm15X3Zhcl8yPSR7eDpteV92YXIyfSIsImNhbGxiYWNrQm9keVR5cGUiOiJhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQiLCJjYWxsYmFja1VybCI6Imh0dHA6Ly9leGFtcGxlLmNvbToyMzQ1MCJ9",
            "x-oss-callback-var": "eyJ4Om15X3ZhcjEiOiJ0aGkgaXMgdmFyIDEiLCJ4Om15X3ZhcjIiOiJ0aGkgaXMgdmFyIDIifQ==",
        }
    
        err := uploadFile(signedUrl, filePath, headers)
        if err != nil {
            fmt.Printf("发生错误：%v\n", err)
        }
    }
    ```
    
    ### Java
    
    ```
    import org.apache.http.HttpEntity;
    import org.apache.http.client.methods.CloseableHttpResponse;
    import org.apache.http.client.methods.HttpPut;
    import org.apache.http.entity.FileEntity;
    import org.apache.http.impl.client.CloseableHttpClient;
    import org.apache.http.impl.client.HttpClients;
    import java.io.*;
    import java.net.URL;
    import java.util.*;
    
    public class SignUrlUpload {
      public static void main(String[] args) throws IOException {
        CloseableHttpClient httpClient = null;
        CloseableHttpResponse response = null;
    
        // 将<signedUrl>替换为授权URL。
        URL signedUrl = new URL("<signedUrl>");
    
        // 填写本地文件的完整路径。如果未指定本地路径，则默认从示例程序所属项目对应本地路径中上传文件。
        String pathName = "C:\\Users\\demo.txt";
    
        // 设置请求头，包括x-oss-callback和x-oss-callback-var。
        Map<String, String> headers = new HashMap<String, String>();
        headers.put("x-oss-callback", "eyJjYWxsYmFja1VybCI6Imh0dHA6Ly93d3cuZXhhbXBsZS5jb20vY2FsbGJhY2siLCJjYWxsYmFja0JvZHkiOiJidWNrZXQ9JHtidWNrZXR9Jm9iamVjdD0ke29iamVjdH0mbXlfdmFyXzE9JHt4OnZhcjF9Jm15X3Zhcl8yPSR7eDp2YXIyfSJ9");
        headers.put("x-oss-callback-var", "eyJ4OnZhcjEiOiJ2YWx1ZTEiLCJ4OnZhcjIiOiJ2YWx1ZTIifQ==");
    
        try {
          HttpPut put = new HttpPut(signedUrl.toString());
          System.out.println(put);
          HttpEntity entity = new FileEntity(new File(pathName));
          put.setEntity(entity);
          // 如果生成预签名URL时设置了header参数，则调用预签名URL上传文件时，也需要将这些参数发送至服务端。如果签名和发送至服务端的不一致，会报签名错误。
          for(Map.Entry<String, String> header: headers.entrySet()){
            put.addHeader(header.getKey(),header.getValue());
          }
    
          httpClient = HttpClients.createDefault();
    
          response = httpClient.execute(put);
    
          System.out.println("返回上传状态码："+response.getStatusLine().getStatusCode());
          if(response.getStatusLine().getStatusCode() == 200){
            System.out.println("使用网络库上传成功");
          }
          System.out.println(response.toString());
        } catch (Exception e){
          e.printStackTrace();
        } finally {
          if (response != null) {
            response.close();
          }
          if (httpClient != null) {
            httpClient.close();
          }
        }
      }
    }       
    ```
    
    ### PHP
    
    ```
    <?php
    
    function uploadFile($signedUrl, $filePath, $headers = []) {
        // 检查文件是否存在
        if (!file_exists($filePath)) {
            echo "文件不存在: $filePath\n";
            return;
        }
    
        // 初始化cURL会话
        $ch = curl_init();
    
        // 设置cURL选项
        curl_setopt($ch, CURLOPT_URL, $signedUrl);
        curl_setopt($ch, CURLOPT_PUT, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_INFILE, fopen($filePath, 'rb'));
        curl_setopt($ch, CURLOPT_INFILESIZE, filesize($filePath));
        curl_setopt($ch, CURLOPT_HTTPHEADER, array_map(function($key, $value) {
            return "$key: $value";
        }, array_keys($headers), $headers));
    
        // 执行cURL请求
        $response = curl_exec($ch);
    
        // 获取HTTP状态码
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    
        // 关闭cURL会话
        curl_close($ch);
    
        // 输出结果
        echo "返回上传状态码：$httpCode\n";
        if ($httpCode == 200) {
            echo "使用网络库上传成功\n";
        } else {
            echo "上传失败\n";
        }
        echo $response . "\n";
    }
    
    // 将<signedUrl>替换为授权URL。
    $signedUrl = "<signedUrl>";
    
    // 填写本地文件的完整路径。如果未指定本地路径，则默认从脚本所在目录中上传文件。
    $filePath = "C:\\Users\\demo.txt";
    
    $headers = [
        "x-oss-callback" => "eyJjYWxsYmFja1VybCI6Imh0dHA6Ly93d3cuZXhhbXBsZS5jb20vY2FsbGJhY2siLCJjYWxsYmFja0JvZHkiOiJidWNrZXQ9JHtidWNrZXR9Jm9iamVjdD0ke29iamVjdH0mbXlfdmFyXzE9JHt4OnZhcjF9Jm15X3Zhcl8yPSR7eDp2YXIyfSJ9",
        "x-oss-callback-var" => "eyJ4OnZhcjEiOiJ2YWx1ZTEiLCJ4OnZhcjIiOiJ2YWx1ZTIifQ==",
    ];
    
    uploadFile($signedUrl, $filePath, $headers);
    
    ?>
    ```
    

## **了解更多**

### **什么是**预**签名URL**

预签名URL是一种安全链接，通过加密签名和有效期验证，临时授权访问特定的OSS文件。生成预签名URL时，本地基于AK/SK密钥对资源路径、过期时间等参数进行加密计算，生成签名参数并将其添加到URL中，形成完整的预签名URL。其典型格式为：`https://BucketName.Endpoint/Object?签名参数`。

当第三方访问该URL时，OSS会校验签名参数，若参数被篡改或过期则拒绝访问。

以下为预签名URL示例。

```
https://examplebucket.oss-cn-hangzhou.aliyuncs.com/exampleobject.txt?x-oss-process=image%2Fresize%2Cp_10&x-oss-date=20241115T095058Z&x-oss-expires=3600&x-oss-signature-version=OSS4-HMAC-SHA256&x-oss-credential=LTAI****************%2F20241115%2Fcn-hangzhou%2Foss%2Faliyun_v4_request&x-oss-signature=6e7a********************************
```

通过这种方式，文件拥有者可以安全地授权第三方访问文件，而无需暴露密钥。

**适用场景**

-   **短期文件共享**：第三方申请上传或下载指定文件，后端便生成带有效期的预签名URL并返回给前端。第三方可以在有效期内使用该URL上传或下载文件，从而保障数据安全。
    
-   **灵活访问**：文件拥有者可以通过邮件或聊天工具等方式分享预签名URL，第三方获取URL后在浏览器地址栏粘贴即可下载文件。
    

## **常见问题**

### **如何授权第三方对OSS资源进行更多操作，而不仅限于上传？**

除了预签名URL，阿里云还提供了更灵活的临时授权方式——STS临时访问凭证。如果您希望第三方对OSS的操作不只局限于上传，而是可以执行例如：列举文件、拷贝文件等更多OSS资源的管理操作，建议您了解并使用STS临时访问凭证，详情请参见[使用STS临时访问凭证访问OSS](https://help.aliyun.com/zh/oss/developer-reference/use-temporary-access-credentials-provided-by-sts-to-access-oss)。

### **是否可以仅允许指定网站访问OSS资源，拒绝其他来源的请求？**

是的，您可以通过配置Referer防盗链，设置白名单，限制只有通过特定网站（如您的网站）才能访问OSS资源，从而防止其他恶意来源未通过您的网站而直接引用您的OSS文件。详细配置步骤，请参见[配置Referer防盗链来阻止其他网站引用OSS文件](https://help.aliyun.com/zh/oss/configure-referer-policy-to-prevent-other-websites-from-referring-to-oss-files)。

### **报错CORS错误**

没有配置Bucket跨域策略或跨域策略配置错误，请参考[跨域设置](https://help.aliyun.com/zh/oss/user-guide/configure-cross-origin-resource-sharing)进行配置检查。

### **报错405 Method Not Allowed**

请求方法不正确。使用签名URL上传文件时，注意使用PUT请求非POST请求。