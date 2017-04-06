/**
 * This service serves as the backend for our Cool catagory of curated lists.
 */

var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var http = require('http');

app.use(bodyParser.urlencoded({
  extended: false
}));


const util = require('util')
const assert = require('assert');

// We want to extract the port to publish our app on
var port = process.env.PORT || 8080;


//This endpoint forwards all requests to the inventory endpoint
//that has been added to the API service
app.get("/sevices", function(request, response){
  var options = {
      host : "cs4471-yelp-node.mybluemix.net",
      path : "/cool",
      method : "GET"
  };

  var callback = function(resp){
    var body = '';

    resp.on('data', function(data){
      body += data;
      console.log("body " + body);
    });

    resp.on('end', function(){

      response.send(body);
    })
  }
  var req = http.request(options, callback);

  req.end();
});


var id = 'COOL';
var desc = 'Our curated list of cool reviews.';
var link = 'cool';

//Sends the heartbeat to the heartbeat monitor
function sendHeartbeat () {
  var options = {
      host : 'team200-service-lister.mybluemix.net',
      path : '/heartbeat?service='+ id +'&desc=' + escape(desc) + '&url=' + link,
      method : "GET"
  };

  var callback = function(resp){

    resp.on('data', function(data){
    });

    resp.on('end', function(){
      console.log('Heartbeat Sent');
    });
  }
  var req = http.request(options, callback);
  req.end();
}


setInterval(function(){
  sendHeartbeat();
}, 15000);





//------------------------------------

// Now we go and listen for a connection.
app.listen(port);

require("cf-deployment-tracker-client").track();
