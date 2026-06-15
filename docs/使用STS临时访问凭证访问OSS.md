通过STS服务，您可以为用户生成临时访问凭证，使其在有效期内访问受策略限制的OSS资源。超过有效期后，凭证自动失效，无法继续访问OSS资源，确保了访问控制的灵活性和时效性。

## **使用场景**

某电商企业A把海量商品数据存放在阿里云OSS中。供应商企业B需要定期向A的OSS上传数据，并通过自己的系统与企业A的阿里云资源对接。

对于信息安全方面，企业A有如下需求：

-   **数据安全**：企业A不希望将固定访问密钥（AccessKey）泄露给企业B，以免核心数据被非法获取和滥用。
    
-   **权限控制**：企业A希望暂时仅赋予企业B上传权限，后续再根据需求对权限进行动态调整，以实现对权限的精准控制。
    
-   **权限管理**：面对企业B以及后续的其他合作伙伴，企业A希望能够灵活地为每个合作伙伴或临时需求生成相应的凭证，而无需不断管理和配置固定的访问密钥（AccessKey）权限。
    
-   **限时访问控制**：企业A希望根据企业B的具体需求，限制其对数据访问的有效时间。到期后，企业B将自动失去访问权限，从而实现对数据交互时效性的严格控制。
    

## **方案概览**

企业A通过临时访问凭证授权企业B安全地将文件上传到OSS。

![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3406428771/CAEQURiBgMDogZbLpxkiIDA4YTg2NzI4ZmE2YTQwNmY4ZTQ2MGYyYjIwOGYzNDUx4904542_20250121133255.915.svg)

企业A需首先创建RAM用户和RAM角色，并完成相关授权操作。之后，企业B向企业A申请临时访问凭证，企业A调用AssumeRole接口获取STS临时访问凭证，然后将其传递给企业B。企业B拿到该凭证后，即可将数据上传至企业A的OSS中。

## 前提条件

企业A已创建Bucket。具体操作，请参见[创建存储空间](/help/zh/oss/user-guide/create-a-bucket-4)。

## **步骤一：企业A颁发临时访问凭证**

### **1\. 创建RAM用户**

使用**阿里云主账号**或拥有**访问控制（RAM）管理权限的RAM用户**创建RAM用户**。**

1.  登录[RAM控制台](https://ram.console.alibabacloud.com/)。
    
2.  在左侧导航栏，选择**身份管理** > **用户**。
    
3.  单击**创建用户**。
    
4.  输入**登录名称**和**显示名称**。
    
5.  在**访问方式**区域下，选择**使用永久 AccessKey 访问**，然后单击**确定**。
    
6.  根据界面提示，完成安全验证。
    
7.  复制访问密钥（AccessKey ID和AccessKey Secret）。
    
    **重要**
    
    RAM用户的AccessKey Secret仅在创建时显示，后续将无法查看。因此，强烈建议您及时下载包含访问密钥（AccessKey）的CSV文件，并妥善保存至本地。
    
    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4238712471/p928862.png)
    

### **2\. 为RAM用户授予请求AssumeRole的权限**

创建完RAM用户后，使用**阿里云主账号**或拥有**访问控制（RAM）管理权限的RAM用户**授予该RAM用户通过扮演角色调用STS服务的权限。

1.  登录[RAM控制台](https://ram.console.alibabacloud.com/)。
    
2.  在左侧导航栏，选择**身份管理** > **用户**，单击已创建RAM用户右侧对应的**添加权限****。**
    
3.  在**新增授权**页面，选择**AliyunSTSAssumeRoleAccess**系统策略。
    
    **说明**
    
    授予RAM用户调用STS服务AssumeRole接口的固定权限是**AliyunSTSAssumeRoleAccess**，与后续获取临时访问凭证以及通过临时访问凭证发起OSS请求所需权限无关。
    
    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4238712471/p928882.png)
    
4.  单击**确认新增授权**。
    

### **3\. 创建RAM角色**

使用**阿里云主账号**或拥有**访问控制（RAM）管理权限的RAM用户**创建RAM角色**。**用于定义RAM角色被扮演时，可以获得OSS服务的哪些访问权限。

1.  登录[RAM控制台](https://ram.console.alibabacloud.com/)。
    
2.  在左侧导航栏，选择**身份管理** **\> 角色**。
    
3.  在**角色**页面，单击**创建角色**。
    
4.  在**创建角色**页面，选择**信任主体类型**为**云账号**，然后选择**信任主体名称**为**当前云账号**，单击**确定**。
    
    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4238712471/p929062.png)
    
5.  在**创建角色**对话框，输入角色名称，然后单击**确定**。
    
6.  单击ARN右侧的**复制**，保存角色的ARN。
    
    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4238712471/p928897.png)
    

### **4\. 为RAM角色授予上传文件的权限**

创建完RAM角色后，使用**阿里云主账号**或拥有**访问控制（RAM）管理权限的RAM用户**为RAM角色附加一个或多个权限策略，明确RAM角色在被扮演时所能拥有的OSS资源访问权限。例如，如果希望RAM用户在扮演该角色后只能向OSS指定Bucket上传文件，则需要为角色添加写入权限的策略。

1.  创建上传文件的自定义权限策略。
    
    1.  登录[RAM控制台](https://ram.console.alibabacloud.com/)。
        
    2.  在左侧导航栏，选择**权限管理** > **权限策略**。
        
    3.  在**权限策略**页面，单击**创建权限策略**。
        
    4.  在**创建权限策略**页面，单击**脚本编辑**，然后在策略文档输入框中赋予角色上传文件到examplebucket的权限。具体配置示例如下。
        
        **警告**
        
        以下示例仅供参考。您需要根据实际需求配置更细粒度的授权策略，防止出现权限过大的风险。关于更细粒度的授权策略配置详情，请参见[通过RAM或STS服务向其他用户授权](/help/zh/oss/common-examples-of-ram-policies#section-vav-5et-c7g)。
        
        ```
        {
            "Version": "1",
            "Statement": [
             {
                   "Effect": "Allow",
                   "Action": [
                     "oss:PutObject"
                   ],
                   "Resource": [
                     "acs:oss:*:*:examplebucket/*"             
                   ]
             }
            ]
        }
        ```
        
        **说明**
        
        RAM角色所拥有的OSS权限取决于Action的配置，例如授予oss:PutObject权限，则RAM用户在扮演RAM角色时可以对指定Bucket执行简单上传、表单上传、追加上传、分片上传、断点续传上传等操作。更多信息，请参见[OSS Action说明](/help/zh/oss/ram-policy-overview/#section-x3c-nsm-2gb)。
        
    5.  策略配置完成后，请单击**确定**按钮，然后在**创建权限策略**弹出框中填写策略名称（例如RamTestPolicy），确认信息无误后再次单击**确定**。
        
2.  为RAM角色RamOssTest授予自定义权限策略。
    
    1.  登录[RAM控制台](https://ram.console.alibabacloud.com/)。
        
    2.  在左侧导航栏，选择**身份管理** > **角色**。
        
    3.  在**角色**页面，找到目标RAM角色RamOssTest。
        
    4.  单击RAM角色RamOssTest右侧的**新增授权**。
        
    5.  在**新增授权**页面的**权限策略**模块中，选择策略类型为**自定义策略**，随后在策略列表中选取已创建的自定义权限策略RamTestPolicy。
        
    6.  单击**确认新增授权**。
        

### **5\. 使用RAM用户扮演RAM角色获取临时访问凭证**

**重要**

STS临时访问凭证无法通过阿里云主账号的访问密钥（AccessKey）调用STS API接口获取，否则会导致报错失败。以下示例将以使用RAM用户的访问密钥（AccessKey）为例进行操作。

-   为角色授予上传文件的权限后，RAM用户需要通过扮演角色来获取临时访问凭证。临时访问凭证包括安全令牌（SecurityToken）、临时访问密钥（AccessKeyId和AccessKeySecret）以及过期时间（Expiration）。您可以使用STS SDK获取具有简单上传（`oss:PutObject`）权限的临时访问凭证。有关更多语言的STS SDK示例，请参见[STS SDK概览](/help/zh/ram/developer-reference/sts-sdk-overview#reference-w5t-25v-xdb)。
    
-   示例代码中的**endpoint**为STS服务接入点地址。为了获得更快的STS服务响应速度，您可以根据服务器所处地域，选择对应的或相近的STS服务接入点地址进行填写。有关STS服务接入点地址信息，请参见[服务接入点](/help/zh/ram/developer-reference/api-sts-2015-04-01-endpoint)。
    

## Java

```
import com.aliyuncs.DefaultAcsClient;
import com.aliyuncs.exceptions.ClientException;
import com.aliyuncs.http.MethodType;
import com.aliyuncs.profile.DefaultProfile;
import com.aliyuncs.profile.IClientProfile;
import com.aliyuncs.auth.sts.AssumeRoleRequest;
import com.aliyuncs.auth.sts.AssumeRoleResponse;
public class StsServiceSample {
    public static void main(String[] args) { 
        // STS服务接入点，例如sts.cn-hangzhou.aliyuncs.com。您可以通过公网或者VPC接入STS服务。       
        String endpoint = "sts.cn-hangzhou.aliyuncs.com";
        // 从环境变量中获取步骤1.1生成的RAM用户的访问密钥（AccessKey ID和AccessKey Secret）。
        String accessKeyId = System.getenv("ACCESS_KEY_ID");
        String accessKeySecret = System.getenv("ACCESS_KEY_SECRET");
        // 从环境变量中获取步骤1.3生成的RAM角色的RamRoleArn。
        String roleArn = System.getenv("RAM_ROLE_ARN");
        // 自定义角色会话名称，用来区分不同的令牌，例如可填写为SessionTest。        
        String roleSessionName = "yourRoleSessionName";   
        // 临时访问凭证将获得角色拥有的所有权限。      
        String policy = null;
        // 临时访问凭证的有效时间，单位为秒。最小值为900，最大值以当前角色设定的最大会话时间为准。当前角色最大会话时间取值范围为3600秒~43200秒，默认值为3600秒。
        // 在上传大文件或者其他较耗时的使用场景中，建议合理设置临时访问凭证的有效时间，确保在完成目标任务前无需反复调用STS服务以获取临时访问凭证。
        Long durationSeconds = 3600L;
        try {
            // 发起STS请求所在的地域。建议保留默认值，默认值为空字符串（""）。
            String regionId = "";
            // 添加endpoint。适用于Java SDK 3.12.0及以上版本。
            DefaultProfile.addEndpoint(regionId, "Sts", endpoint);
            // 添加endpoint。适用于Java SDK 3.12.0以下版本。
            // DefaultProfile.addEndpoint("",regionId, "Sts", endpoint);
            // 构造default profile。
            IClientProfile profile = DefaultProfile.getProfile(regionId, accessKeyId, accessKeySecret);
            // 构造client。
            DefaultAcsClient client = new DefaultAcsClient(profile);
            final AssumeRoleRequest request = new AssumeRoleRequest();
            // 适用于Java SDK 3.12.0及以上版本。
            request.setSysMethod(MethodType.POST);
            // 适用于Java SDK 3.12.0以下版本。
            // request.setMethod(MethodType.POST);
            request.setRoleArn(roleArn);
            request.setRoleSessionName(roleSessionName);
            request.setPolicy(policy); 
            request.setDurationSeconds(durationSeconds); 
            final AssumeRoleResponse response = client.getAcsResponse(request);
            System.out.println("Expiration: " + response.getCredentials().getExpiration());
            System.out.println("Access Key Id: " + response.getCredentials().getAccessKeyId());
            System.out.println("Access Key Secret: " + response.getCredentials().getAccessKeySecret());
            System.out.println("Security Token: " + response.getCredentials().getSecurityToken());
            System.out.println("RequestId: " + response.getRequestId());
        } catch (ClientException e) {
            System.out.println("Failed：");
            System.out.println("Error code: " + e.getErrCode());
            System.out.println("Error message: " + e.getErrMsg());
            System.out.println("RequestId: " + e.getRequestId());
        }
    }
}
```

## Python

```
# -*- coding: utf-8 -*-

from aliyunsdkcore import client
from aliyunsdkcore.request import CommonRequest
import json
import oss2
import os

# 从环境变量中获取步骤1.1生成的RAM用户的访问密钥（AccessKey ID和AccessKey Secret）。
access_key_id = os.getenv("ACCESS_KEY_ID")
access_key_secret = os.getenv("ACCESS_KEY_SECRET")
# 从环境变量中获取步骤1.3生成的RAM角色的RamRoleArn。
role_arn = os.getenv("RAM_ROLE_ARN")

# 创建权限策略。
clt = client.AcsClient(access_key_id, access_key_secret, 'cn-hangzhou')
request = CommonRequest(product="Sts", version='2015-04-01', action_name='AssumeRole')
request.set_method('POST')
request.set_protocol_type('https')
request.add_query_param('RoleArn', role_arn)
# 指定自定义角色会话名称，用来区分不同的令牌，例如填写为sessiontest。
request.add_query_param('RoleSessionName', 'sessiontest')
# 指定STS临时访问凭证过期时间为3600秒。
request.add_query_param('DurationSeconds', '3600')
request.set_accept_format('JSON')

body = clt.do_action_with_exception(request)

# 使用RAM用户的AccessKey ID和AccessKey Secret向STS申请临时访问凭证。
token = json.loads(oss2.to_unicode(body))
# 打印STS返回的临时访问密钥（AccessKey ID和AccessKey Secret）、安全令牌（SecurityToken）以及临时访问凭证过期时间（Expiration）。
print('AccessKeyId: ' + token['Credentials']['AccessKeyId'])
print('AccessKeySecret: ' + token['Credentials']['AccessKeySecret'])
print('SecurityToken: ' + token['Credentials']['SecurityToken'])
print('Expiration: ' + token['Credentials']['Expiration'])
```

## Node.js

```
const { STS } = require('ali-oss');
const express = require("express");
const app = express();

app.get('/sts', (req, res) => {
 let sts = new STS({
  // 从环境变量中获取步骤1.1生成的RAM用户的访问密钥（AccessKey ID和AccessKey Secret）。
   accessKeyId : process.env.ACCESS_KEY_ID,
   accessKeySecret : process.env.ACCESS_KEY_SECRET
});
  // process.env.RAM_ROLE_ARN为从环境变量中获取步骤1.3生成的RAM角色的RamRoleArn。
  // policy填写自定义权限策略，用于进一步限制STS临时访问凭证的权限。如果不指定Policy，则返回的STS临时访问凭证默认拥有指定角色的所有权限。
  // 临时访问凭证最后获得的权限是步骤4设置的角色权限和该Policy设置权限的交集。
  // expiration用于设置临时访问凭证有效时间单位为秒，最小值为900，最大值以当前角色设定的最大会话时间为准。本示例指定有效时间为3600秒。
  // sessionName用于自定义角色会话名称，用来区分不同的令牌，例如填写为sessiontest。
  sts.assumeRole('process.env.RAM_ROLE_ARN', ``, '3600', 'sessiontest').then((result) => {
    console.log(result);
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-METHOD', 'GET');
    res.json({
      AccessKeyId: result.credentials.AccessKeyId,
      AccessKeySecret: result.credentials.AccessKeySecret,
      SecurityToken: result.credentials.SecurityToken,
      Expiration: result.credentials.Expiration
    });
  }).catch((err) => {
    console.log(err);
    res.status(400).json(err.message);
  });
});
app.listen(8000,()=>{
   console.log("server listen on:8000")
})
```

## Go

```
package main

import (
    "fmt"
    "os"

    openapi "github.com/alibabacloud-go/darabonba-openapi/v2/client"
    sts20150401 "github.com/alibabacloud-go/sts-20150401/v2/client"
    util "github.com/alibabacloud-go/tea-utils/v2/service"
    "github.com/alibabacloud-go/tea/tea"
)

func main() {
    // 从环境变量中获取步骤1.1生成的RAM用户的访问密钥（AccessKey ID和AccessKey Secret）。
    accessKeyId := os.Getenv("ACCESS_KEY_ID")
    accessKeySecret := os.Getenv("ACCESS_KEY_SECRET")
    // 从环境变量中获取步骤1.3生成的RAM角色的RamRoleArn。
    roleArn := os.Getenv("RAM_ROLE_ARN")

    // 创建权限策略客户端。
    config := &openapi.Config{
        // 必填，步骤1.1获取到的 AccessKey ID。
        AccessKeyId: tea.String(accessKeyId),
        // 必填，步骤1.1获取到的 AccessKey Secret。
        AccessKeySecret: tea.String(accessKeySecret),
    }
    // Endpoint 请参考 https://api.aliyun.com/product/Sts
    config.Endpoint = tea.String("sts.cn-hangzhou.aliyuncs.com")
    client, err := sts20150401.NewClient(config)
    if err != nil {
        fmt.Printf("Failed to create client: %v\n", err)
        return
    }

    // 使用RAM用户的AccessKey ID和AccessKey Secret向STS申请临时访问凭证。
    request := &sts20150401.AssumeRoleRequest{
        // 指定STS临时访问凭证过期时间为3600秒。
        DurationSeconds: tea.Int64(3600),
        // 从环境变量中获取步骤1.3生成的RAM角色的RamRoleArn。
        RoleArn: tea.String(roleArn),
        // 指定自定义角色会话名称，这里使用和第一段代码一致的 examplename
        RoleSessionName: tea.String("examplename"),
    }
    response, err := client.AssumeRoleWithOptions(request, &util.RuntimeOptions{})
    if err != nil {
        fmt.Printf("Failed to assume role: %v\n", err)
        return
    }

    // 打印STS返回的临时访问密钥（AccessKey ID和AccessKey Secret）、安全令牌（SecurityToken）以及临时访问凭证过期时间（Expiration）。
    credentials := response.Body.Credentials
    fmt.Println("AccessKeyId: " + tea.StringValue(credentials.AccessKeyId))
    fmt.Println("AccessKeySecret: " + tea.StringValue(credentials.AccessKeySecret))
    fmt.Println("SecurityToken: " + tea.StringValue(credentials.SecurityToken))
    fmt.Println("Expiration: " + tea.StringValue(credentials.Expiration))
}
```

## php

```
<?php
require __DIR__ . '/vendor/autoload.php';

use AlibabaCloud\Client\AlibabaCloud;
use AlibabaCloud\Client\Exception\ClientException;
use AlibabaCloud\Client\Exception\ServerException;
use AlibabaCloud\Sts\Sts;

// 从环境变量中获取步骤1.1生成的RAM用户的访问密钥（AccessKey ID和AccessKey Secret）。
$accessKeyId = getenv("ACCESS_KEY_ID");
$accessKeySecret = getenv("ACCESS_KEY_SECRET");
// 从环境变量中获取步骤1.3生成的RAM角色的RamRoleArn。
$roleArn = getenv("RAM_ROLE_ARN");

// 初始化阿里云客户端。
AlibabaCloud::accessKeyClient($accessKeyId, $accessKeySecret)
    ->regionId('cn-hangzhou')
    ->asDefaultClient();

try {
    // 创建STS请求。
    $result = Sts::v20150401()
        ->assumeRole()
        // 设置角色ARN。
        ->withRoleArn($roleArn)
        // 指定自定义角色会话名称，用来区分不同的令牌。
        ->withRoleSessionName('sessiontest')
        // 指定STS临时访问凭证过期时间为3600秒。
        ->withDurationSeconds(3600)
        ->request();

    // 获取响应中的凭证信息。
    $credentials = $result['Credentials'];

    // 打印STS返回的临时访问密钥（AccessKey ID和AccessKey Secret）、安全令牌（SecurityToken）以及临时访问凭证过期时间（Expiration）。
    echo 'AccessKeyId: ' . $credentials['AccessKeyId'] . PHP_EOL;
    echo 'AccessKeySecret: ' . $credentials['AccessKeySecret'] . PHP_EOL;
    echo 'SecurityToken: ' . $credentials['SecurityToken'] . PHP_EOL;
    echo 'Expiration: ' . $credentials['Expiration'] . PHP_EOL;
} catch (ClientException $e) {
    // 处理客户端异常。
    echo $e->getErrorMessage() . PHP_EOL;
} catch (ServerException $e) {
    // 处理服务端异常。
    echo $e->getErrorMessage() . PHP_EOL;
}
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

# 设置public文件夹路径为当前文件夹下的templates文件夹。
set :public_folder, File.dirname(__FILE__) + '/templates'

def get_sts_token_for_oss_upload()
  client = RPCClient.new(
    # 从环境变量中获取步骤1.1生成的RAM用户的访问密钥（AccessKey ID和AccessKey Secret）。
    access_key_id: ENV['ACCESS_KEY_ID'],
    access_key_secret: ENV['ACCESS_KEY_SECRET'],
    endpoint: 'https://sts.cn-hangzhou.aliyuncs.com',
    api_version: '2015-04-01'
  )
  response = client.request(
    action: 'AssumeRole',
    params: {
      # 从环境变量中获取步骤1.3生成的RAM角色的RamRoleArn。
      "RoleArn": ENV['RAM_ROLE_ARN'],
      # 指定STS临时访问凭证过期时间为3600秒。
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

$server_ip = "127.0.0.1"  #如果需要监听其他地址如0.0.0.0，需要您自行在服务端添加认证机制
$server_port = 8000

puts "App server is running on: http://#{$server_ip}:#{$server_port}"

set :bind, $server_ip
set :port, $server_port

get '/get_sts_token_for_oss_upload' do
  token = get_sts_token_for_oss_upload()
  response = {
    "AccessKeyId" => token["Credentials"]["AccessKeyId"],
    "AccessKeySecret" => token["Credentials"]["AccessKeySecret"],
    "SecurityToken" => token["Credentials"]["SecurityToken"],
    "Expiration" => token["Credentials"]["Expiration"]
  }
  response.to_json
end

get '/*' do
  puts "********************* GET "
  send_file File.join(settings.public_folder, 'index.html')
end
```

-   **已获取到STS临时访问凭证，详情如下**：
    
    **说明**
    
    -   一个阿里云账号及该账号下的RAM用户、RAM角色，调用STS服务获取临时访问凭证最多100次/秒。在并发数较大的情况下，建议在有效期内复用临时访问凭证。
        
    -   STS临时访问凭证的有效时间采用UTC（协调世界时）格式。UTC时间与北京时间有8小时时差，为正常情况。例如：临时访问凭证过期时间是2024-04-18T11:33:40Z，说明临时访问凭证将在北京时间2024年4月18日19时33分40秒之前过期。
        
    
    ```
    {
      "AccessKeyId": "STS.****************",
      "AccessKeySecret": "3dZn*******************************************",
      "SecurityToken": "CAIS*****************************************************************************************************************************************",
      "Expiration": "2024-**-*****:**:50Z"
    }
    ```
    

-   **若您需要对临时访问权限进行更细粒度的配置，可参考以下内容。**
    
    如果您希望临时访问凭证在获得角色拥有的权限后，进一步限制权限范围，例如角色被授予了上传文件到examplebucket的权限，您需要限制临时访问凭证只能向该Bucket下的某个目录上传文件，您可以通过参考以下示例设置policy。
    
    ```
    // 以下Policy用于限制仅允许使用临时访问凭证向examplebucket下的src目录上传文件。
    // 临时访问凭证最后获得的权限是步骤4设置的角色权限和该Policy设置权限的交集，即仅允许将文件上传至examplebucket下的src目录。      
    String policy = "{\n" +
                    "    \"Version\": \"1\", \n" +
                    "    \"Statement\": [\n" +
                    "        {\n" +
                    "            \"Action\": [\n" +
                    "                \"oss:PutObject\"\n" +
                    "            ], \n" +
                    "            \"Resource\": [\n" +
                    "                \"acs:oss:*:*:examplebucket/src/*\" \n" +
                    "            ], \n" +
                    "            \"Effect\": \"Allow\"\n" +
                    "        }\n" +
                    "    ]\n" +
                    "}";
    ```
    

## **步骤二：企业B使用临时访问凭证上传文件到OSS**

**重要**

根据[策略调整](https://www.alibabacloud.com/zh/notice/oss_update_notice_policy_change_in_calling_data_api_operations_via_the_default_public_domain_name_45a)，为提升OSS服务的合规性和安全性，自**2025年3月20日起，新开通OSS服务的用户**在中国内地地域的Bucket将无法通过默认外网域名调用数据操作类API（如上传、下载文件），需[通过自定义域名](/help/zh/oss/user-guide/access-buckets-via-custom-domain-names)（CNAME）方式访问OSS服务。使用HTTPS协议访问（如控制台）时，还需为自定义域名[配置SSL证书](/help/zh/oss/user-guide/access-oss-by-https-protocol)。

以下示例展示了如何在临时访问凭证有效期（Expiration）到期之前，使用临时访问凭证上传文件至OSS。如需查看SDK安装指南及各编程语言使用临时访问凭证操作OSS（如文件上传、下载等）的代码示例，请参见[SDK参考](/help/zh/oss/developer-reference/overview-21#concept-dcn-tp1-kfb)。

## Java

```
import com.aliyun.oss.*;
import com.aliyun.oss.common.auth.CredentialsProvider;
import com.aliyun.oss.common.auth.DefaultCredentialProvider;
import com.aliyun.oss.common.comm.SignVersion;
import com.aliyun.oss.model.PutObjectRequest;
import com.aliyun.oss.model.PutObjectResult;

import java.io.File;

public class Demo {

    public static void main(String[] args) throws Exception {
        // 请填写步骤1.5生成的临时访问密钥AccessKey ID、AccessKey Secret和SecurityToken，而非RAM用户的身份凭证信息
        // 请注意区分STS服务获取的AccessKey ID是以STS开头
        String accessKeyId = "yourSTSAccessKeyID";
        String accessKeySecret = "yourSTSAccessKeySecret";
        // 填写获取的STS安全令牌（SecurityToken）。
        String stsToken= "yourSecurityToken";

        // 使用DefaultCredentialProvider方法直接设置AK和SK
        CredentialsProvider credentialsProvider = new DefaultCredentialProvider(accessKeyId, accessKeySecret, stsToken);
        // 使用credentialsProvider初始化客户端
        ClientBuilderConfiguration clientBuilderConfiguration = new ClientBuilderConfiguration();
        // 显式声明使用 V4 签名算法
        clientBuilderConfiguration.setSignatureVersion(SignVersion.V4);
        // 创建OSSClient实例。
        // 当OSSClient实例不再使用时，调用shutdown方法以释放资源。
        OSS ossClient = OSSClientBuilder.create()
                 // 请设置目的OSS访问域名  例如杭州地域：https://oss-cn-hangzhou.aliyuncs.com
                .endpoint("endpoint")
                .credentialsProvider(credentialsProvider)
                .clientConfiguration(clientBuilderConfiguration)
                // 请设置为目标Bucket所处region  例如杭州地域：cn-hangzhou
                .region("region")
                .build();

        try {

            // 创建PutObjectRequest对象，将本地文件exampletest.txt上传至examplebucket
            PutObjectRequest putObjectRequest = new PutObjectRequest("examplebucket", "exampletest.txt", new File("D:\\localpath\\exampletest.txt"));

            // 如果需要上传时设置存储类型和访问权限，请参考以下示例代码。
            // ObjectMetadata metadata = new ObjectMetadata();
            // metadata.setHeader(OSSHeaders.OSS_STORAGE_CLASS, StorageClass.Standard.toString());
            // metadata.setObjectAcl(CannedAccessControlList.Private);
            // putObjectRequest.setMetadata(metadata);

            // 上传文件
            PutObjectResult result = ossClient.putObject(putObjectRequest);
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
        } finally {
            if (ossClient != null) {
                ossClient.shutdown();
            }
        }
    }
}
```

## Python

Python SDK目前提供V2和V1两个版本。V2在V1基础上全面重构，简化了身份验证、请求重试、错误处理等底层操作，提供更灵活的参数配置和新的高级接口。请根据您的实际使用需求，参考如下示例。

## V2示例

```
import alibabacloud_oss_v2 as oss

def main():
    # 请填写步骤1.5生成的临时访问密钥AccessKey ID、AccessKey Secret和SecurityToken，而非RAM用户的身份凭证信息
    # 请注意区分STS服务获取的AccessKey ID是以STS开头
    sts_access_key_id = 'yourSTSAccessKeyID'
    sts_access_key_secret = 'yourSTSAccessKeySecret'
    # 填写获取的STS安全令牌（SecurityToken）
    sts_security_token = 'yourSecurityToken'
    
    # 创建静态凭证提供者，显式设置临时访问密钥AccessKey ID和AccessKey Secret，以及STS安全令牌
    credentials_provider = oss.credentials.StaticCredentialsProvider(
        access_key_id=sts_access_key_id,
        access_key_secret=sts_access_key_secret,
        security_token=sts_security_token,
    )

    # 加载SDK的默认配置，并设置凭证提供者
    cfg = oss.config.load_default()
    cfg.credentials_provider = credentials_provider

    # 填写Bucket所在地域。以华东1（杭州）为例，Region填写为cn-hangzhou
    cfg.region = 'cn-hangzhou'

    # 使用配置好的信息创建OSS客户端
    client = oss.Client(cfg)

    # 待上传本地文件路径  例如 D:\\localpath\\exampletest.txt
    local_file_path = 'D:\\localpath\\exampletest.txt'
    with open(local_file_path, 'rb') as file:
        data = file.read()

    # 执行上传对象的请求，将本地文件exampletest.txt上传至examplebucket，指定存储空间名称、对象名称和上传文件
    result = client.put_object(oss.PutObjectRequest(
        # Bucket名称
        bucket='examplebucket',
        # 上传到Bucket中的对象名称
        key='exampletest.txt',
        body=data,
    ))

     # 输出请求的结果状态码、请求ID、内容MD5、ETag、CRC64校验码和版本ID，用于检查请求是否成功
    print(f'status code: {result.status_code},'
          f' request id: {result.request_id},'
          f' content md5: {result.content_md5},'
          f' etag: {result.etag},'
          f' hash crc64: {result.hash_crc64},'
          f' version id: {result.version_id},'
    )


# 当此脚本被直接运行时，调用main函数
if __name__ == "__main__":
    main()  # 脚本入口，当文件被直接运行时调用main函数
```

## V1示例

```
# -*- coding: utf-8 -*-
import oss2

# yourEndpoint填写Bucket所在地域对应的Endpoint。以华东1（杭州）为例，Endpoint填写为https://oss-cn-hangzhou.aliyuncs.com。
endpoint = 'https://oss-cn-hangzhou.aliyuncs.com'
# 填写步骤1.5生成的临时访问密钥AccessKey ID和AccessKey Secret，非阿里云账号AccessKey ID和AccessKey Secret。
sts_access_key_id = 'yourAccessKeyId'
sts_access_key_secret = 'yourAccessKeySecret'
# 填写Bucket名称。
bucket_name = 'examplebucket'
# 填写Object完整路径和字符串。Object完整路径中不能包含Bucket名称。 
object_name = 'examplebt.txt'
# 填写步骤1.5生成的STS安全令牌（SecurityToken）。
security_token = 'yourSecurityToken'
# 使用临时访问凭证中的认证信息初始化StsAuth实例。
auth = oss2.StsAuth(sts_access_key_id,
                    sts_access_key_secret,
                    security_token)
# 使用StsAuth实例初始化存储空间。
bucket = oss2.Bucket(auth, endpoint, bucket_name)
# 上传Object。
result = bucket.put_object(object_name, "hello world")
print(result.status)
```

## Go

Go SDK目前提供V2和V1两个版本。V2在V1基础上全面重构，简化了身份验证、请求重试、错误处理等底层操作，提供更灵活的参数配置和新的高级接口。请根据您的实际使用需求，参考如下示例。

## V2示例

```
package main

import (
	"context"
	"log"

	"github.com/aliyun/alibabacloud-oss-go-sdk-v2/oss"
	"github.com/aliyun/alibabacloud-oss-go-sdk-v2/oss/credentials"
)

func main() {
	// 填写Bucket所在地域。以华东1（杭州）为例，Region填写为cn-hangzhou
	region := "cn-hangzhou"

	// 请填写步骤1.5生成的临时访问密钥AccessKey ID、AccessKey Secret和SecurityToken，而非RAM用户的身份凭证信息
        // 请注意区分STS服务获取的AccessKey ID是以STS开头
	accessKeyID := "yourSTSAccessKeyID"
	accessKeySecret := "yourSTSAccessKeySecret"
	// 填写获取的STS安全令牌（SecurityToken）
	stsToken := "yourSecurityToken"

	// 使用NewStaticCredentialsProvider方法直接设置AK、SK和STS Token
	provider := credentials.NewStaticCredentialsProvider(accessKeyID, accessKeySecret, stsToken)

	// 加载默认配置并设置凭证提供者和区域
	cfg := oss.LoadDefaultConfig().
		WithCredentialsProvider(provider).
		WithRegion(region)

	// 创建OSS客户端
	client := oss.NewClient(cfg)

	// 填写要上传的本地文件路径和文件名称，例如 D:\\localpath\\exampletest.txt
	localFile := "D:\\localpath\\exampletest.txt"

	// 创建上传对象的请求
	putRequest := &oss.PutObjectRequest{
		Bucket:       oss.Ptr("examplebucket"),      // Bucket名称
		Key:          oss.Ptr("exampletest.txt"),    // 上传到Bucket中的对象名称
		StorageClass: oss.StorageClassStandard, // 指定对象的存储类型为标准存储
		Acl:          oss.ObjectACLPrivate,     // 指定对象的访问权限为私有访问
		Metadata: map[string]string{
			"yourMetadataKey1": "yourMetadataValue1", // 设置对象的元数据
		},
	}

	// 执行上传对象的请求，将本地文件exampletest.txt上传至examplebucket
	result, err := client.PutObjectFromFile(context.TODO(), putRequest, localFile)
	if err != nil {
		log.Fatalf("failed to put object from file %v", err)
	}

	// 打印上传对象的结果
	log.Printf("put object from file result:%#v\n", result)
	
}
```

## V1示例

```
package main

import (
    "fmt"
    "github.com/aliyun/aliyun-oss-go-sdk/oss"
    "os"
)

func main() {
    // 从环境变量中获取步骤1.5生成的临时访问凭证。运行本代码示例之前，请确保已设置环境变量OSS_ACCESS_KEY_ID、OSS_ACCESS_KEY_SECRET、OSS_SESSION_TOKEN。
    provider, err := oss.NewEnvironmentVariableCredentialsProvider()
    if err != nil {
        fmt.Println("Error:", err)
        os.Exit(-1)
    }
    // 创建OSSClient实例。
    // yourEndpoint填写Bucket对应的Endpoint，以华东1（杭州）为例，填写为https://oss-cn-hangzhou.aliyuncs.com。其它Region请按实际情况填写。
    client, err := oss.New("yourEndpoint", "", "", oss.SetCredentialsProvider(&provider))
    if err != nil {
        fmt.Println("Error:", err)
        os.Exit(-1)
    }
    // 填写Bucket名称，例如examplebucket。
    bucketName := "examplebucket"
    // 填写Object的完整路径，完整路径中不能包含Bucket名称，例如exampledir/exampleobject.txt。
    objectName := "exampledir/exampleobject.txt"
    // 填写本地文件的完整路径，例如D:\\localpath\\examplefile.txt。
    filepath := "D:\\localpath\\examplefile.txt"
    bucket, err := client.Bucket(bucketName)
    if err != nil {
        fmt.Println("Error:", err)
        os.Exit(-1)
    }
    // 通过STS授权第三方上传文件。
    err = bucket.PutObjectFromFile(objectName, filepath)
    if err != nil {
        fmt.Println("Error:", err)
        os.Exit(-1)
    }
    fmt.Println("upload success")
}
```

## Node.js

**说明**

此步骤中的示例需要依赖axios，请在运行前下载。

```
const axios = require("axios");
const OSS = require("ali-oss");

// 在客户端使用临时访问凭证初始化OSS客户端，用于临时授权访问OSS资源
const getToken = async () => {
  // 设置客户端请求访问凭证的地址。
  await axios.get("http://localhost:8000/sts").then((token) => {
    const client = new OSS({
       // yourRegion填写Bucket所在地域。以华东1（杭州）为例，yourRegion填写为oss-cn-hangzhou
      region: 'oss-cn-hangzhou',
      // 填写步骤1.5生成的临时访问密钥AccessKey ID和AccessKey Secret，非阿里云账号AccessKey ID和AccessKey Secret
      accessKeyId: token.data.AccessKeyId,
      accessKeySecret: token.data.AccessKeySecret,
      // 填写步骤1.5生成的STS安全令牌（SecurityToken）
      stsToken: token.data.SecurityToken,
      authorizationV4: true,
      // 填写Bucket名称
      bucket: "examplebucket",
      // 刷新临时访问凭证
      refreshSTSToken: async () => {
        const refreshToken = await axios.get("http://localhost:8000/sts");
        return {
          accessKeyId: refreshToken.data.AccessKeyId,
          accessKeySecret: refreshToken.data.AccessKeySecret,
          stsToken: refreshToken.data.SecurityToken,
        };
      },
    });
    // 使用临时访问凭证上传文件
    // 填写不包含Bucket名称在内的Object的完整路径，例如exampleobject.jpg
    // 填写本地文件的完整路径，例如D:\\example.jpg
    client.put('exampleobject.jpg', 'D:\\example.jpg').then((res)=>{console.log(res)}).catch(e=>console.log(e))
  });
};
getToken()
```

## php

```
<?php
if (is_file(__DIR__ . 'autoload.php')) {
    require_once __DIR__ . 'autoload.php';
}
if (is_file(__DIR__ . '/vendor/autoload.php')) {
    require_once __DIR__ . '/vendor/autoload.php';
}

use OSS\Credentials\StaticCredentialsProvider;
use OSS\OssClient;
use OSS\Core\OssException;

try {
    // 请填写步骤1.5生成的临时访问密钥AccessKey ID、AccessKey Secret和SecurityToken，而非RAM用户的身份凭证信息
    // 请注意区分STS服务获取的AccessKey ID是以STS开头
    $accessKeyId = 'yourSTSAccessKeyID';
    $accessKeySecret = 'yourSTSAccessKeySecret';
    // 填写获取的STS安全令牌（SecurityToken）
    $securityToken = 'yourSecurityToken';

    // 使用StaticCredentialsProvider类创建凭证提供者
    $provider = new StaticCredentialsProvider($accessKeyId, $accessKeySecret, $securityToken);

    // 填写Bucket所在地域对应的Endpoint。以华东1（杭州）为例，Endpoint填写为https://oss-cn-hangzhou.aliyuncs.com
    $endpoint = "https://oss-cn-hangzhou.aliyuncs.com";

    // 填写Bucket名称，例如examplebucket。
    $bucket= "examplebucket";
    // 填写上传到Bucket中的对象名称
    $object = "exampletest.txt";
    // 填写待上传本地文件路径，例如 D:\\localpath\\exampletest.txt
    $localFilePath = "D:\\localpath\\exampletest.txt";

    // 上传时可以设置相关的headers，例如设置访问权限为private、自定义元数据等
    $options = array(
        OssClient::OSS_HEADERS => array(
            'x-oss-object-acl' => 'private',
            'x-oss-meta-info' => 'yourinfo'
        ),
    );

    $config = array(
        "provider" => $provider,
        "endpoint" => $endpoint,
        "signatureVersion" => OssClient::OSS_SIGNATURE_VERSION_V4,
        // 填写Bucket所在地域。以华东1（杭州）为例，Region填写为cn-hangzhou
        "region" => "cn-hangzhou"
    );
    
    // 使用配置好的信息创建OSS客户端
    $ossClient = new OssClient($config);
    
     // 发送请求 将本地文件exampletest.txt上传至examplebucket
    $ossClient->putObject($bucket, $object, $localFilePath, $options);
} catch (OssException $e) {
    printf($e->getMessage() . "\n");
    return;
}
```

## Ruby

```
require 'aliyun/sts'
require 'aliyun/oss'

client = Aliyun::OSS::Client.new(
  # Endpoint以华东1（杭州）为例，其它Region请按实际情况填写。
  endpoint: 'https://oss-cn-hangzhou.aliyuncs.com',
  # 填写步骤1.5生成的临时访问密钥AccessKey ID和AccessKey Secret，非阿里云账号AccessKey ID和AccessKey Secret。
  access_key_id: 'token.access_key_id',
  access_key_secret: 'token.access_key_secret',
  # 填写步骤1.5生成的STS安全令牌（SecurityToken）。
  sts_token: 'token.security_token'
  )
# 填写Bucket名称，例如examplebucket。
bucket = client.get_bucket('examplebucket')
# 上传文件。
bucket.put_object('exampleobject.txt', :file => 'D:\test.txt')
```

## 常见问题

### **报错****You are not authorized to do this action. You should be authorized by RAM.****如何处理？**

[步骤1.5](#22aaaef49fo24)中使用RAM用户扮演RAM角色获取临时访问凭证时，必须使用RAM用户的访问密钥（AccessKey ID和AccessKey Secret），不能使用阿里云账号的访问密钥发起请求。

### **报错****The Min/Max value of DurationSeconds is 15min/1hr.****如何处理？**

报错原因是设置的临时访问凭证有效期超出允许的时间范围。请遵循以下原则设置有效期：

-   如果没有自定义角色最大会话时间，则当前角色会话时间默认值为3600秒。此时，通过durationSeconds设置的临时访问凭证有效时间允许的最小值为900秒，最大值为3600秒。
    
-   如果自定义了角色最大会话时间，则通过durationSeconds设置的临时访问凭证有效时间的最小值为900秒，最大值以角色最大会话时间为准。角色会话时间允许设置的取值范围为3600秒~43200秒。
    

您可以通过RAM控制台查看角色最大会话时间。具体步骤，请参见[查看RAM角色](/help/zh/ram/user-guide/view-the-information-about-a-ram-role)。

### 报错The security token you provided is invalid.如何处理？

请确保完整填写[步骤1.5](#22aaaef49fo24)获取到的SecurityToken。

### 报错The OSS Access Key Id you provided does not exist in our records.如何处理？

临时访问凭证已过期，过期后自动失效。请使用临时访问密钥（AccessKeyId和AccessKeySecret）向App服务器申请新的临时访问凭证。具体操作，请参见[步骤1.5](#22aaaef49fo24)。

### 报错AccessDenied : Anonymous access is forbidden for this operation.如何处理？

通过[步骤1.5](#22aaaef49fo24)获取临时访问凭证时，您需要使用填写[步骤1.1](#4c29513276oi4)生成的RAM用户访问密钥AccessKey ID和AccessKey Secret，非阿里云账号AccessKey ID和AccessKey Secret。

### 报错NoSuchBucket如何处理？

出现该报错的原因是指定的Bucket不存在。请检查并配置正确的Bucket名称。

### 通过临时访问凭证操作OSS资源时报错You have no right to access this object because of bucket acl.如何处理？

出现该报错通常是Policy设置错误。关于Policy中涉及各元素的填写要求，请参见[RAM Policy概述](/help/zh/oss/ram-policy-overview/#concept-y5r-5rm-2gb)。如果您需要获取具有分片上传、追加上传等权限的临时访问凭证，您需要通过Policy中的Action元素授予对应权限。关于OSS Action的更多信息，请参见[OSS Action分类](/help/zh/oss/ram-policy-overview/#section-x3c-nsm-2gb)。

### 通过临时访问凭证操作OSS资源时报错Access denied by authorizer's policy.如何处理？

出现该报错通常是无权限执行相关操作。申请临时访问凭证之前，需要创建用于获取临时访问凭证的RAM角色并完成角色授权（本文档[步骤1.4](#49db74cd85ifj)）。向STS服务器发起扮演该角色的请求，以获取临时访问凭证时可以通过policy参数进一步限制临时访问凭证的权限（本文档[步骤1.5](#22aaaef49fo24)）。

-   如果设置policy，则临时访问凭证最终的权限是RAM角色权限策略与policy权限策略的交集。
    
    -   示例1
        
        如下图所示，A代表RAM角色的权限，B代表通过policy参数设置的权限，C代表临时访问凭证最终的权限。
        
        ![1.jpg](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=)
        
    -   示例2
        
        如下图所示，A代表RAM角色权限，B代表通过policy参数设置的权限，且policy参数设置的权限是RAM角色权限的子集。因此，B代表临时访问凭证的最终权限。
        
        ![2.jpg](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=)
        
-   如果不设置policy，则临时访问凭证具有与RAM角色相同的权限策略。
    

### 报错The bucket you are attempting to access must be addressed using the specified endpoint.如何处理？

出现该报错的原因是[步骤二](#cf7a34c8b1jsf)中的Endpoint参数填写错误。您需要根据Bucket所在Region填写对应的Endpoint。关于Region与Endpoint对应关系的说明，请参见[地域和Endpoint](/help/zh/oss/user-guide/regions-and-endpoints#concept-zt4-cvy-5db)。

### 是否支持同时获取多个临时访问凭证？

支持。发起一次请求仅返回一个临时访问凭证。如果您希望获取多个临时访问凭证，您需要发起多次请求。在有效期内，您可以同时使用获取到的多个临时访问凭证。

### **报错时间格式不正确如何处理？**

如果调用时报错时间格式不正确，可能是由于Timestamp参数中间多余空格，请排查修改。

请求的时间戳日期格式按照ISO8601标准表示，并需要使用UTC时间。格式为：YYYY-MM-DDThh:mm:ssZ。例如，2014-05-26T12:00:00Z（为北京时间2014年5月26日20点0分0秒）。

### **返回0003-0000301怎么处理？**

返回0003-0000301原因是临时访问凭证不具有执行OSS相关操作的权限，解决方案请参见[0003-00000301](/help/zh/oss/user-guide/0003-00000301)。

## **相关文档**

-   如果您希望从服务端获取STS临时访问凭证后，通过客户端上传文件，且上传文件时需要限制上传的文件大小、上传的文件类型、上传到Bucket的具体路径等，请参见[客户端直传](/help/zh/oss/user-guide/uploading-objects-to-oss-directly-from-clients/)。
    
-   通过STS临时访问凭证授权上传文件到OSS后，您可以通过签名URL的方式将文件分享给第三方用户进行预览或者下载。具体操作，请参见[使用预签名URL下载或预览文件](/help/zh/oss/user-guide/how-to-obtain-the-url-of-a-single-object-or-the-urls-of-multiple-objects)。