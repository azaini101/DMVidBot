const { Autohook } = require('twitter-autohook');
const nodemailer = require('nodemailer');
require('dotenv').config();
const util = require('util');
const request = require('request');
const fs = require('fs');
const { send } = require('process');
const post = util.promisify(request.post);
const { http, https } = require('follow-redirects');

const oAuthConfig = {
  token: process.env.TWITTER_ACCESS_TOKEN,
  token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
};

async function markAsRead(messageId, senderId, auth) {
  const requestConfig = {
    url: 'https://api.twitter.com/1.1/direct_messages/mark_read.json',
    form: {
      last_read_event_id: messageId,
      recipient_id: senderId,
    },
    oauth: auth,
  };

  await post(requestConfig);
}

async function sendMessage(message, auth) {
  const requestConfig = {
    url: 'https://api.twitter.com/1.1/direct_messages/events/new.json',
    oauth: auth,
    json: {
      event: {
        type: 'message_create',
        message_create: {
          target: {
            recipient_id: message.message_create.sender_id,
          },
          message_data: {
            text: `An email has been sent!`,
          },
        },
      },
    },
  };
  await post(requestConfig);
}

async function sayHi(event) {
  if (!event.direct_message_events) {
    return;
  }

  const message = event.direct_message_events.shift();
  if (typeof message === 'undefined' || typeof message.message_create === 'undefined') {
    return;
  }

  if (message.message_create.sender_id === message.message_create.target.recipient_id) {
    return;
  }


  const senderScreenName = event.users[message.message_create.sender_id].screen_name;
  const senderMessage = message.message_create.message_data.text;
  const email = senderMessage.substring(0, senderMessage.indexOf(" "))
  const t_link = senderMessage.substring(senderMessage.indexOf("http"))
  console.log(t_link)
  console.log(email)
  console.log(`${senderScreenName} says ${senderMessage}`);
  await markAsRead(message.message_create.id, message.message_create.sender_id, oAuthConfig);
  https.get(t_link, response => {
    var chunks = [];
    response.on('data', chunk => {
      chunks.push(chunk);
    });
    response.on("end", async function (chunk) {
      var body = Buffer.concat(chunks);
      var new_link = body.toString();
      new_link = new_link.substring(new_link.indexOf('https://twitter.com'))
      console.log(new_link)
      new_link = new_link.substring(0, new_link.indexOf('"'))
      console.log(new_link)


      var options = {
        'method': 'POST',
        'hostname': 'www.savetweetvid.com',
        'path': `/downloader?url=${new_link}`,
      };
    
      var req = https.request(options, async function (res) {
        var chunks = [];
        res.on("data", function (chunk) {
          chunks.push(chunk);
        });
    
        res.on("end", function (chunk) {
          var body = Buffer.concat(chunks);
          var link = body.toString();
          link = link.substring(link.indexOf("https://video.twimg.com"));
          link = link.substring(0, link.indexOf(`"`));
          console.log(link);
          const file = fs.createWriteStream(`${senderScreenName}.mp4`);
          const request = https.get(link, function(response) {
            response.pipe(file);
          });
          let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: process.env.GMAIL_EMAIL,
              pass: process.env.GMAIL_PASS
            }
          });
          
          let mailOptions = {
            from: 'azainidev@gmail.com',
            to: email,
            subject: 'test',
            text: 'test',
            attachments: [
              {filename: `${senderScreenName}.mp4`, path: `./${senderScreenName}.mp4`}
            ]
          }
    
          transporter.sendMail(mailOptions, async function(err, info){
            if(err){
              console.log('Error: ', err)
            }
            else{
              console.log('Email sent.')
              //await sendMessage(message, oAuthConfig);
            }
          })
        });
        res.on("error", function (error) {
          console.error(error);
        });
      });
      // fs.unlinkSync(`./${senderScreenName}.mp4`);
      await req.end();
    });
  }).on('error', err => {
    //console.error(err);
  });
}

(async start => {
  try {
    const webhook = new Autohook();
    webhook.on('event', async event => {
      if (event.direct_message_events) {
        await sayHi(event);
      }
    });
    // Removes existing webhooks
    await webhook.removeWebhooks();

    // Starts a server and adds a new webhook
    await webhook.start();

    // Subscribes to your own user's activity
    await webhook.subscribe({ oauth_token: process.env.TWITTER_ACCESS_TOKEN, oauth_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET });
  } catch (e) {
    // Display the error and quit
    console.error(e);
    process.exit(1);
  }
})(); 