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
  try {
    const objectName = 'bocchi.png'
    const localFilePath = './bocchi.png'

    const result = await client.put(objectName, localFilePath)
    console.log('Upload succeeded:')
    console.log(result)
  } catch (error) {
    console.error('Upload failed:')
    console.error(error)
    process.exitCode = 1
  }
}

main()
