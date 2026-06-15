OSS提供了S3 API的兼容性，可以将您的数据从Amazon S3无缝迁移至阿里云OSS。

## 注意事项

-   使用限制
    
    OSS兼容S3协议。您可以通过S3 SDK或者支持S3协议的工具执行创建Bucket、上传Object等相关操作。执行相关操作过程中带宽、QPS等限制遵循OSS性能指标，详情请参见[使用限制及性能指标](/help/zh/oss/user-guide/limits#concept-pzk-crg-tdb)。
    
-   客户端配置
    
    从Amazon S3迁移到OSS后，您仍然可以使用S3 API访问OSS，仅需要对S3的客户端应用进行如下改动：
    
    1.  获取阿里云账号或RAM用户的AccessKey ID和AccessKey Secret，并在您使用的客户端和SDK中配置您申请的AccessKey ID与AccessKey Secret。
        
    2.  设置客户端连接的Endpoint为OSS Endpoint。OSS Endpoint列表请参见[地域和Endpoint](/help/zh/oss/user-guide/regions-and-endpoints#concept-zt4-cvy-5db)。
        

## 迁移教程

您可以使用[阿里云在线迁移服务](https://mgw.console.alibabacloud.com/job?_k=r90z7u#/job?_k=xdgp8r)将Amazon S3数据轻松迁移至阿里云对象存储OSS。详情请参见[Amazon S3迁移教程](/help/zh/data-online-migration/old-version-background-information-for-migration-from-amazon-s3-to-oss#concept-pyw-sjg-qfb)。