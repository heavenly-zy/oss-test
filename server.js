import express from 'express';
import pkg from 'ali-oss';
const { STS } = pkg;
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3000;

// 读取环境变量配置
const ACCESS_KEY_ID = process.env.OSS_ACCESS_KEY_ID;
const ACCESS_KEY_SECRET = process.env.OSS_ACCESS_KEY_SECRET;
const ROLE_ARN = process.env.ROLE_ARN;

if (!ACCESS_KEY_ID || !ACCESS_KEY_SECRET || !ROLE_ARN) {
  console.error('请在 .env 文件中配置以下环境变量:');
  console.error('  OSS_ACCESS_KEY_ID - 阿里云 AccessKey ID');
  console.error('  OSS_ACCESS_KEY_SECRET - 阿里云 AccessKey Secret');
  console.error('  ROLE_ARN - RAM 角色的 ARN');
  process.exit(1);
}

/**
 * 获取 OSS 上传用的临时凭证
 */
async function getOSSToken() {
  const stsClient = new STS({
    accessKeyId: ACCESS_KEY_ID,
    accessKeySecret: ACCESS_KEY_SECRET,
  });

  const policy = {
    Version: '1',
    Statement: [
      {
        Effect: 'Allow',
        Action: [
          'oss:PutObject',
          'oss:PutObjectACL',
          'oss:InitiateMultipartUpload',
          'oss:UploadPart',
          'oss:CompleteMultipartUpload',
          'oss:AbortMultipartUpload',
          'oss:GetObject',
        ],
        Resource: 'acs:oss:*:*:*',
      },
    ],
  };

  const result = await stsClient.assumeRole(ROLE_ARN, policy, 3600, `oss-upload-${Date.now()}`);

  return {
    accessKeyId: result.credentials.AccessKeyId,
    accessKeySecret: result.credentials.AccessKeySecret,
    stsToken: result.credentials.SecurityToken,
    expiration: result.credentials.Expiration,
  };
}

// API: 获取 OSS 临时凭证
app.get('/api/oss-token', async (req, res) => {
  try {
    const token = await getOSSToken();
    res.json({
      success: true,
      data: token,
    });
  } catch (error) {
    console.error('获取 OSS Token 失败:', error);
    res.status(500).json({
      success: false,
      message: '获取凭证失败',
      error: error.message,
    });
  }
});

// 提供静态文件
app.use(express.static('.'));

app.listen(PORT, () => {
  console.log(`后端服务已启动: http://localhost:${PORT}`);
  console.log(`前端开发服务器: pnpm dev (端口 5173)`);
});