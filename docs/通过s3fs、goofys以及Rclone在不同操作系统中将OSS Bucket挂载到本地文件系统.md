本文介绍如何通过s3fs、goofys以及Rclone在不同操作系统中将OSS Bucket挂载到本地文件系统，让您能够像操作本地文件一样操作OSS的对象（Object），实现数据的共享。

## **前提条件**

-   已创建RAM用户并获取访问密钥（AccessKey）。具体操作，请参见[创建RAM用户](/help/zh/ram/create-a-ram-user-1)。
    
-   为已创建的RAM用户授予系统权限或自定义权限。
    
    -   系统权限：您可以为RAM用户授予管理OSS的权限AliyunOSSFullAccess或者只读访问OSS的权限AliyunOSSReadOnlyAccess。
        
    -   自定义权限：您还可以结合业务场景，通过创建自定义权限实现OSS的细粒度权限控制。更多信息，请参见[RAM Policy常见示例](/help/zh/oss/common-examples-of-ram-policies)。
        

## **s3fs**

s3fs支持您在Linux，macOS系统中，将存储空间挂载到本地文件系统，让您能够像操作本地文件一样操作对象，实现数据的共享。关于s3fs的更多信息，请参见[GitHub](https://github.com/s3fs-fuse/s3fs-fuse/wiki)。如果您在s3fs使用过程中遇到问题，请参见[常见问题](https://github.com/s3fs-fuse/s3fs-fuse/wiki/FAQ)进行排查。

### **主要特点**

-   支持POSIX文件系统的大部分功能，例如上传和下载文件、目录、 软链接、设置用户权限等。
    
-   支持随机写和追加写。
    
-   不支持硬链接。
    
-   大文件通过分片方式上传。
    
-   依赖本地文件作为缓存。
    

**重要**

通过s3fs上传或者下载文件时，需要经过本地缓存，其读写性能取决于磁盘的速度。由于s3fs缓存可以无限增长，请确保定期清除。

### **操作步骤**

通过s3fs挂载存储空间的步骤如下：

1.  安装s3fs。
    

以下仅列举Ubuntu、CentOS以及Mac系统安装s3fs的命令。关于其他系统安装s3fs的更多信息，请参见[s3fs安装](https://github.com/s3fs-fuse/s3fs-fuse#installation)。

-   Ubuntu
    
    ```
    sudo apt install s3fs 
    ```
    
-   CentOS
    
    ```
    sudo yum install epel-release 
    sudo yum install s3fs-fuse
    ```
    
-   Mac
    
    ```
    brew install --cask macfuse 
    brew install gromgit/fuse/s3fs-mac
    ```
    

2.  配置账号访问信息。
    
    将具有Bucket访问权限的AccessKey ID和AccessKey Secret信息存放在.passwd-s3fs文件中。
    
    ```
    echo ACCESS_KEY_ID:ACCESS_KEY_SECRET > ${HOME}/.passwd-s3fs
    ```
    
3.  将.passwd-s3fs文件的权限设置为600。
    
    ```
    chmod 600 ${HOME}/.passwd-s3fs
    ```
    
4.  挂载存储空间。
    
    1.  创建挂载点。
        
        ```
        mkdir /tmp/oss-bucket
        ```
        
    2.  将华东1（杭州）地域的examplebucket挂载至/tmp/oss-bucket。
        
        ```
        s3fs examplebucket /tmp/oss-bucket -o passwd_file=$HOME/.passwd-s3fs -ourl=http://oss-cn-hangzhou.aliyuncs.com
        ```
        
        **说明**
        
        -   如果是与OSS同地域的ECS访问，您可以使用oss-cn-hangzhou-internal.aliyuncs.com的内网endpoint。更多信息，请参见[地域和Endpoint](/help/zh/oss/user-guide/regions-and-endpoints)。
            
        -   关于s3fs支持参数的更多信息，请参见[s3fs-fuse](https://github.com/s3fs-fuse/s3fs-fuse/wiki/Fuse-Over-Amazon)。
            
        

## **goofys**

goofys支持您在Linux，macOS系统中，将存储空间挂载到本地文件系统中。goofys仅支持少量的POSIX文件系统功能。关于goofys的详细说明，请参考[GitHub](https://github.com/kahing/goofys/blob/master/README.md)。

### **主要特点**

-   仅支持顺序写。
    
-   不保存文件的权限和属性。
    
-   不支持软链接和硬链接。
    
-   创建时间（ctime）、访问时间（atime）与修改时间（mtime）保持一致。
    
-   不依赖本地缓存。
    

由于不支持对文件元数据的操作，在一些依赖文件元数据的场景，goofys存在使用限制。

由于不依赖本地缓存，相对于s3fs，goofys在cp，mv等操作上有更好的读写性能。更多信息，请参见[Benchmark](https://github.com/kahing/goofys#Benchmark)。

由于不支持随机写，goofys更适用于只读的场景上使用。

您可以根据实际的业务特性，灵活选择。

### **操作步骤**

通过goofys挂载存储空间的步骤如下：

1.  安装goofys。
    

以下仅列举Linux以及Mac系统安装goofys的命令。关于其他系统安装goofys的更多信息，请参见[goofys安装](https://github.com/kahing/goofys#Installation)。

-   Linux
    
    ```
    curl -SL "https://github.com/kahing/goofys/releases/latest/download/goofys" -o $HOME/goofys
    chmod u+x $HOME/goofys
    ```
    
-   Mac
    
    ```
    brew cask install osxfuse
    brew install goofys
    ```
    

2.  配置账号访问信息。
    
    1.  创建配置文件。
        
        ```
        mkdir ~/.aws
        ```
        
    2.  打开配置文件。
        
        ```
        vi ~/.aws/credentials
        ```
        
    3.  配置访问密钥AccessKey ID和AccessKey Secret。
        
        ```
        [default]
        aws_access_key_id =  访问OSS的AccessKey ID。
        aws_secret_access_key = 访问OSS的AccessKey Secret。
        ```
        
3.  挂载存储空间。
    
    以将华东1（杭州）地域的examplebucket挂载到/mnt/oss-bucket下为例。
    
    1.  创建挂载点。
        
        ```
        mkdir /mnt/oss-bucket
        ```
        
    2.  将examplebucket挂载到/mnt/oss-bucket。
        
        ```
        $HOME/goofys --endpoint http://oss-cn-hangzhou.aliyuncs.com --subdomain examplebucket /mnt/oss-bucket
        ```
        
        **说明**
        
        -   以上示例中的--subdomain为必选项，用于启用虚拟域名。其他选项，例如挂载的Bucket，Bucket所在地域对应的endpoint以及挂载点信息，请根据实际情况替换。
            
        -   如果是与OSS同地域的ECS访问，您可以使用oss-cn-hangzhou-internal.aliyuncs.com的内网endpoint。
            
        

## **Rclone**

Rclone是一个命令行程序，用于管理云存储中的数据，支持在50多种云存储产品间同步数据。相对于s3fs和goofys，Rclone还支持将存储空间挂载到Windows系统上，作为本地磁盘共享数据。

### **主要特点**

-   Rclone支持文件同步、文件传输、加密、挂载等。
    
-   Rclone支持多种系统，能让您将存储空间挂载到本地文件系统中，并通过多种协议提供服务。
    

关于Rclone的介绍，请参见[Rclone](https://rclone.org/)。

### **操作步骤**

在Windows操作系统下，通过Rclone挂载存储空间的步骤如下：

1.  下载并按照页面指引安装Winfsp。
    
    以下载winfsp-1.12.22339版本为例。下载地址，请参见[Winfsp](https://github.com/winfsp/winfsp/releases)。
    
2.  下载Rclone工具。
    
    以下载rclone-v1.60.1-windows-amd64版本为例。下载地址，请参见[Rclone](https://rclone.org/downloads/)。Rclone是一个命令行程序，下载后，只需解压到本地任意目录即可，此处以解压到D:\\Rclone目录为例。
    
3.  配置Rclone。
    
    1.  将D:\\Rclone添加到环境变量。
        
    2.  打开命令行窗口，输入rclone --version，然后按下Enter。
        
        返回rclone v1.60.1，表明Rclone已成功安装。
        
    3.  输入rclone config命令，然后按下Enter。
        
    4.  输入n，按下Enter，然后新建new remote。
        
        以new remote命名为oss-remote为例。
        
    5.  输入remote名称，例如oss-remote，然后按下Enter。
        
    6.  选择包含Amazon S3 Compliant Storage的选项，即输入5，然后按下Enter。
        
    7.  选择包含Alibaba Cloud Object Storage System (OSS)的选项，即输入2，然后按下Enter。
        
    8.  执行到env\_auth>，按下Enter。
        
    9.  执行到access\_key\_id>，输入OSS的访问密钥AccessKey ID，然后按下Enter。
        
    10.  执行到secret\_access\_key> ，输入OSS的访问密钥AccessKey Secret，然后按下Enter。
         
    11.  执行到endpoint>，输入访问OSS的endpoint，然后按下Enter。
         
         以访问华东1（杭州）外网为例，endpoint填写为oss-cn-hangzhou.aliyuncs.com。如果是ECS上的Windows环境，您可以使用oss-cn-hangzhou-internal.aliyuncs.com的内网endpoint。
         
    12.  执行到acl>，选择Object读写权限。
         
         该选项仅对新上传的Object有效。您可以根据实际需求选择合适的读写权限。此处以选择default（私有权限）为例，即输入1，然后按下Enter。
         
    13.  执行到storage\_class>，选择Object的存储类型。
         
         此处以选择default（继承Bucket存储类型）为例，即输入1，然后按下Enter。
         
    14.  执行到Edit advanced config? (y/n) ，输入n，然后按下Enter。
         
    15.  输入q，完成所有配置。
         
4.  挂载存储空间。
    
    以将examplebucket挂载到E:盘，并以D:\\disk-cache路径作为缓存目录为例。
    
    ```
    rclone mount oss-remote:/examplebucket E: --cache-dir D:\disk-cache --vfs-cache-mode writes
    ```
    
    返回The service rclone has been started信息，表示挂载成功。此时，您还可以查看到examplebucket(E:)的磁盘。