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

async function put() {
  try {
    const result = await client.put('bocchi.png', './bocchi.png')
    console.log(result)
  } catch (e) {
    console.log(e)
  }
}

put()
