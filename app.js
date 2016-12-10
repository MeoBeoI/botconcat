require('dotenv').config();

const express = require('express');
const app     = express();
const bodyParser = require('body-parser');
const builder = require('botbuilder');
const path    = require('path');
const request = require('request');
const intents = new builder.IntentDialog();
const firebase = require('firebase');
firebase.initializeApp({
  apiKey:            process.env.FIREBASE_API_KEY,
  authDomain:        process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL:       process.env.FIREBASE_DB_URL,
  storageBucket:     process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
});
const database = firebase.database();

app.use(bodyParser.json());

//=========================================================
// Bot Setup
//=========================================================

const connector = new builder.ChatConnector({
  appId: process.env.MICROSOFT_APP_ID,
  appPassword: process.env.MICROSOFT_APP_PASSWORD,
});
const bot = new builder.UniversalBot(connector);
app.post('/api/messages', connector.listen());

app.get('/authorize', (req, res) => {
  console.log(req.params);
  res.sendFile(path.join(__dirname, '/html/authorize.html'));
});

app.post('/api/notify', (req, res) => {
  const articleUrl = req.body.articleUrl;
  database.ref('/subscriber').once('value')
    .then((snapshot) => {
      // var notification = req.body.notification;
      const notification = `New article: ${articleUrl}`;
      snapshot.forEach((user) => {
        // Send notification as a proactive message
        const msg = new builder.Message()
            .address(JSON.parse(user.val().address))
            .text(notification);
        bot.send(msg, (err) => {
          res.status(err ? 500 : 200);
          res.end();
        });
      });
    })
    .catch(console.error);
});

// Anytime the major version is incremented any existing conversations will be restarted.
bot.use(builder.Middleware.dialogVersion({ version: 1.0, resetCommand: /^reset/i }));

//=========================================================
// Bots Global Actions
//=========================================================

// bot.endConversationAction('goodbye', 'Goodbye :)', { matches: /^goodbye/i });
// bot.beginDialogAction('help', '/help', { matches: /^help/i });

//=========================================================
// Bots Dialogs
//=========================================================
bot.dialog('/', intents);

bot.dialog('/login', [
  (session) => {
    const options = { method: 'POST',
      url: 'https://graph.facebook.com/v2.6/me/messages',
      qs: { access_token: process.env.FACEBOOK_APP_ACCESS_TOKEN },
      headers:
      {
        'cache-control': 'no-cache',
        'content-type': 'application/json',
      },
      formData: {
        recipient:{
          id: session.message.user.id,
        },
        message: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'generic',
              elements: [{
                title: 'Welcome to M-Bank',
                image_url: 'http://www.fordesigner.com/imguploads/Image/cjbc/zcool/png20080526/1211776983.png',
                buttons: [{
                  type: 'account_link',
                  url: 'https://9f7e461e.ngrok.io/authorize',
                }],
              }],
            },
          },
        },
      },
    };

    request(options, (error, response, body) => {
      if (error) throw new Error(error);

      console.log(body);
    });
  },
]);

bot.beginDialogAction('subscribe', '/subscribe');

const createSubscription = (userId, address) => database.ref(`subscriber/${userId}`).set({ userId, address });

const removeSubscription = userId => database.ref(`subscriber/${userId}`).remove();


bot.dialog('/subscribe', (session) => {
  const address = JSON.stringify(session.message.address);
  session.sendTyping();
  createSubscription(session.message.user.id, address)
    .then(session.endDialog('subscription created'))
    .catch((err) => {
      console.error('err ', err);
      session.endDialog('Unable to create subscription.');
    });
});

bot.dialog('/unsubscribe', (session) => {
  session.sendTyping();
  removeSubscription(session.message.user.id)
    .then(session.endDialog('Remove subscription'))
    .catch((err) => {
      console.error('err ', err);
      session.endDialog('Unable to remove subscription.');
    });
});

intents.matches(/subscribe/ig, [
  (session) => {
    session.beginDialog('/subscribe');
  },
  (session, results) => {
    session.send('I will send you a messeage when I post a new artcle !');
  },
]);

intents.matches(/unsubscribe/ig, [
  (session) => {
    session.beginDialog('/unsubscribe');
  },
  (session, results) => {
    session.send(' Make a mistake ? type "subscribe"');
  },
]);

app.listen(process.env.PORT || 3978, () => {
  console.log(`App listening on ${process.env.PORT || 3978}`);
});
