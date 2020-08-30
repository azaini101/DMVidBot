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
  if (!event.direct_message_events) {
    return;
  }

  const message = event.direct_message_events.shift();
  await markAsRead(message.message_create.id, message.message_create.sender_id, oAuthConfig);

  if (typeof message === "undefined" || typeof message.message_create === "undefined") {
    return;
  }

  if (message.message_create.sender_id === message.message_create.target.recipient_id) 
  {
    return;
  }

  const senderScreenName = event.users[message.message_create.sender_id].screen_name;
  const senderMessage = message.message_create.message_data.text;
  console.log(`${senderScreenName} says ${senderMessage}`);

  // If user is setting their phone number
  if (senderMessage[0] === "!") {
    handleToNumber[senderScreenName] = senderMessage.substring(1);
    await sendMessage(
      message,
      oAuthConfig,
      `Saved ${handleToNumber[senderScreenName]} for ${senderScreenName}!`
    );
  }
  else if (senderMessage.toLowerCase() === "help") {
    await sendMessage(message, oAuthConfig, `There are 3 main steps to get started with DMVidBot! \n
    1) Add the following number as a contact on WhatsApp: +14155238886\n
    2) On WhatsApp, send that contact the following message: join continent-complete\n
    3) Add your number to our contact list by DM'ing us ! directly followed by your number\n
    ****Steps 1-3 only need to be done once!***\n
    4) Send us whatever tweet with a video you'd like to save, and we'll send that over to your Whatsapp!\n
    One final note: make sure you send the actual tweet with the video, not a quote of the tweet`);
  }
  else if (handleToNumber[senderScreenName] === undefined) {
    await sendMessage(message, oAuthConfig, `Type "help" to learn more.`);
  }
  else if (senderMessage.substring(0, 4) === "http") {
    if(senderMessage.indexOf(" ") !== -1){
      await sendMessage(message, oAuthConfig, `Make sure you send just the link on its own.`);
    }
    let t_link = senderMessage;
    https.get(t_link, (response) => {
        var chunks = [];
        response.on("data", (chunk) => {
          chunks.push(chunk);
        });
        response.on("end", async function (chunk) {
          var body = Buffer.concat(chunks);
          var new_link = body.toString();
          new_link = new_link.substring(
            new_link.indexOf("https://twitter.com")
          );
          new_link = new_link.substring(0, new_link.indexOf('"'));
          console.log(new_link);

          var options = {
            method: "POST",
            hostname: "www.savetweetvid.com",
            path: `/downloader?url=${new_link}`,
          };

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

              $("table").each((i, e) => {
                //console.log(i, e);
                let tbody = $(e).find("tbody");
                let tr = $(tbody).find("tr");
                $(tr).each((j, tr_tag) => {
                  // console.log(j, tr_tag);
                  let td = $(tr_tag).find("td");
                  quality = td[0].children[0].data; // 720p HD
                  size = td[2].children[0].data; // 11 MB
                  link = $(td[3]).find("a")[0].attribs.href; // actual URL

                  size_num = parseFloat(size);
                  console.log(size_num, size);
                  if (size.indexOf("KB") !== -1 || size_num < size_threshold) {
                    return false;
                  }
                });
              });

              console.log(
                quality,
                size,
                link,
                `VIDEO CAN BE SENT ${size.indexOf("KB") !== -1 || size_num < size_threshold}`
              );
              if (link === undefined) {
                await sendMessage(message, oAuthConfig, "This link was invalid.");
              } else if (!(size.indexOf("KB") !== -1 || size_num < size_threshold)) {
                await sendMessage(
                  message,
                  oAuthConfig,
                  "This video is too large to send."
                );
              } else {
                client.messages
                  .create({
                    from: "whatsapp:+14155238886",
                    to: `whatsapp:${handleToNumber[senderScreenName]}`,
                    mediaUrl: link,
                  })
                  .then(async (res) => {
                    await sendMessage(
                      message,
                      oAuthConfig,
                      `Your video has been sent to WhatsApp at ${handleToNumber[senderScreenName]}!`
                    );
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
      })
      .on("error", (err) => {
        console.log(err);
      });
  }  
  else {
    await sendMessage(message, oAuthConfig, "We don't know your number. Please send ! followed by your number.");
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