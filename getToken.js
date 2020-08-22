const axios = require('axios').default;
const fs = require('fs');
require('dotenv').config()

module.exports = async () => {
  if (fs.existsSync('.accesstoken')) {
    let cache = JSON.parse(fs.readFileSync('.accesstoken'))
    if (Date.now() < cache.validBefore) {
      return cache.token
    }
  }
  let res = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
    params: {
      grant_type: 'client_credential',
      appid: process.env.APPID,
      secret: process.env.SECRET
    }
  })
  fs.writeFileSync('.accesstoken', JSON.stringify({ token: res.data.access_token, validBefore: Date.now() + 7200000 }))
  return res.data.access_token
}