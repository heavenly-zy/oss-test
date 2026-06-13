import 'dotenv/config'
import OSS from 'ali-oss'

const {
  OSS_REGION,
  OSS_BUCKET,
  OSS_ACCESS_KEY_ID,
  OSS_ACCESS_KEY_SECRET,
} = process.env

const client = new OSS({
  region: OSS_REGION,
  bucket: OSS_BUCKET,
  accessKeyId: OSS_ACCESS_KEY_ID,
  accessKeySecret: OSS_ACCESS_KEY_SECRET,
})

async function main() {
  const expirationDate = new Date()
  expirationDate.setDate(expirationDate.getDate() + 1)

  const postSignature = client.calculatePostSignature({
    expiration: expirationDate.toISOString(),
    conditions: [['content-length-range', 0, 1048576000]],
  })

  const location = await client.getBucketLocation()
  const host = `http://${OSS_BUCKET}.${location.location}.aliyuncs.com`

  console.log('Post signature:')
  console.log(postSignature)
  console.log('Upload host:')
  console.log(host)
}

main().catch((error) => {
  console.error('Generate signature failed:')
  console.error(error)
  process.exitCode = 1
})
