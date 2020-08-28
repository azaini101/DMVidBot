const { Autohook } = require('twitter-autohook');
require('dotenv').config();
const util = require('util');
const request = require('request');
const fs = require('fs');
const { send } = require('process');
const post = util.promisify(request.post);
const { http, https } = require('follow-redirects');
const client = require('twilio')(process.env.TWILIO_ACCOUNTSID, process.env.TWILIO_AUTH_TOKEN); 

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
            text: `The video has been sent to your WhatsApp!`,
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
  const phone = senderMessage.substring(0, senderMessage.indexOf(" "))
  const t_link = senderMessage.substring(senderMessage.indexOf("http"))
  console.log(t_link)
  console.log(phone)
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
          client.messages 
            .create({ 
                from: 'whatsapp:+14155238886',       
                to: `whatsapp:${phone}`,
                mediaUrl: link
              }) 
            .then(message => console.log(message.sid)) 
            .done();
        });
        res.on("error", function (error) {
          console.error(error);
        });
      });
      await req.end();
      //await sendMessage(message, oAuthConfig)
    });
  }).on('error', err => {
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