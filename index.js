const fs = require('fs');
const app = require('express')()
const crypto = require('crypto')
const axios = require('axios').default;
const CronJob = require('cron').CronJob;
const {parseString} = require('xml2js');
require('dotenv').config()
const DEBUG = (process.argv[2] == 'debug')

let tasks = new Map()

if(DEBUG) console.log('Start in debug mode')
if(!DEBUG && fs.existsSync('.users')) {
  let users = JSON.parse(fs.readFileSync('.users'))
  users.forEach(user => {
    tasks.set(user, new CronJob('0 30 9 * * *', () => {notify(user)}, null, true, 'Asia/Shanghai'))
  })
  console.log(`load ${users.length} users from cache`)
}

app.get('/', function (req, res) {
  let signature = req.query.signature,
    timestamp = req.query.timestamp,
    nonce = req.query.nonce,
    echostr = req.query.echostr;

  let array = [process.env.TOKEN, timestamp, nonce];
  array.sort();

  let tempStr = array.join('');
  let hashCode = crypto.createHash('sha1');
  let resultCode = hashCode.update(tempStr, 'utf8').digest('hex');

  if (resultCode === signature) {
    res.send(echostr);
  } else {
    res.send('mismatch');
  }
});

app.post('/', (req, res) => {
  let buffer = ''
  req.on('data', (chunk) => {
    buffer += chunk
  })
  req.on('end', () => {
    parseString(buffer, { explicitArray: false }, function (err, result) {
      if (!err) {
        result = result.xml;
        let toUser = result.ToUserName;
        let fromUser = result.FromUserName;
        let reportMsg = "";

        if(result.MsgType.toLowerCase() == 'event') {
          if(result.Event.toLowerCase() == 'subscribe') {
            reportMsg = txtMsg(fromUser, toUser, '✧欢迎使用疫情打卡提醒服务✧\n\n●回复“启用提醒”，每天上午9:30收到打卡提醒\n●回复“关闭提醒”，不再收到提醒\n\n测试号关注人数有上限，如果只是想体验一下，记得及时取关哦~\n\n查看源码、bug提交：https://github.com/OrdosX/covid-report-notify \n\n✧由北理睿信书院黄泽源制作✧\n\n你将会收到一条示例提醒…')
            setTimeout(() => {
              notify(fromUser)
            }, 5000);
          } else if(result.Event.toLowerCase() == 'unsubscribe') {
            if(tasks.has(fromUser)) {
              tasks.get(fromUser).stop()
              tasks.delete(fromUser)
              if(!DEBUG) {
                let users = [];
                for(let user of tasks.keys()) users.push(user);
                fs.writeFileSync('.users', JSON.stringify(users));
              }
            }
          }
        } else if (result.MsgType.toLowerCase() === "text") {
          switch (result.Content) {
            case '启用提醒':
              if(DEBUG) {
                setTimeout(() => {
                  notify(fromUser)
                }, 5000);
              } else {
                tasks.set(fromUser, new CronJob('0 30 9 * * *', () => {notify(fromUser)}, null, true, 'Asia/Shanghai'))
                let users = [];
                for(let user of tasks.keys()) users.push(user);
                fs.writeFileSync('.users', JSON.stringify(users));
              }
              reportMsg = txtMsg(fromUser, toUser, '成功启用');
              break;
            case '关闭提醒':
              tasks.get(fromUser).stop()
              tasks.delete(fromUser)
              reportMsg = txtMsg(fromUser, toUser, '成功关闭');
              if(!DEBUG) {
                let users = [];
                for(let user of tasks.keys()) users.push(user);
                fs.writeFileSync('.users', JSON.stringify(users));
              }
              break;
            default:
              reportMsg = txtMsg(fromUser, toUser, '✧欢迎使用疫情打卡提醒服务✧\n\n●回复“启用提醒”，每天上午9:30收到打卡提醒\n●回复“关闭提醒”，不再收到提醒\n\n测试号关注人数有上限，如果只是想体验一下，记得及时取关哦~\n\n✧由北理睿信书院黄泽源制作✧');
              break;
          }
        }
        res.send(reportMsg);
      } else {
        console.error(err);
      }
    });
  })
})

let txtMsg = function (toUser, fromUser, content) {
  let xmlContent = "<xml><ToUserName><![CDATA[" + toUser + "]]></ToUserName>";
  xmlContent += "<FromUserName><![CDATA[" + fromUser + "]]></FromUserName>";
  xmlContent += "<CreateTime>" + new Date().getTime() + "</CreateTime>";
  xmlContent += "<MsgType><![CDATA[text]]></MsgType>";
  xmlContent += "<Content><![CDATA[" + content + "]]></Content></xml>";
  return xmlContent;
}

let notify = async (touser) => {
  let token = await require('./getToken')()
  let response = await axios.post('https://api.weixin.qq.com/cgi-bin/message/template/send', {
    touser,
    template_id: await require('./getTemplateID')(token),
    url: "http://xfbl.info.bit.edu.cn/my/showPersonalReport",
    data:{}
  }, {
    params: {
      access_token: token
    }
  }).catch(err => {
    console.log(`Error: ${err.message}`)
    if(err.response) {
      console.log(err.response.status)
      console.log(err.response.data)
    } else if(err.request) {
      console.log(err.request)
    }
  })
  if(response.data.errcode != 0) {
    console.error(response.data.errmsg)
  }
}

app.listen(Number.parseInt(process.env.PORT));