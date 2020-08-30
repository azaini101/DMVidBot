const {
  Autohook
} = require("twitter-autohook");
require("dotenv").config();
const util = require("util");
const request = require("request");
const fs = require("fs");
const {
  send
} = require("process");
const post = util.promisify(request.post);
const {
  http,
  https
} = require("follow-redirects");
let cheerio = require("cheerio");
const client = require("twilio")(
  process.env.TWILIO_ACCOUNTSID,
  process.env.TWILIO_AUTH_TOKEN
);

const oAuthConfig = {
  token: process.env.TWITTER_ACCESS_TOKEN,
  token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
};

async function markAsRead(messageId, senderId, auth) {
  const requestConfig = {
    url: "https://api.twitter.com/1.1/direct_messages/mark_read.json",
    form: {
      last_read_event_id: messageId,
      recipient_id: senderId,
    },
    oauth: auth,
  };

  await post(requestConfig);
}

async function sendMessage(message, auth, reply) {
  const requestConfig = {
    url: "https://api.twitter.com/1.1/direct_messages/events/new.json",
    oauth: auth,
    json: {
      event: {
        type: "message_create",
        message_create: {
          target: {
            recipient_id: message.message_create.sender_id,
          },
          message_data: {
            text: reply,
          },
        },
      },
    },
  };
  await post(requestConfig);
}

let handleToNumber = {};
async function responseToDM(event) {
  //if event is not a direct message
  if (!event.direct_message_events) {
    return;
  }

  const message = event.direct_message_events.shift();
  await markAsRead(message.message_create.id, message.message_create.sender_id, oAuthConfig); //marks the message as read

  //if message is empty
  if (typeof message === "undefined" || typeof message.message_create === "undefined") {
    return;
  }

  //if sender is the same as the receiver
  if (message.message_create.sender_id === message.message_create.target.recipient_id) 
  {
    return;
  }

  const senderScreenName = event.users[message.message_create.sender_id].screen_name;
  const senderMessage = message.message_create.message_data.text;
  console.log(`${senderScreenName} says ${senderMessage}`);

  
  if (senderMessage[0] === "!") { // If user is setting their phone number
    handleToNumber[senderScreenName] = senderMessage.substring(1);
    await sendMessage(message, oAuthConfig, `Saved ${handleToNumber[senderScreenName]} for ${senderScreenName}!`);
  }
  else if (senderMessage.toLowerCase() === "help") { //if user has typed the help command
    await sendMessage(message, oAuthConfig, `There are 3 main steps to get started with DMVidBot!
    \n1) Add the following number as a contact on WhatsApp: +14155238886
    \n2) On WhatsApp, send that contact the following message: join continent-complete
    \n3) Add your number to our contact list by DM'ing us ! directly followed by your number
    \n****Steps 1-3 only need to be done once!***
    \n4) Send us whatever tweet with a video you'd like to save, and we'll send that over to your Whatsapp!
    \nOne final note: make sure you send the actual tweet with the video, not a quote of the tweet`);
  }
  else if (handleToNumber[senderScreenName] === undefined) { //if user's number has not been added
    await sendMessage(message, oAuthConfig, `Not sure what this means. Type "help" to learn more.`);
  }
  else if (senderMessage.substring(0, 4) === "http") { //if user has sent a link
    if(senderMessage.indexOf(" ") !== -1){ //if user has sent more than just the link itself
      await sendMessage(message, oAuthConfig, `Make sure you send just the tweet on its own.`);
      return
    }
    let t_link = senderMessage;
    /*This get function returns the full url of shortened twitter links*/
    var r = request.get(t_link, async function (err, res, body) { 
      t_link = r.uri.href;
      console.log(t_link);
    

      var options = {
        method: "POST",
        hostname: "www.savetweetvid.com",
        path: `/downloader?url=${t_link}`,
      };
    /*Calls savetweetvid.com's post request html return*/
      var req = https.request(options, async function (res) {
      var chunks = [];
      res.on("data", function (chunk) {
        chunks.push(chunk);
      });
      res.on("end", async function (chunk) {
        var body = Buffer.concat(chunks).toString();
        let $ = cheerio.load(body);

        var link;
        var quality;
        var size;
        var size_num;
        let size_threshold = 16;
        /*Scrapes the html returned and reads the values of the downloadable links, as well as their size in MB.*/
        $("table").each((i, e) => {
          let tbody = $(e).find("tbody");
          let tr = $(tbody).find("tr");
          /*iterates through each row in the "table" class*/
          $(tr).each((j, tr_tag) => {
            let td = $(tr_tag).find("td");
            quality = td[0].children[0].data; // file quality
            size = td[2].children[0].data; // file size
            link = $(td[3]).find("a")[0].attribs.href; // video URL
            size_num = parseFloat(size);
            //if the size is greater than the size threshold (maximum file size that can be sent via Twilio's Sandbox), continue
            if (size.indexOf("KB") !== -1 || size_num < size_threshold) {
              return false;
            }
          });
        });
        if (link === undefined) { //if link was not a twitter link with a video
          await sendMessage(message, oAuthConfig, "This link was invalid.");
        } 
        else if (!(size.indexOf("KB") !== -1 || size_num < size_threshold)) { //if all 3 file sizes were too large to send
          await sendMessage(message, oAuthConfig, "This video is too large to send.");
        } 
        else { //if video can be sent to Whatsapp
          console.log(quality,size,link,`VIDEO CAN BE SENT ${size.indexOf("KB") !== -1 || size_num < size_threshold}`);
          client.messages
            .create({
              from: "whatsapp:+14155238886",
              to: `whatsapp:${handleToNumber[senderScreenName]}`,
              mediaUrl: link,
            })
            .then(async (res) => {
              await sendMessage(message, oAuthConfig, `Your video has been sent to WhatsApp at ${handleToNumber[senderScreenName]}!`);
            })
            .catch(async (err) => {
              console.log(err);
            })
            .done();
        }
      });
      res.on("error", function (error) {
        console.error(error);
      });
    });
    await req.end();
    });
  }  
  else {
    await sendMessage(message, oAuthConfig, `Not sure what this means. Type "help" to learn more.`);
  }
}

(async (start) => {
  try {
    const webhook = new Autohook();
    webhook.on("event", async (event) => {
      if (event.direct_message_events) {
        await responseToDM(event);
      }
    });
    // Removes existing webhooks
    await webhook.removeWebhooks();

    // Starts a server and adds a new webhook
    await webhook.start();

    // Subscribes to your own user's activity
    await webhook.subscribe({
      oauth_token: process.env.TWITTER_ACCESS_TOKEN,
      oauth_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    });
  } catch (e) {
    // Display the error and quit
    console.error(e);
    process.exit(1);
  }
})();