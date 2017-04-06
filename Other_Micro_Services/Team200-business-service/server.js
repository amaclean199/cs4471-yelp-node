/**
 * A business search service. Provides limited access to the full database.
 * Focused on business centric data.
 */


var express = require('express');
var app = express();
var bodyParser = require('body-parser');
console.log('before http');
var http = require('http');

app.use(bodyParser.urlencoded({
  extended: false
}));


const util = require('util')

const assert = require('assert');

// We want to extract the port to publish our app on
var port = process.env.PORT || 8082;


//An endpoint the plugs into the front end.
//Uses /services to display all businesses and
// /services?business=<business_id> to access the specified list of reviews for
// the business with that business_id
app.get("/services", function(request, response){
  var business = request.query.business;
  var url_path = "/api/v1/business"
  if(business){
      url_path = url_path + "?business=" + business;
  }

  //Forward the call to the full API
  var options = {
      host : "cs4471-yelp-node.mybluemix.net",
      path : url_path,
      method : "GET"
  };

  var callback = function(resp){
    var body = '';

    resp.on('data', function(data){
      body += data;

    });

    resp.on('end', function(){

      response.send(body);
    })
  }
  var req = http.request(options, callback);
  //cosole.log(request);
  req.end();
});

var id = 'BUSINESS';
var desc = 'Search for reviews written about your favorite business.';
var link = 'business';

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
