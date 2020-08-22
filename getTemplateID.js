const axios = require('axios').default;
const fs = require('fs');

module.exports = async (token) => {
  if (fs.existsSync('.templateid')) {
    let cache = JSON.parse(fs.readFileSync('.templateid'))
    console.log(`using cached template ID ${cache}`)
    return cache
  }
  let templateList = await axios.get('https://api.weixin.qq.com/cgi-bin/template/get_all_private_template', {
    params: {
      access_token: token
    }
  }).catch(err => {
    console.log(`Error: ${err.message}`)
    if (err.response) {
      console.log(err.response.status)
      console.log(err.response.data)
    } else if (err.request) {
      console.log(err.request)
    }
  })
  if(templateList.data.errcode == 45009) {
    console.error('reach max api daily quota limit')
    return ''
  }
  fs.writeFileSync('.templateid', JSON.stringify(templateList.data.template_list[0].template_id))
  return templateList.data.template_list[0].template_id
}