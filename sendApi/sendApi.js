const request = require('request');
const config = require('config');
const slAPI = require('../sl-api/index');


// App Secret can be retrieved from the App Dashboard
const APP_SECRET = (process.env.MESSENGER_APP_SECRET) ?
  process.env.MESSENGER_APP_SECRET :
  config.get('appSecret');

// Arbitrary value used to validate a webhook
const VALIDATION_TOKEN = (process.env.MESSENGER_VALIDATION_TOKEN) ?
  (process.env.MESSENGER_VALIDATION_TOKEN) :
  config.get('validationToken');

// Generate a page access token for your page from the App Dashboard
const PAGE_ACCESS_TOKEN = (process.env.MESSENGER_PAGE_ACCESS_TOKEN) ?
  (process.env.MESSENGER_PAGE_ACCESS_TOKEN) :
  config.get('pageAccessToken');

// URL where the app is running (include protocol). Used to point to scripts and
// assets located at this address.
const SERVER_URL = (process.env.SERVER_URL) ?
  (process.env.SERVER_URL) :
  config.get('serverURL');

if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN && SERVER_URL)) {
  console.error("Missing config values");
  process.exit(1);
}




function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  console.log("Received message for user %d and page %d at %d with message:",
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var messageId = message.mid;

  var messageText = message.text;
  var messageAttachments = message.attachments;


  // If message is a quick reply then let the message be handled by the quick reply handler
  if (message.quick_reply) {
    quickReplyHandler(senderID, message);
  } else {
    if (messageText) {

      // If we receive a text message, check to see if it matches a keyword otherwise figure out if its a search of a station
      // or a route
      // TODO Keywords:
      // Help
      // Map
      //

      switch (messageText) {
        case 'generic':
          sendGenericMessage(senderID);
          break;

        case 'map':
          sendMap(senderID);
          break;

        default:
          sendDefaultMessage(senderID, messageText);
      }
    } else if (messageAttachments) {
      sendTextMessage(senderID, "Message with attachment received");
    }

  }

}


function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback
  // button for Structured Messages.
  var payload = event.postback.payload;

  console.log("Received postback for user %d and page %d with payload '%s' " +
    "at %d", senderID, recipientID, payload, timeOfPostback);

  // When a postback is called, we'll send a message back to the sender to
  // let them know it was successful
  sendTextMessage(senderID, "Postback called");
}



function sendGenericMessage(recipientId, messageText) {

}

function sendMap(recipientId) {
  let messageData =  {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "image",
        payload: {
          url: config.get("Picture-Links.Map")
        }
      }
    }
  };

  callSendAPI(messageData);
}


function sendDefaultMessage(recipientId, messageText) {
  slAPI.findStationID(messageText, function(response) {
    placesSearchToQuickReplies(response, function(quickReplies) {
      let messageData = {
        recipient: {
          id: recipientId
        },
        message: {
          text: "Found the following matching answers",
          quick_replies: quickReplies
        }
      };
      callSendAPI(messageData);
    })
  });
}

function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText
    }
  };

  callSendAPI(messageData);
}

function quickReplyHandler(senderID, message) {
  // the payload has to be parsed since it can only be a string according to the facebook API and therefore the
  //  payload object is stringified before sent to messenger in the quick reply
  let payload = JSON.parse(message.quick_reply.payload)


  switch (payload.type) {
    // the user has choosen a station
    case 'station':
      sendFullStationInfo(senderID,payload.data)
      break;

    default:
      sendTextMessage(senderID, messageText);
  }

}



function placesSearchToQuickReplies(response, callback) {
  let quickReplies = [];
  response.slice(0,5).forEach(function(result){
    // the payload is stringified bc the payload can only be a text string in the current version of the messenger API
    quickReplies = [...quickReplies, {content_type: 'text', title: result.Name, payload: JSON.stringify({type: 'station', data: result.SiteId})}]
  });
  callback(quickReplies);

}



function sendFullStationInfo(recipientId, messageText) {

  slAPI.getInfoStation(messageText, function(result) {

    fullStationInfoToMessage(result, function(elements) {
      let messageData = {
        recipient: {
          id: recipientId
        },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "generic",
              elements: elements
            }
          }
        }
      };
      callSendAPI(messageData);

    });

  })

}
function replaceAll(str, find, replace) {
  return str.replace(new RegExp(find, 'g'), replace);
}
function formatTimeStringArray(string) {
  return replaceAll(replaceAll(string, ' min', 'm'), ',', ', ');
}

function fullStationInfoToMessage(response, callback) {
  let elements = [];
  Object.keys(response).forEach(function(type) {
    let title = type + ' - Destination';
    let subtitle = '';
    Object.keys(response[type]).forEach(function(lineNumber) {
      Object.keys(response[type][lineNumber]).forEach(function (destination) {
        subtitle = subtitle + destination + ': ' + formatTimeStringArray(response[type][lineNumber][destination].toString()) + '\n';
      });

    });
    elements = [...elements, {title: title, subtitle: subtitle,
      image_url: config.get('Picture-Links.'+type), buttons: [{
        type: "postback",
        title: "See More",
        payload: "Payload for second bubble",
      }]}];
  });
  console.log(elements);
  callback(elements);

}




function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      console.log("Successfully sent generic message with id %s to recipient %s",
        messageId, recipientId);
    } else {
      console.error("Unable to send message.");
      console.error(response);
      console.error(error);
    }
  });
}

module.exports.receivedMessage = receivedMessage;
module.exports.receivedPostback = receivedPostback;