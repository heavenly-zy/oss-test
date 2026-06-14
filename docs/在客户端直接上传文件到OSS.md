客户端直传是指客户端直接上传文件到对象存储OSS。相对于服务端代理上传，客户端直传避免了业务服务器中转文件，提高了上传速度，节省了服务器资源。本文介绍客户端直传的方案优势、安全实现和实践参考。

## 为什么客户端直传

在典型的服务端和客户端架构下，常见的文件上传方式是服务端代理上传：客户端将文件上传到业务服务器，然后业务服务器将文件上传到OSS。在这个过程中，一份数据需要在网络上传输两次，会造成网络资源的浪费，增加服务端的资源开销。为了解决这一问题，您可以在客户端直连OSS来完成文件上传，无需经过业务服务器中转。

![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3559872771/CAEQYBiBgMDJ4vrI3RgiIDkzMzU0NzA1ZDc4NzQwMjZhZDdkNzI2NDQxYWFkODYx4075211_20231109114557.035.svg)

## **如何实现客户端直传**

实现客户端直传需要解决以下两个大问题：

### **跨域访问**

如果您的客户端是Web端或小程序，您需要解决跨域访问被限制的问题。浏览器以及小程序容器出于安全考虑，通常都会限制跨域访问，这一限制也会限制您的客户端代码直连OSS。您可以通过配置OSS Bucket的跨域访问规则，来允许指定域名下的Web应用或小程序直接访问OSS。更多信息，请参见[跨域设置](https://help.aliyun.com/zh/oss/user-guide/configure-cross-origin-resource-sharing)。

### **安全授权**

上传文件到OSS需要使用RAM用户的访问密钥（AccessKey）来完成签名认证，但是在客户端中使用长期有效的访问密钥，可能会导致访问密钥泄露，进而引起安全问题。为了解决这一问题，您可以选择以下方案实现安全上传：

-   **服务端生成STS临时访问凭证**
    
    对于大部分上传文件的场景，建议您在服务端使用STS SDK获取STS临时访问凭证，然后在客户端使用STS临时凭证和OSS SDK直接上传文件。客户端能重复使用服务端生成的STS临时访问凭证生成签名，因此适用于基于分片上传大文件、基于分片断点续传的场景。需要注意的是，频繁地调用STS服务会引起限流，因此建议您对STS临时凭证做缓存处理，并在有效期前刷新。为了确保STS临时访问凭证不被客户端滥用，建议您为STS临时访问凭证添加额外的权限策略，以进一步限制其权限。更多信息，请参见[什么是STS](https://help.aliyun.com/zh/ram/user-guide/what-is-sts)。
    
-   **服务端生成PostObject所需的签名和Post Policy**
    
    对于需要限制上传文件属性的场景，您可以在服务端生成PostObject所需的Post签名、PostPolicy等信息，然后客户端可以凭借这些信息，在一定的限制下不依赖OSS SDK直接上传文件。您可以借助服务端生成的PostPolicy限制客户端上传的文件，例如限制文件大小、文件类型。此方案适用于通过HTML表单上传的方式上传文件。需要注意的是，此方案不支持基于分片上传大文件、基于分片断点续传的场景。更多信息，请参见[PostObject](https://help.aliyun.com/zh/oss/developer-reference/postobject#t4705.html)。
    
-   **服务端生成PutObject所需的签名URL**
    
    对于简单上传文件的场景，您可以在服务端使用OSS SDK生成PutObject所需的签名URL，客户端可以凭借签名URL，不依赖OSS SDK直接上传文件。需要注意的是，此方案不适用于基于分片上传大文件、基于分片断点续传的场景。在服务端对每个分片生成签名URL，并将签名URL返回给客户端，会增加与服务端的交互次数和网络请求的复杂性。另外，客户端可能会修改分片的内容或顺序，导致最终合并的文件不正确。更多信息，请参见[签名版本1](https://help.aliyun.com/zh/oss/developer-reference/ddd-signatures-to-urls)。
    

## 服务端生成STS临时访问凭证

服务端通过STS临时访问凭证授权客户端上传文件到OSS的过程如下。

![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3559872771/CAEQYBiBgMDyuNer2hgiIDg2MjIyZWMxODQwYTRjMTBiMjExMDliN2E3ZjRlNmU43963382_20230830144006.372.svg)

1.  客户端向业务服务器请求临时访问凭证。
    
2.  业务服务器使用STS SDK调用AssumeRole接口，获取临时访问凭证。
    
3.  STS生成并返回临时访问凭证给业务服务器。
    
4.  业务服务器返回临时访问凭证给客户端。
    
5.  客户端使用OSS SDK通过该临时访问凭证上传文件到OSS。
    
6.  OSS返回成功响应给客户端。
    

#### **示例代码**

以下示例代码为代码核心片段，如需查看完整代码请参考示例工程：[sts.zip](https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20240423/pwauds/sts.zip)。

服务端示例代码

服务端生成临时访问凭证的示例代码如下：

**说明**

当前代码支持一键部署，您可以直接在函数计算FC中一键部署本代码。oss-upload-sts-app

## Python

```
import json
from alibabacloud_tea_openapi.models import Config
from alibabacloud_sts20150401.client import Client as Sts20150401Client
from alibabacloud_sts20150401 import models as sts_20150401_models
from alibabacloud_credentials.client import Client as CredentialClient

# 将<YOUR_ROLE_ARN>替换为拥有上传文件到指定OSS Bucket权限的RAM角色的ARN。
role_arn_for_oss_upload = '<YOUR_ROLE_ARN>'
# 将<YOUR_REGION_ID>设置为STS服务的地域，例如cn-hangzhou。
region_id = '<YOUR_REGION_ID>'

def get_sts_token():
    # 初始化 CredentialClient 时不指定参数，代表使用默认凭据链。
    # 在本地运行程序时，可以通过环境变量 ALIBABA_CLOUD_ACCESS_KEY_ID、ALIBABA_CLOUD_ACCESS_KEY_SECRET 指定 AK；
    # 在 ECS\ECI\容器服务上运行时，可以通过环境变量 ALIBABA_CLOUD_ECS_METADATA 来指定绑定的实例节点角色，SDK 会自动换取 STS 临时凭证。
    config = Config(region_id=region_id, credential=CredentialClient())
    sts_client = Sts20150401Client(config=config)
    assume_role_request = sts_20150401_models.AssumeRoleRequest(
        role_arn=role_arn_for_oss_upload,
        # 将<YOUR_ROLE_SESSION_NAME>设置为自定义的会话名称，例如oss-role-session。
        role_session_name='<YOUR_ROLE_SESSION_NAME>'
    )
    response = sts_client.assume_role(assume_role_request)
    token = json.dumps(response.body.credentials.to_map())
    return token
```

## Java

```
import com.aliyun.sts20150401.Client;
import com.aliyun.sts20150401.models.AssumeRoleRequest;
import com.aliyun.sts20150401.models.AssumeRoleResponse;
import com.aliyun.sts20150401.models.AssumeRoleResponseBody;
import com.aliyun.tea.TeaException;
import com.aliyun.teautil.models.RuntimeOptions;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import com.aliyun.teaopenapi.models.Config;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import static com.aliyun.teautil.Common.assertAsString;

@RestController
public class StsController {

    @Autowired
    private Client stsClient;

    @GetMapping("/get_sts_token_for_oss_upload")
    public AssumeRoleResponseBody.AssumeRoleResponseBodyCredentials generateStsToken() {
        AssumeRoleRequest assumeRoleRequest = new AssumeRoleRequest()
            .setDurationSeconds(3600L)
            // 将<YOUR_ROLE_SESSION_NAME>设置为自定义的会话名称，例如 my-website-server。
            .setRoleSessionName("<YOUR_ROLE_SESSION_NAME>")
            // 将<YOUR_ROLE_ARN>替换为拥有上传文件到指定OSS Bucket权限的RAM角色的ARN，可以在 RAM 角色详情中获得角色 ARN。
            .setRoleArn("<YOUR_ROLE_ARN>");
        RuntimeOptions runtime = new RuntimeOptions();
        try {
            AssumeRoleResponse response = stsClient.assumeRoleWithOptions(assumeRoleRequest, runtime);
            return response.body.credentials;
        } catch (TeaException error) {
            // 如有需要，请打印 error
            assertAsString(error.message);
            return null;
        } catch (Exception error) {
            assertAsString(error.getMessage());
            return null;
        }
    }
}

@Configuration
public class StsClientConfiguration {

    @Bean
    public Client stsClient() {
        // 当您在初始化凭据客户端不传入任何参数时，Credentials工具会使用默认凭据链方式初始化客户端。
        Config config = new Config();
        config.endpoint = "sts.cn-hangzhou.aliyuncs.com";
        try {
            com.aliyun.credentials.Client credentials = new com.aliyun.credentials.Client();
            config.setCredential(credentials);
            return new Client(config);
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }
}
```

## Go

```
package main

import (
    "encoding/json"
    "net/http"
    "os"

    openapi "github.com/alibabacloud-go/darabonba-openapi/v2/client"
    sts20150401 "github.com/alibabacloud-go/sts-20150401/v2/client"
    util "github.com/alibabacloud-go/tea-utils/v2/service"
    "github.com/alibabacloud-go/tea/tea"
)

/**
 * 使用AK&SK初始化账号Client
 * @param accessKeyId
 * @param accessKeySecret
 * @return Client
 * @throws Exception
 */
func CreateClient(accessKeyId *string, accessKeySecret *string) (*sts20150401.Client, error) {
    config := &openapi.Config{
    // 必填，您的 AccessKey ID
    AccessKeyId: accessKeyId,
    // 必填，您的 AccessKey Secret
    AccessKeySecret: accessKeySecret,
    }
    // Endpoint 请参考 https://api.aliyun.com/product/Sts
    config.Endpoint = tea.String("sts.cn-hangzhou.aliyuncs.com")
    return sts20150401.NewClient(config)
}

func AssumeRole(client *sts20150401.Client) (*sts20150401.AssumeRoleResponse, error) {
    assumeRoleRequest := &sts20150401.AssumeRoleRequest{
    DurationSeconds: tea.Int64(3600),
    RoleArn:         tea.String("acs:ram::1379186349531844:role/admin-oss"),
    RoleSessionName: tea.String("peiyu-demo"),
    }
    return client.AssumeRoleWithOptions(assumeRoleRequest, &util.RuntimeOptions{})
}

func handler(w http.ResponseWriter, r *http.Request) {
    if r.URL.Path == "/" {
    http.ServeFile(w, r, "templates/index.html")
    return
    } else if r.URL.Path == "/get_sts_token_for_oss_upload" {
    client, err := CreateClient(tea.String(os.Getenv("ALIBABA_CLOUD_ACCESS_KEY_ID")), tea.String(os.Getenv("ALIBABA_CLOUD_ACCESS_KEY_SECRET")))
    if err != nil {
    panic(err)
    }
    assumeRoleResponse, err := AssumeRole(client)
    if err != nil {
    panic(err)
    }
    responseBytes, err := json.Marshal(assumeRoleResponse)
    if err != nil {
    panic(err)
    }
    w.Header().Set("Content-Type", "application/json")
    w.Write(responseBytes)
    return
    }
    http.NotFound(w, r)
}

func main() {
    http.HandleFunc("/", handler)
    http.ListenAndServe(":8080", nil)
}
```

## PHP

```
<?php
require_once 'vendor/autoload.php';
use AlibabaCloud\Client\AlibabaCloud;
use AlibabaCloud\Client\Exception\ClientException;
use AlibabaCloud\Client\Exception\ServerException;
use AlibabaCloud\Sts\Sts;
// 初始化Alibaba Cloud客户端。
AlibabaCloud::accessKeyClient(getenv('ALIBABA_CLOUD_ACCESS_KEY_ID'), getenv('ALIBABA_CLOUD_ACCESS_KEY_SECRET'))
    ->regionId('cn-hangzhou')
    ->asDefaultClient();
// 创建STS请求。
$request = Sts::v20150401()->assumeRole();
// 发起STS请求并获取结果。
// 将<YOUR_ROLE_SESSION_NAME>设置为自定义的会话名称，例如oss-role-session。
// 将<YOUR_ROLE_ARN>替换为拥有上传文件到指定OSS Bucket权限的RAM角色的ARN。
$result = $request
    ->withRoleSessionName("<YOUR_ROLE_SESSION_NAME>")
    ->withDurationSeconds(3600)
    ->withRoleArn("<YOUR_ROLE_ARN>")
    ->request();
// 获取STS请求结果中的凭证信息。
$credentials = $result->get('Credentials');
// 构建返回的JSON数据。
$response = [
    'AccessKeyId' => $credentials['AccessKeyId'],
    'AccessKeySecret' => $credentials['AccessKeySecret'],
    'SecurityToken' => $credentials['SecurityToken'],
];
// 设置响应头为application/json。
header('Content-Type: application/json');
// 将结果转换为JSON格式并打印。
echo json_encode(['Credentials' => $response]);
?>
```

## Node.js

```
const express = require("express");
const { STS } = require('ali-oss');

const app = express();
const path = require("path");

app.use(express.static(path.join(__dirname, "templates")));
// 配置环境变量ALIBABA_CLOUD_ACCESS_KEY_ID。
const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
// 配置环境变量ALIBABA_CLOUD_ACCESS_KEY_SECRET。
const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;

app.get('/get_sts_token_for_oss_upload', (req, res) => {
  let sts = new STS({
   accessKeyId: accessKeyId,
   accessKeySecret: accessKeySecret
 });
   // roleArn填写步骤2获取的角色ARN，例如acs:ram::175708322470****:role/ramtest。
   // policy填写自定义权限策略，用于进一步限制STS临时访问凭证的权限。如果不指定Policy，则返回的STS临时访问凭证默认拥有指定角色的所有权限。
   // 3000为过期时间，单位为秒。
   // sessionName用于自定义角色会话名称，用来区分不同的令牌，例如填写为sessiontest。
   sts.assumeRole('<YOUR_ROLE_ARN>', ``, '3000', 'sessiontest').then((result) => {
     console.log(result);
     res.json({
       AccessKeyId: result.credentials.AccessKeyId,
       AccessKeySecret: result.credentials.AccessKeySecret,
       SecurityToken: result.credentials.SecurityToken,
     });
   }).catch((err) => {
     console.log(err);
     res.status(400).json(err.message);
   });
 });

app.listen(8000, () => {
  console.log("http://127.0.0.1:8000");
});
```

## Ruby

```
require 'sinatra'
require 'base64'
require 'open-uri'
require 'cgi'
require 'openssl'
require 'json'
require 'sinatra/reloader'
require 'sinatra/content_for'
require 'aliyunsdkcore'

# 设置public文件夹路径为当前文件夹下的templates文件夹
set :public_folder, File.dirname(__FILE__) + '/templates'

def get_sts_token_for_oss_upload()
  client = RPCClient.new(
    # 配置环境变量ALIBABA_CLOUD_ACCESS_KEY_ID。
    access_key_id: ENV['ALIBABA_CLOUD_ACCESS_KEY_ID'],
    # 配置环境变量ALIBABA_CLOUD_ACCESS_KEY_SECRET。
    access_key_secret: ENV['ALIBABA_CLOUD_ACCESS_KEY_SECRET'],
    endpoint: 'https://sts.cn-hangzhou.aliyuncs.com',
    api_version: '2015-04-01'
  )
  response = client.request(
    action: 'AssumeRole',
    params: {
      # roleArn填写步骤2获取的角色ARN，例如acs:ram::175708322470****:role/ramtest。
      "RoleArn": "acs:ram::175708322470****:role/ramtest",
      # 3600为过期时间，单位为秒。
      "DurationSeconds": 3600,
      # sessionName用于自定义角色会话名称，用来区分不同的令牌，例如填写为sessiontest。
      "RoleSessionName": "sessiontest"
    },
    opts: {
      method: 'POST',
      format_params: true
    }
  )
end

if ARGV.length == 1 
  $server_port = ARGV[0]
elsif ARGV.length == 2
  $server_ip = ARGV[0]
  $server_port = ARGV[1]
end

$server_ip = "0.0.0.0"
$server_port = 8000

puts "App server is running on: http://#{$server_ip}:#{$server_port}"

set :bind, $server_ip
set :port, $server_port

get '/get_sts_token_for_oss_upload' do
  token = get_sts_token_for_oss_upload()
  response = {
    "AccessKeyId" => token["Credentials"]["AccessKeyId"],
    "AccessKeySecret" => token["Credentials"]["AccessKeySecret"],
    "SecurityToken" => token["Credentials"]["SecurityToken"]
  }
  response.to_json
end

get '/*' do
  puts "********************* GET "
  send_file File.join(settings.public_folder, 'index.html')
end
```

## C#

```
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Aliyun.OSS;
using System;
using System.IO;
using AlibabaCloud.SDK.Sts20150401;
using System.Text.Json;
namespace YourNamespace
{
    public class Program
    {
        private ILogger<Program> _logger;
        public static AlibabaCloud.SDK.Sts20150401.Client CreateClient(string accessKeyId, string accessKeySecret)
        {
            var config = new AlibabaCloud.OpenApiClient.Models.Config
            {
                AccessKeyId = accessKeyId,
                AccessKeySecret = accessKeySecret,
                Endpoint = "sts.cn-hangzhou.aliyuncs.com"
            };
            return new AlibabaCloud.SDK.Sts20150401.Client(config);
        }
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);
            var app = builder.Build();
            builder.Logging.AddConsole();
            var serviceProvider = builder.Services.BuildServiceProvider();
            var logger = serviceProvider.GetRequiredService<ILogger<Program>>();
            app.UseStaticFiles();
            app.MapGet("/", async (context) =>
            {
                var filePath = Path.Combine(Directory.GetCurrentDirectory(), "templates/index.html");
                var htmlContent = await File.ReadAllTextAsync(filePath);
                await context.Response.WriteAsync(htmlContent);
                logger.LogInformation("GET request to root path");
            });
            app.MapGet("/get_sts_token_for_oss_upload", async (context) =>
            {
                var program = new Program(logger);
                var client = CreateClient(Environment.GetEnvironmentVariable("ALIBABA_CLOUD_ACCESS_KEY_ID"), Environment.GetEnvironmentVariable("ALIBABA_CLOUD_ACCESS_KEY_SECRET"));
                var assumeRoleRequest = new AlibabaCloud.SDK.Sts20150401.Models.AssumeRoleRequest();
                // 将<YOUR_ROLE_SESSION_NAME>设置为自定义的会话名称，例如oss-role-session。
                assumeRoleRequest.RoleSessionName = "<YOUR_ROLE_SESSION_NAME>";
                // 将<YOUR_ROLE_ARN>替换为拥有上传文件到指定OSS Bucket权限的RAM角色的ARN。
                assumeRoleRequest.RoleArn = "<YOUR_ROLE_ARN>";
                assumeRoleRequest.DurationSeconds = 3600;
                var runtime = new AlibabaCloud.TeaUtil.Models.RuntimeOptions();
                var response = client.AssumeRoleWithOptions(assumeRoleRequest, runtime);
                var credentials = response.Body.Credentials;
                var jsonResponse = JsonSerializer.Serialize(new
                {
                    AccessKeyId = credentials.AccessKeyId,
                    AccessKeySecret = credentials.AccessKeySecret,
                    Expiration = credentials.Expiration,
                    SecurityToken = credentials.SecurityToken
                });
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsync(jsonResponse);
            });
            app.Run();
        }
        public Program(ILogger<Program> logger)
        {
            _logger = logger;
        }
    }
}
```

客户端示例代码

Web端使用临时访问凭证上传文件到OSS的示例代码如下：

JavaScript

```
let credentials = null;
const form = document.querySelector("form");
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  // 临时凭证过期时，才重新获取，减少对STS服务的调用。
  if (isCredentialsExpired(credentials)) {
    const response = await fetch("/get_sts_token_for_oss_upload", {
      method: "GET",
    });
    if (!response.ok) {
      // 处理错误的HTTP状态码。
      throw new Error(
        `获取STS令牌失败: ${response.status} ${response.statusText}`
      );
    }
    credentials = await response.json();
  }
  const client = new OSS({
    // 将<YOUR_BUCKET>设置为OSS Bucket名称。
    bucket: "<YOUR_BUCKET>",
    // 将<YOUR_REGION>设置为OSS Bucket所在地域，例如region: 'oss-cn-hangzhou'。
    region: "oss-<YOUR_REGION>",
    accessKeyId: credentials.AccessKeyId,
    accessKeySecret: credentials.AccessKeySecret,
    stsToken: credentials.SecurityToken,
  });

  const fileInput = document.querySelector("#file");
  const file = fileInput.files[0];
  const result = await client.put(file.name, file);
  console.log(result);
});

/**
 * 判断临时凭证是否到期。
 **/
function isCredentialsExpired(credentials) {
  if (!credentials) {
    return true;
  }
  const expireDate = new Date(credentials.Expiration);
  const now = new Date();
  // 如果有效期不足一分钟，视为过期。
  return expireDate.getTime() - now.getTime() <= 60000;
}
```

## 服务端生成PostObject所需的签名和Post Policy

服务端通过Post签名和Post Policy授权客户端上传文件到OSS的过程如下。

![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3559872771/CAEQYBiBgICKj9ur2hgiIDZhMDRjMzdjN2M0OTRlMzQ5NGVlNjRhZGNmNzg1ODA03963382_20230830144006.372.svg)

1.  客户端向业务服务器请求Post签名和Post Policy等信息。
    
2.  业务服务器生成并返回Post签名和Post Policy等信息给客户端。
    
3.  客户端使用Post签名和Post Policy等信息调用PostObject通过HTML表单的方式上传文件到OSS。
    
4.  OSS返回成功响应给客户端。
    

#### **示例代码**

以下示例代码为代码核心片段，如需查看完整代码请参考示例工程：[postsignature.zip](https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20240423/ftkozf/postsignature.zip)。

服务端示例代码

服务端生成Post签名和Post Policy等信息的示例代码如下：

**说明**

当前代码支持一键部署，您可以直接在函数计算FC中一键部署本代码。oss-upload-post-signature-app

## Python

```
import os
from hashlib import sha1 as sha
import json
import base64
import hmac
import datetime
import time

# 配置环境变量OSS_ACCESS_KEY_ID。
access_key_id = os.environ.get('OSS_ACCESS_KEY_ID')
# 配置环境变量OSS_ACCESS_KEY_SECRET。
access_key_secret = os.environ.get('OSS_ACCESS_KEY_SECRET')
# 将<YOUR_BUCKET>替换为Bucket名称。
bucket = '<YOUR_BUCKET>'
# host的格式为bucketname.endpoint。将<YOUR_BUCKET>替换为Bucket名称。将<YOUR_ENDPOINT>替换为OSS Endpoint，例如oss-cn-hangzhou.aliyuncs.com。
host = 'https://<YOUR_BUCKET>.<YOUR_ENDPOINT>'
# 指定上传到OSS的文件前缀。
upload_dir = 'user-dir-prefix/'
# 指定过期时间，单位为秒。
expire_time = 3600


def generate_expiration(seconds):
    """
    通过指定有效的时长（秒）生成过期时间。
    :param seconds: 有效时长（秒）。
    :return: ISO8601 时间字符串，如："2014-12-01T12:00:00.000Z"。
    """
    now = int(time.time())
    expiration_time = now + seconds
    gmt = datetime.datetime.utcfromtimestamp(expiration_time).isoformat()
    gmt += 'Z'
    return gmt


def generate_signature(access_key_secret, expiration, conditions, policy_extra_props=None):
    """
    生成签名字符串Signature。
    :param access_key_secret: 有权限访问目标Bucket的AccessKeySecret。
    :param expiration: 签名过期时间，按照ISO8601标准表示，并需要使用UTC时间，格式为yyyy-MM-ddTHH:mm:ssZ。示例值："2014-12-01T12:00:00.000Z"。
    :param conditions: 策略条件，用于限制上传表单时允许设置的值。
    :param policy_extra_props: 额外的policy参数，后续如果policy新增参数支持，可以在通过dict传入额外的参数。
    :return: signature，签名字符串。
    """
    policy_dict = {
        'expiration': expiration,
        'conditions': conditions
    }
    if policy_extra_props is not None:
        policy_dict.update(policy_extra_props)
    policy = json.dumps(policy_dict).strip()
    policy_encode = base64.b64encode(policy.encode())
    h = hmac.new(access_key_secret.encode(), policy_encode, sha)
    sign_result = base64.b64encode(h.digest()).strip()
    return sign_result.decode()

def generate_upload_params():
    policy = {
        # 有效期。
        "expiration": generate_expiration(expire_time),
        # 约束条件。
        "conditions": [
            # 未指定success_action_redirect时，上传成功后的返回状态码，默认为 204。
            ["eq", "$success_action_status", "200"],
            # 表单域的值必须以指定前缀开始。例如指定key的值以user/user1开始，则可以写为["starts-with", "$key", "user/user1"]。
            ["starts-with", "$key", upload_dir],
            # 限制上传Object的最小和最大允许大小，单位为字节。
            ["content-length-range", 1, 1000000],
            # 限制上传的文件为指定的图片类型
            ["in", "$content-type", ["image/jpeg", "image/png"]]
        ]
    }
    signature = generate_signature(access_key_secret, policy.get('expiration'), policy.get('conditions'))
    response = {
        'policy': base64.b64encode(json.dumps(policy).encode('utf-8')).decode(),
        'ossAccessKeyId': access_key_id,
        'signature': signature,
        'host': host,
        'dir': upload_dir
        # 可以在这里再自行追加其他参数
    }
    return json.dumps(response)
```

## Java

```
package com.aliyun.sample;

import com.aliyun.oss.ClientException;
import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSException;
import com.aliyun.oss.common.utils.BinaryUtil;
import com.aliyun.oss.model.MatchMode;
import com.aliyun.oss.model.PolicyConditions;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.codehaus.jettison.json.JSONObject;
import java.util.Date;

@Controller
public class PostSignatureController {
    @Autowired
    private OSS ossClient;

    @Autowired
    private OssConfig ossConfig;

    @GetMapping("/get_post_signature_for_oss_upload")
    @ResponseBody
    public String generatePostSignature() {
        JSONObject response = new JSONObject();
        try {
            long expireEndTime = System.currentTimeMillis() + ossConfig.getExpireTime() * 1000;
            Date expiration = new Date(expireEndTime);
            PolicyConditions policyConds = new PolicyConditions();
            policyConds.addConditionItem(PolicyConditions.COND_CONTENT_LENGTH_RANGE, 0, 1048576000);
            policyConds.addConditionItem(MatchMode.StartWith, PolicyConditions.COND_KEY, ossConfig.getDir());
            String postPolicy = ossClient.generatePostPolicy(expiration, policyConds);
            byte[] binaryData = postPolicy.getBytes("utf-8");
            String encodedPolicy = BinaryUtil.toBase64String(binaryData);
            String postSignature = ossClient.calculatePostSignature(postPolicy);
            response.put("ossAccessKeyId", ossConfig.getAccessKeyId());
            response.put("policy", encodedPolicy);
            response.put("signature", postSignature);
            response.put("dir", ossConfig.getDir());
            response.put("host", ossConfig.getHost());
        } catch (OSSException oe) {
            System.out.println("Caught an OSSException, which means your request made it to OSS, "
                    + "but was rejected with an error response for some reason.");
            System.out.println("HTTP Status Code: " + oe.getRawResponseError());
            System.out.println("Error Message: " + oe.getErrorMessage());
            System.out.println("Error Code:       " + oe.getErrorCode());
            System.out.println("Request ID:      " + oe.getRequestId());
            System.out.println("Host ID:           " + oe.getHostId());
        } catch (ClientException ce) {
            System.out.println("Caught an ClientException, which means the client encountered "
                    + "a serious internal problem while trying to communicate with OSS, "
                    + "such as not being able to access the network.");
            System.out.println("Error Message: " + ce.getMessage());
        } catch (Exception e) {
            System.out.println("Caught an unexpected exception: " + e.getMessage());
        }
        return response.toString();
    }
}
```

## Go

```
package main

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

var (
	// 配置环境变量OSS_ACCESS_KEY_ID。
	accessKeyId = os.Getenv("OSS_ACCESS_KEY_ID")
	// 配置环境变量OSS_ACCESS_KEY_SECRET。
	accessKeySecret = os.Getenv("OSS_ACCESS_KEY_SECRET")
	// host的格式为bucketname.endpoint。将${your-bucket}替换为Bucket名称。将${your-endpoint}替换为OSS Endpoint，例如oss-cn-hangzhou.aliyuncs.com。
	host = "http://${your-bucket}.${your-endpoint}"
	// 指定上传到OSS的文件前缀。
	uploadDir = "user-dir-prefix/"
	// 指定过期时间，单位为秒。
	expireTime = int64(3600)
)

type ConfigStruct struct {
	Expiration string          `json:"expiration"`
	Conditions [][]interface{} `json:"conditions"`
}

type PolicyToken struct {
	AccessKeyId string `json:"ossAccessKeyId"`
	Host        string `json:"host"`
	Signature   string `json:"signature"`
	Policy      string `json:"policy"`
	Directory   string `json:"dir"`
}

func getGMTISO8601(expireEnd int64) string {
	return time.Unix(expireEnd, 0).UTC().Format("2006-01-02T15:04:05Z")
}

func getPolicyToken() string {
	now := time.Now().Unix()
	expireEnd := now + expireTime
	tokenExpire := getGMTISO8601(expireEnd)

	var config ConfigStruct
	config.Expiration = tokenExpire

	// 添加文件前缀限制
	config.Conditions = append(config.Conditions, []interface{}{"starts-with", "$key", uploadDir})

	// 添加文件大小限制，例如1KB到10MB
	minSize := int64(1024)
	maxSize := int64(10 * 1024 * 1024)
	config.Conditions = append(config.Conditions, []interface{}{"content-length-range", minSize, maxSize})

	result, err := json.Marshal(config)
	if err != nil {
		fmt.Println("callback json err:", err)
		return ""
	}

	encodedResult := base64.StdEncoding.EncodeToString(result)
	h := hmac.New(sha1.New, []byte(accessKeySecret))
	io.WriteString(h, encodedResult)
	signedStr := base64.StdEncoding.EncodeToString(h.Sum(nil))

	policyToken := PolicyToken{
		AccessKeyId: accessKeyId,
		Host:        host,
		Signature:   signedStr,
		Policy:      encodedResult,
		Directory:   uploadDir,
	}

	response, err := json.Marshal(policyToken)
	if err != nil {
		fmt.Println("json err:", err)
		return ""
	}

	return string(response)
}

func handler(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/" {
		http.ServeFile(w, r, "templates/index.html")
		return
	} else if r.URL.Path == "/get_post_signature_for_oss_upload" {
		policyToken := getPolicyToken()
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(policyToken))
		return
	}
	http.NotFound(w, r)
}

func main() {
	http.HandleFunc("/", handler)
	http.ListenAndServe(":8080", nil)
}
```

## PHP

```
<?php
function gmt_iso8601($time)
{
    return str_replace('+00:00', '.000Z', gmdate('c', $time));
}

// 从环境变量中获取访问凭证。运行本示例代码之前，请确保已设置环境变量ALIBABA_CLOUD_ACCESS_KEY_ID和ALIBABA_CLOUD_ACCESS_KEY_SECRET。
$accessKeyId = getenv("ALIBABA_CLOUD_ACCESS_KEY_ID");
$accessKeySecret = getenv("ALIBABA_CLOUD_ACCESS_KEY_SECRET");
// $host的格式为<YOUR-BUCKET>.<YOUR-ENDPOINT>'，请替换为您的真实信息。
$host = 'http://<YOUR-BUCKET>.<YOUR-ENDPOINT>';
// 用户上传文件时指定的前缀。
$dir = 'user-dir-prefix/';          

$now = time();
//设置该policy超时时间是10s. 即这个policy过了这个有效时间，将不能访问。
$expire = 30;  
$end = $now + $expire;
$expiration = gmt_iso8601($end);

//最大文件大小.用户可以自己设置。
$condition = array(0 => 'content-length-range', 1 => 0, 2 => 1048576000);
$conditions[] = $condition;

// 表示用户上传的数据，必须是以$dir开始，不然上传会失败，这一步不是必须项，只是为了安全起见，防止用户通过policy上传到别人的目录。
$start = array(0 => 'starts-with', 1 => '$key', 2 => $dir);
$conditions[] = $start;


$arr = array('expiration' => $expiration, 'conditions' => $conditions);
$policy = json_encode($arr);
$base64_policy = base64_encode($policy);
$string_to_sign = $base64_policy;
$signature = base64_encode(hash_hmac('sha1', $string_to_sign, $accessKeySecret, true));

$response = array();
$response['ossAccessKeyId'] = $accessKeyId;
$response['host'] = $host;
$response['policy'] = $base64_policy;
$response['signature'] = $signature;
$response['dir'] = $dir;  
echo json_encode($response);
```

## Node.js

```
const express = require("express");
const { Buffer } = require("buffer");
const OSS = require("ali-oss");
const app = express();
const path = require("path");
const config = {
  // 配置环境变量ALIBABA_CLOUD_ACCESS_KEY_ID。
  accessKeyId: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID,
  // 配置环境变量ALIBABA_CLOUD_ACCESS_KEY_SECRET。
  accessKeySecret: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET,
  // 将<YOUR-BUCKET>替换为Bucket名称。
  bucket: "<YOUR-BUCKET>",
  // 指定上传到OSS的文件前缀。
  dir: "prefix/",
};

app.use(express.static(path.join(__dirname, "templates")));

app.get("/get_post_signature_for_oss_upload", async (req, res) => {
  const client = new OSS(config);
  const date = new Date();
  // 设置签名的有效期，单位为秒。
  date.setSeconds(date.getSeconds() + 3600);
  const policy = {
    expiration: date.toISOString(),
    conditions: [
      // 设置上传文件的大小限制。
      ["content-length-range", 0, 1048576000],
      // 限制可上传的Bucket。
      { bucket: client.options.bucket },
    ],
  };
  const formData = await client.calculatePostSignature(policy);
  const host = `http://${config.bucket}.${
    (await client.getBucketLocation()).location
  }.aliyuncs.com`.toString();
  const params = {
    policy: formData.policy,
    signature: formData.Signature,
    ossAccessKeyId: formData.OSSAccessKeyId,
    host,
    dir: config.dir,
  };
  res.json(params);
});

app.get(/^(.+)*\.(html|js)$/i, async (req, res) => {
  res.sendFile(path.join(__dirname, "./templates", req.originalUrl));
});

app.listen(8000, () => {
  console.log("http://127.0.0.1:8000");
});
```

## Ruby

```
require 'sinatra'
require 'base64'
require 'open-uri'
require 'cgi'
require 'openssl'
require 'json'
require 'sinatra/reloader'
require 'sinatra/content_for'

# 设置public文件夹路径为当前文件夹下的templates文件夹
set :public_folder, File.dirname(__FILE__) + '/templates'

# 配置环境变量ALIBABA_CLOUD_ACCESS_KEY_ID。
$access_key_id = ENV['ALIBABA_CLOUD_ACCESS_ID']
# 配置环境变量ALIBABA_CLOUD_ACCESS_KEY_SECRET。
$access_key_secret = ENV['ALIBABA_CLOUD_ACCESS_SECRET']

# $host的格式为<bucketname>.<endpoint>，请替换为您的真实信息。
$host = 'http://<bucketname>.<endpoint>';

# 用户上传文件时指定的前缀。
$upload_dir = 'user-dir-prefix/'
# 过期时间，单位为秒。
$expire_time = 30
$server_ip = "0.0.0.0"
$server_port = 8000

if ARGV.length == 1 
  $server_port = ARGV[0]
elsif ARGV.length == 2
  $server_ip = ARGV[0]
  $server_port = ARGV[1]
end

puts "App server is running on: http://#{$server_ip}:#{$server_port}"

def hash_to_jason(source_hash)
  jason_string = source_hash.to_json;    

  jason_string.gsub!("\":[", "\": [")
  jason_string.gsub!("\",\"", "\", \"")
  jason_string.gsub!("],\"", "], \"")
  jason_string.gsub!("\":\"", "\": \"")

  jason_string
end


def get_token()
  expire_syncpoint = Time.now.to_i + $expire_time
  expire = Time.at(expire_syncpoint).utc.iso8601()
  response.headers['expire'] = expire
  policy_dict = {}
  condition_arrary = Array.new
  array_item = Array.new
  array_item.push('starts-with')
  array_item.push('$key')
  array_item.push($upload_dir)
  condition_arrary.push(array_item)
  policy_dict["conditions"] = condition_arrary
  policy_dict["expiration"] = expire
  policy = hash_to_jason(policy_dict)
  policy_encode = Base64.strict_encode64(policy).chomp;
  h = OpenSSL::HMAC.digest('sha1', $access_key_secret, policy_encode)
  hs = Digest::MD5.hexdigest(h)
  sign_result = Base64.strict_encode64(h).strip()
  token_dict = {}
  token_dict['ossAccessKeyId'] = $access_key_id
  token_dict['host'] = $host
  token_dict['policy'] = policy_encode
  token_dict['signature'] = sign_result 
  token_dict['expire'] = expire_syncpoint
  token_dict['dir'] = $upload_dir
  result = hash_to_jason(token_dict)
  result
end

set :bind, $server_ip
set :port, $server_port

get '/get_post_signature_for_oss_upload' do
  token = get_token()
  puts "Token: #{token}"
  token
end

get '/*' do
  puts "********************* GET "
  send_file File.join(settings.public_folder, 'index.html')
end

end

if ARGV.length == 1 
  $server_port = ARGV[0]
elsif ARGV.length == 2
  $server_ip = ARGV[0]
  $server_port = ARGV[1]
end

$server_ip = "0.0.0.0"
$server_port = 8000

puts "App server is running on: http://#{$server_ip}:#{$server_port}"

set :bind, $server_ip
set :port, $server_port

get '/get_sts_token_for_oss_upload' do
  token = get_sts_token_for_oss_upload()
  response = {
    "AccessKeyId" => token["Credentials"]["AccessKeyId"],
    "AccessKeySecret" => token["Credentials"]["AccessKeySecret"],
    "SecurityToken" => token["Credentials"]["SecurityToken"]
  }
  response.to_json
end

get '/*' do
  puts "********************* GET "
  send_file File.join(settings.public_folder, 'index.html')
end
```

## C#

```
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Http;
using System.IO;
using System.Collections.Generic;
using System;
using System.Globalization;
using System.Text;
using System.Security.Cryptography;
using Newtonsoft.Json;
using Microsoft.AspNetCore.Http.Extensions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace YourNamespace
{
    public class Program
    {
        private ILogger<Program> _logger;
        // 配置环境变量ALIBABA_CLOUD_ACCESS_KEY_ID。
        public string AccessKeyId { get; set; } = Environment.GetEnvironmentVariable("ALIBABA_CLOUD_ACCESS_KEY_ID");
        // 配置环境变量ALIBABA_CLOUD_ACCESS_KEY_SECRET。
        public string AccessKeySecret { get; set; } = Environment.GetEnvironmentVariable("ALIBABA_CLOUD_ACCESS_KEY_SECRET");
        // host的格式为bucketname.endpoint。将<YOUR-BUCKET>替换为Bucket名称。将<YOUR-ENDPOINT>替换为OSS Endpoint，例如oss-cn-hangzhou.aliyuncs.com。
        public string Host { get; set; } = "<YOUR-BUCKET>.<YOUR-ENDPOINT>";
        // 指定上传到OSS的文件前缀。
        public string UploadDir { get; set; } = "user-dir-prefix/";
        // 指定过期时间，单位为秒。
        public int ExpireTime { get; set; } = 3600;
        public class PolicyConfig
        {
            public string expiration { get; set; }
            public List<List<object>> conditions { get; set; }
        }
        public class PolicyToken
        {
            public string Accessid { get; set; }
            public string Policy { get; set; }
            public string Signature { get; set; }
            public string Dir { get; set; }
            public string Host { get; set; }
            public string Expire { get; set; }
        }
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);
            var app = builder.Build();

            builder.Logging.AddConsole();
            var logger = builder.Services.BuildServiceProvider().GetRequiredService<ILogger<Program>>();

            app.UseStaticFiles(); 

            app.MapGet("/", async (context) =>
            {
                var filePath = Path.Combine(Directory.GetCurrentDirectory(), "templates/index.html");
                var htmlContent = await File.ReadAllTextAsync(filePath);
                await context.Response.WriteAsync(htmlContent);
                logger.LogInformation("GET request to root path");
            });

            app.MapGet("/get_post_signature_for_oss_upload", async (context) =>
            {
                var program = new Program(logger);
                var token = program.GetPolicyToken();

                logger.LogInformation($"Token: {token}");

                context.Response.ContentType = "application/json";
                await context.Response.WriteAsync(token);
            });

            app.Run();
        }

        public Program(ILogger<Program> logger)
        {
            _logger = logger;
        }

        private string ToUnixTime(DateTime dateTime)
        {
            return ((DateTimeOffset)dateTime).ToUnixTimeSeconds().ToString();
        }

        private string GetPolicyToken()
        {
            var expireDateTime = DateTime.Now.AddSeconds(ExpireTime);
            var config = new PolicyConfig
            {
                expiration = FormatIso8601Date(expireDateTime),
                conditions = new List<List<object>>()
            };
            config.conditions.Add(new List<object>
            {
                "content-length-range", 0, 1048576000
            });
            var policy = JsonConvert.SerializeObject(config);
            var policyBase64 = EncodeBase64("utf-8", policy);
            var signature = ComputeSignature(AccessKeySecret, policyBase64);
            var policyToken = new PolicyToken
            {
                Accessid = AccessKeyId,
                Host = Host,
                Policy = policyBase64,
                Signature = signature,
                Expire = ToUnixTime(expireDateTime),
                Dir = UploadDir
            };
            return JsonConvert.SerializeObject(policyToken);
        }

        private string FormatIso8601Date(DateTime dtime)
        {
            return dtime.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'",
                                    CultureInfo.CurrentCulture);
        }

        private string EncodeBase64(string codeType, string code)
        {
            string encode = "";
            byte[] bytes = Encoding.GetEncoding(codeType).GetBytes(code);
            try
            {
                encode = Convert.ToBase64String(bytes);
            }
            catch
            {
                encode = code;
            }
            return encode;
        }

        private string ComputeSignature(string key, string data)
        {
            using (var algorithm = new HMACSHA1(Encoding.UTF8.GetBytes(key)))
            {
                return Convert.ToBase64String(algorithm.ComputeHash(Encoding.UTF8.GetBytes(data)));
            }
        }
    }
}
```

客户端示例代码

Web端使用Post签名和Post Policy等信息上传文件到OSS的示例代码如下：

JavaScript

```
const form = document.querySelector("form");
const fileInput = document.querySelector("#file");
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const file = fileInput.files[0];
  if (!fileInput.files[0]) {
    alert('请选择要上传的文件');
    return;
  }
  const filename = fileInput.files[0].name;
  fetch("/get_post_signature_for_oss_upload", { method: "GET" })
    .then((response) => {
      if (!response.ok) {
        throw new Error("获取签名失败");
      }
      return response.json();
    })
    .then((data) => {
      const formData = new FormData();
      formData.append("name", filename);
      formData.append("policy", data.policy);
      formData.append("OSSAccessKeyId", data.ossAccessKeyId);
      formData.append("success_action_status", "200");
      formData.append("signature", data.signature);
      formData.append("key", data.dir + filename);
      formData.append("file", file);

      return fetch(data.host, { method: "POST", body: formData });
    })
    .then((response) => {
      if (response.ok) {
        console.log("上传成功");
        alert("文件已上传");
      } else {
        console.log("上传失败", response);
        alert("上传失败，请稍后再试");
      }
    })
    .catch((error) => {
      console.error("发生错误:", error);
    });
});
```

## 服务端生成PutObject所需的签名URL

服务端通过签名URL授权客户端上传文件到OSS的过程如下。

![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3559872771/CAEQYBiBgIC4tdqr2hgiIDFkYWQ2ZTNjOTVkYjQyMjRhYjg3MjQxYTYyZTNjNDU33963382_20230830144006.372.svg)

1.  客户端向业务服务器请求签名URL。
    
2.  业务服务器使用OSS SDK生成PUT类型的签名URL，然后将其返回给客户端。
    
3.  客户端使用PUT类型的签名URL调用PutObject上传文件到OSS。
    
4.  OSS向客户端返回成功响应。
    

#### **示例代码**

以下示例代码为代码核心片段，如需查看完整代码请参考示例工程：[presignedurl.zip](https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20240606/fbhcrc/presignedurl.zip)。

服务端示例代码

服务端生成签名URL的示例代码如下：

**说明**

当前代码支持一键部署，您可以直接在函数计算FC中一键部署本代码。oss-upload-presigned-url-app

## Python

```
import oss2
from oss2.credentials import EnvironmentVariableCredentialsProvider

# 从环境变量中获取访问凭证。运行本示例代码之前，请确保已设置环境变量OSS_ACCESS_KEY_ID和OSS_ACCESS_KEY_SECRET。
auth = oss2.ProviderAuth(EnvironmentVariableCredentialsProvider())
# 将<YOUR_ENDPOINT>替换为Bucket所在地域对应的Endpoint。以华东1（杭州）为例，Endpoint填写为https://oss-cn-hangzhou.aliyuncs.com。
# 将<YOUR_BUCKET>替换为Bucket名称。
bucket = oss2.Bucket(auth, '<YOUR_ENDPOINT>', '<YOUR_BUCKET>')
# 指定过期时间，单位秒。
expire_time = 3600
# 填写Object完整路径，例如exampledir/exampleobject.png。Object完整路径中不能包含Bucket名称。
object_name = 'exampledir/exampleobject.png'

def generate_presigned_url():
    # 指定Header。
    headers = dict()
    # 指定Content-Type。
    headers['Content-Type'] = 'image/png'
    # 指定存储类型。
    # headers["x-oss-storage-class"] = "Standard"
    # 生成签名URL时，OSS默认会对Object完整路径中的正斜线（/）进行转义，从而导致生成的签名URL无法直接使用。
    # 设置slash_safe为True，OSS不会对Object完整路径中的正斜线（/）进行转义，此时生成的签名URL可以直接使用。
    url = bucket.sign_url('PUT', object_name, expire_time, slash_safe=True, headers=headers)
    return url
```

## Java

```
import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSClientBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;
import com.aliyun.oss.HttpMethod;
import com.aliyun.oss.model.GeneratePresignedUrlRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import java.net.URL;
import java.util.Date;
import javax.annotation.PreDestroy;

@Configuration
public class OssConfig {

    /**
     * 将<your-endpoint>替换为OSS Endpoint，例如oss-cn-hangzhou.aliyuncs.com。
     */
    private static final String endpoint = "https://oss-cn-hangzhou.aliyuncs.com";

    /**
     * 通过环境变量 ALIBABA_CLOUD_ACCESS_KEY_ID 设置 accessKeyId
     */
    @Value("${ALIBABA_CLOUD_ACCESS_KEY_ID}")
    private String accessKeyId;

    /**
     * 通过环境变量 ALIBABA_CLOUD_ACCESS_KEY_Secret 设置 accessKeySecret
     */
    @Value("${ALIBABA_CLOUD_ACCESS_KEY_SECRET}")
    private String accessKeySecret;

    private OSS ossClient;


    @Bean
    public OSS getSssClient() {
        ossClient = new OSSClientBuilder().build(endpoint, accessKeyId, accessKeySecret);
        return ossClient;
    }

    @PreDestroy
    public void onDestroy() {
        ossClient.shutdown();
    }
}

@Controller
public class PresignedURLController {

    /**
     * 将<your-bucket>替换为Bucket名称。
     * 指定上传到OSS的文件前缀。
     * 将<your-object>替换为Object完整路径，例如exampleobject.txt。Object完整路径中不能包含Bucket名称。
     * 指定过期时间，单位为毫秒。
     */
    private static final String BUCKET_NAME = "<your-bucket>";
    private static final String OBJECT_NAME = "<your-object>";
    private static final long EXPIRE_TIME = 3600 * 1000L;

    @Autowired
    private OSS ossClient;

    @GetMapping("/get_presigned_url_for_oss_upload")
    @ResponseBody
    public String generatePresignedURL() {

        try {
            GeneratePresignedUrlRequest request = new GeneratePresignedUrlRequest(BUCKET_NAME, OBJECT_NAME, HttpMethod.PUT);
            Date expiration = new Date(System.currentTimeMillis() + EXPIRE_TIME);
            request.setExpiration(expiration);
            request.setContentType("image/png");
            URL signedUrl = ossClient.generatePresignedUrl(request);
            return signedUrl.toString();
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }
}
```

## Go

```
package main

import (
	"fmt"
	"net/http"
	"os"

	"github.com/aliyun/aliyun-oss-go-sdk/oss"
)

func getURL() string {
	// yourEndpoint填写Bucket对应的Endpoint，以华东1（杭州）为例，填写为https://oss-cn-hangzhou.aliyuncs.com。其它Region请按实际情况填写。
	endpoint := "https://oss-cn-beijing.aliyuncs.com"
	// 填写Bucket名称，例如examplebucket。
	bucketName := "examplebucket"
	// 填写文件完整路径，例如exampledir/exampleobject.txt。文件完整路径中不能包含Bucket名称。
	objectName := "exampledir/exampleobject.txt"
	// 从环境变量中获取访问凭证。运行本示例代码之前，请确保已设置环境变量ALIBABA_CLOUD_ACCESS_KEY_ID和ALIBABA_CLOUD_ACCESS_KEY_SECRET。
	accessKeyID := os.Getenv("ALIBABA_CLOUD_ACCESS_KEY_ID")
	accessKeySecret := os.Getenv("ALIBABA_CLOUD_ACCESS_KEY_SECRET")

	client, err := oss.New(endpoint, accessKeyID, accessKeySecret)
	if err != nil {
		fmt.Println("json err:", err)
	}
	bucket, err := client.Bucket(bucketName)
	if err != nil {
		fmt.Println("json err:", err)
	}
	options := []oss.Option{
		oss.ContentType("image/png"),
	}
	signedURL, err := bucket.SignURL(objectName, oss.HTTPPut, 60, options...)
	if err != nil {
		fmt.Println("json err:", err)
	}

	return signedURL
}

func handler(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/" {
		http.ServeFile(w, r, "templates/index.html")
		return
	} else if r.URL.Path == "/get_presigned_url_for_oss_upload" {
		url := getURL()
		fmt.Fprintf(w, "%s", url)
		return
	}
	http.NotFound(w, r)
}
func main() {
	http.HandleFunc("/", handler)
	http.ListenAndServe(":8080", nil)
}
```

## PHP

```
<?php
require_once __DIR__ . '/vendor/autoload.php';
use OSS\OssClient;
use OSS\Core\OssException;
use OSS\Http\RequestCore;
use OSS\Http\ResponseCore;
// 运行本示例代码之前，请确保已设置环境变量ALIBABA_CLOUD_ACCESS_KEY_ID和ALIBABA_CLOUD_ACCESS_KEY_SECRET。
$accessKeyId = getenv("ALIBABA_CLOUD_ACCESS_KEY_ID");
$accessKeySecret = getenv("ALIBABA_CLOUD_ACCESS_KEY_SECRET");
// yourEndpoint填写Bucket所在地域对应的Endpoint。以华东1（杭州）为例，Endpoint填写为https://oss-cn-hangzhou.aliyuncs.com。
$endpoint = "<YOUR-ENDPOINT>";
// 填写Bucket名称。
$bucket= "<YOUR-BUCKET>";
// 填写不包含Bucket名称在内的Object完整路径。
$object = "test.png";
// 设置签名URL的有效时长为3600秒。
$timeout = 3600;
try {
    $ossClient = new OssClient($accessKeyId, $accessKeySecret, $endpoint, false);
    // 生成签名URL。
    $signedUrl = $ossClient->signUrl($bucket, $object, $timeout, "PUT", array('Content-Type' => 'image/png'));
    // 打印返回的数据
    echo $signedUrl;
} catch (OssException $e) {
    printf($e->getMessage() . "\n");
    return;
}
```

## Node.js

```
const express = require("express");
const { Buffer } = require("buffer");
const OSS = require("ali-oss");
const app = express();
const path = require("path");
const fs = require("fs");
const axios = require("axios");

const config = {
  // <YOURREGION>填写Bucket所在地域。以华东1（杭州）为例，Region填写为oss-cn-hangzhou。
  region: '<YOURREGION>',
  // 配置环境变量ALIBABA_CLOUD_ACCESS_KEY_ID。
  accessKeyId: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID,
  // 配置环境变量ALIBABA_CLOUD_ACCESS_KEY_SECRET。
  accessKeySecret: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET,
  // 将<YOUR-BUCKET>替换为Bucket名称。
  bucket: "<YOUR-BUCKET>",
}
const object = "examplefile.png";

app.use(express.static(path.join(__dirname, "templates")));

app.get("/get_presigned_url_for_oss_upload", async (req, res) => {
    const client = new OSS(config);
    const url = client.signatureUrl(object, {
        method: "PUT",
        "Content-Type": "application/x-www-form-urlencoded",
    });
    res.send(url); 
    console.log(url);
  });

app.listen(8000, () => {
  console.log("http://127.0.0.1:8000");
});
```

## Ruby

```
require 'sinatra'
require 'base64'
require 'open-uri'
require 'cgi'
require 'openssl'
require 'json'
require 'sinatra/reloader'
require 'sinatra/content_for'
require 'aliyun/oss'
include Aliyun::OSS

# 设置public文件夹路径为当前文件夹下的templates文件夹
set :public_folder, File.dirname(__FILE__) + '/templates'

# 配置环境变量ALIBABA_CLOUD_ACCESS_KEY_ID。
$access_key_id = ENV['ALIBABA_CLOUD_ACCESS_KEY_ID']
# 配置环境变量ALIBABA_CLOUD_ACCESS_SECRET。
$access_key_secret = ENV['ALIBABA_CLOUD_ACCESS_KEY_SECRET']

# 填写Object完整路径，例如exampledir/exampleobject.png。Object完整路径中不能包含Bucket名称。
object_key = 'exampledir/exampleobject.png'

def get_presigned_url(client, object_key)
  # 将<YOUR-BUCKET>替换为Bucket名称。
  bucket = client.get_bucket('<YOUR-BUCKET>')
  # 生成签名URL，并指定URL有效时间为1小时（3600秒）。
  bucket.object_url(object_key, 3600)
end

client = Aliyun::OSS::Client.new(
  # 将<YOUR-ENDPOINT>替换为Bucket所在地域对应的Endpoint。以华东1（杭州）为例，Endpoint填写为https://oss-cn-hangzhou.aliyuncs.com。
  endpoint: '<YOUR-ENDPOINT>',
  # 从环境变量中获取访问凭证。运行本示例代码之前，请确保已设置环境变量OSS_ACCESS_KEY_ID和OSS_ACCESS_KEY_SECRET。
  access_key_id: $access_key_id,
  access_key_secret: $access_key_secret
)


if ARGV.length == 1 
  $server_port = ARGV[0]
elsif ARGV.length == 2
  $server_ip = ARGV[0]
  $server_port = ARGV[1]
end

$server_ip = "0.0.0.0"
$server_port = 8000

puts "App server is running on: http://#{$server_ip}:#{$server_port}"

set :bind, $server_ip
set :port, $server_port

get '/get_presigned_url_for_oss_upload' do
  url = get_presigned_url(client, object_key.to_s)
  puts "Token: #{url}"
  url
end

get '/*' do
  puts "********************* GET "
  send_file File.join(settings.public_folder, 'index.html')
end
```

## C#

```
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Http;
using System.IO;
using System;
using Microsoft.Extensions.Logging;
using Aliyun.OSS;

namespace YourNamespace
{
    public class Program
    {
        private ILogger<Program> _logger;

        // 配置环境变量ALIBABA_CLOUD_ACCESS_KEY_ID。
        public string AccessKeyId { get; set; } = Environment.GetEnvironmentVariable("ALIBABA_CLOUD_ACCESS_KEY_ID");
        // 配置环境变量ALIBABA_CLOUD_ACCESS_KEY_SECRET。
        public string AccessKeySecret { get; set; } = Environment.GetEnvironmentVariable("ALIBABA_CLOUD_ACCESS_KEY_SECRET");
        // <YOUR-ENDPOINT>替换为Bucket所在地域对应的Endpoint。以华东1（杭州）为例，Endpoint填写为https://oss-cn-hangzhou.aliyuncs.com。
        private string EndPoint { get; set; } = "<YOUR-ENDPOINT>";
        // 将<YOUR-BUCKET>替换为Bucket名称。
        private string BucketName { get; set; } = "<YOUR-BUCKET>";
        private string ObjectName { get; set; } = "exampledir/exampleobject2.png";

        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);
            var app = builder.Build();

            // 添加日志
            builder.Logging.AddConsole();
            var logger = builder.Services.BuildServiceProvider().GetRequiredService<ILogger<Program>>();

            app.UseStaticFiles(); // 添加这行以启用静态文件中间件

            app.MapGet("/", async (context) =>
            {
                var filePath = Path.Combine(Directory.GetCurrentDirectory(), "templates/index.html");
                var htmlContent = await File.ReadAllTextAsync(filePath);
                await context.Response.WriteAsync(htmlContent);

                // 打印日志
                logger.LogInformation("GET request to root path");
            });

            app.MapGet("/get_presigned_url_for_oss_upload", async (context) =>
            {
                var program = new Program(logger);
                var signedUrl = program.GetSignedUrl();

                logger.LogInformation($"SignedUrl: {signedUrl}"); // 打印token的值
                await context.Response.WriteAsync(signedUrl);
            });

            app.Run();
        }

        // 构造函数注入ILogger
        public Program(ILogger<Program> logger)
        {
            _logger = logger;
        }

        private string GetSignedUrl()
        {
            // 创建OSSClient实例
            var ossClient = new OssClient(EndPoint, AccessKeyId, AccessKeySecret);

            // 生成签名URL
            var generatePresignedUriRequest = new GeneratePresignedUriRequest(BucketName, ObjectName, SignHttpMethod.Put)
            {
                Expiration = DateTime.Now.AddHours(1),
                ContentType = "image/png"
            };
            var signedUrl = ossClient.GeneratePresignedUri(generatePresignedUriRequest);

            return signedUrl.ToString();
        }
    }
}
```

客户端示例代码

Web端使用签名URL上传文件到OSS的示例代码如下：

JavaScript

```
const form = document.querySelector("form");
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const fileInput = document.querySelector("#file");
  const file = fileInput.files[0];
  fetch("/get_presigned_url_for_oss_upload", { method: "GET" })
    .then((response) => {
      if (!response.ok) {
        throw new Error("获取预签名URL失败");
      }
      return response.text();
    })
    .then((url) => {
      fetch(url, {
        method: "PUT",
        headers: new Headers({
          "Content-Type": "image/png",
        }),
        body: file,
      }).then((response) => {
        if (!response.ok) {
          throw new Error("文件上传到OSS失败");
        }
        console.log(response);
        alert("文件已上传");
      });
    })
    .catch((error) => {
      console.error("发生错误:", error);
      alert(error.message);
    });
});
```

## **客户端直传实践参考**

不同类型的客户端的直传实践参考如下：

-   [Web端直传实践](https://help.aliyun.com/zh/oss/use-postobject-to-upload-objects-by-using-web-clients)
    
-   [小程序直传实践](https://help.aliyun.com/zh/oss/user-guide/wechat-applet-uploads-files-directly-to-oss)
    
-   [移动应用端直传实践](https://help.aliyun.com/zh/oss/user-guide/set-up-direct-data-transfer-for-mobile-apps)
    
-   [鸿蒙环境直传实践](https://help.aliyun.com/zh/oss/user-guide/harmonyos-environmental-server-signature-direct-transmission)