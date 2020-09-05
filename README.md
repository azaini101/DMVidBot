# [@DMVidBot](https://twitter.com/DMvidBot) on Twitter :robot:

A twitter bot that sends the videos of tweets to you via WhatsApp!
This bot is currently running and being hosted via Heroku.

# Features
- DM the bot on twitter of any tweet with video
- Video will be sent to you via WhatsApp to be easily downloadable

# Installation & Setup

The project was done entirely in NodeJS and utilizes the following tools:
- Twitter API: creates the tokens needed to run the bot
  - To get started, head over to the [Twitter Developers](https://developer.twitter.com/en/apply-for-access) page and apply for access.
- twitter-autohook: Manages the twitter webhook with essentially no configuration, allowing for a simple implementation to stream DMs. 
  - Check it out [here](https://github.com/twitterdev/autohook)!
- Twilio API for WhatsApp: creates phone number to be used to message users for free.
  - Check it out [here](https://www.twilio.com/whatsapp)!
  
# How to Use
1. Add +1(415)523-8886 as a WhatsApp contact.
2. Text the bot "join continent-complete" to be added to its contact list.
3. DM [@DMVidBot](https://twitter.com/DMvidBot) "!" followed directly by your full number (Ex: !+15041234567)
4. DM it any tweet with a video, and your video will be sent to WhatsApp!

Check out my [pinned tweet](https://twitter.com/DMVidBot/status/1301623300242767873) for a video tutorial of the setup!

# Limitations
Currently, the Twilio WhatsApp API is in its Beta version, which is currently having sessions only valid for 24 hours after the most recently received message. This is pretty inefficient, so I am actively looking for an alternative that will save contacts permanently.

# Other
I made this bot simply because no other bot on twitter is as private as this one. Unlike the other options, @DMVidBot lets me get twitter videos without having to publicly reply to any tweets, allowing for me to request a bunch of them without spamming my followers' timeline. With this project, I familiarized myself with multiple APIs, as well as an introduction into web scraping.
