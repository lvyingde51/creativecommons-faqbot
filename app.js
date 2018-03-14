/*-----------------------------------------------------------------------------
A FAQ bot for the Microsoft Bot Framework. 
-----------------------------------------------------------------------------*/

const restify = require('restify');
const builder = require('botbuilder');
const cognitiveservices = require("botbuilder-cognitiveservices");


// Setup KB
const faqRecognizer = new cognitiveservices.QnAMakerRecognizer({
	knowledgeBaseId: process.env.QnAKnowledgebaseId, 
	subscriptionKey: process.env.QnASubscriptionKey,
top: 3});

// Setup Restify Server
const server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
  
// Create chat connector for communicating with the Bot Framework Service
const connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    stateEndpoint: process.env.BotStateEndpoint,
    openIdMetadata: process.env.BotOpenIdMetadata 
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

/*----------------------------------------------------------------------------------------
* Bot Storage: This is a great spot to register the private state storage for your bot. 
* We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
* For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
* ---------------------------------------------------------------------------------------- */

// Create your bot with a function to receive messages from the user
const bot = new builder.UniversalBot(connector)

// Send welcome when conversation with bot is started, by initiating the root dialog
bot.on('conversationUpdate', function (message) {
    if (message.membersAdded) {
        message.membersAdded.forEach(function (identity) {
            if (identity.id === message.address.bot.id) {
                // bot.beginDialog(message.address, '/');
                var msg = new builder.Message().address(message.address);
                msg.text('Hello, how may I help you? You can ask me things about Creative Commons.');
                msg.textLocale('en-US');
                bot.send(msg);
            }
        });
    }
});


const qnaMakerTools = new cognitiveservices.QnAMakerTools();
bot.library(qnaMakerTools.createLibrary());

const basicQnAMakerDialog = new cognitiveservices.QnAMakerDialog({
	recognizers: [faqRecognizer],
	defaultMessage: 'I am having trouble understanding your question.. Can you try asking me another way?',
	qnaThreshold: 0.3,
//	feedbackLib: qnaMakerTools
});

// Override to also include the knowledgebase question with the answer on confident matches
basicQnAMakerDialog.respondFromQnAMakerResult = function(session, qnaMakerResult){
	var result = qnaMakerResult;
    var response = result.answers[0].answer;
    var faqAnswer = JSON.parse(response);
    console.log(faqAnswer);
    session.send(faqAnswer.answer);
    
    if (faqAnswer.followUps !== 'undefined' && faqAnswer.followUps.length > 0) {
        console.log("There are followUps!");
        builder.Prompts
            .choice(session, 'You can also ask me the following things..', 
            faqAnswer.followUps, { listStyle: builder.ListStyle.button });
    }
}


// // Override to log user query and matched Q&A before ending the dialog
// basicQnAMakerDialog.defaultWaitNextMessage = function(session, qnaMakerResult){
// 	if(session.privateConversationData.qnaFeedbackUserQuestion != null && qnaMakerResult.answers != null && qnaMakerResult.answers.length > 0 
// 		&& qnaMakerResult.answers[0].questions != null && qnaMakerResult.answers[0].questions.length > 0 && qnaMakerResult.answers[0].answer != null){
// 			console.log('User Query: ' + session.privateConversationData.qnaFeedbackUserQuestion);
// 			console.log('KB Question: ' + qnaMakerResult.answers[0].questions[0]);
// 			console.log('KB Answer: ' + qnaMakerResult.answers[0].answer);
// 		}
// 	session.endDialog();
// }

bot.dialog('/', basicQnAMakerDialog);

