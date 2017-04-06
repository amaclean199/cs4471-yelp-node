/**
 * An author search service. Provides limited access to the full database.
 * Focused on author centric data.
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
var port = process.env.PORT || 8080;


//An endpoint the plugs into the front end.
//Uses /services to display all authors and
// /services?author=<author_id> to access the specified list of reviews for
// the author with that author_id
app.get("/services", function(request, response){
  var author = request.query.author;
  var url_path = "/api/v1/authors"
  if(author){
      url_path = url_path + "?author=" + author;
  }

  //Forward request to full API
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

  req.end();
});

var id = 'AUTHOR';
var desc = 'Search for reviews writter by your favorite authors.';
var link = 'author';

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
