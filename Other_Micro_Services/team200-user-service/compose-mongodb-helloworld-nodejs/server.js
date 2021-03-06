/**
 * This service adds and removes user subscriptions.
 *
 * As well this service can be queried with a user_id and a list of active
 * serives will be generated and marked with meta data indicating
 * if the user is subscribed to that service or not.
 */

var express = require('express');
var fs = require('fs');
var https = require('https');
var app = express();
var http = require('http');

var bodyParser = require('body-parser');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));


// Util is handy to have around, so thats why that's here.
const util = require('util')
// and so is assert
const assert = require('assert');

// We want to extract the port to publish our app on
var port = process.env.PORT || 8087;

// Then we'll pull in the database client library
var MongoClient = require("mongodb").MongoClient;

// Now lets get cfenv and ask it to parse the environment variable
var cfenv = require('cfenv');
var appenv = cfenv.getAppEnv();

// Within the application environment (appenv) there's a services object
var services = appenv.services;

// The services object is a map named by service so we extract the one for MongoDB
var mongodb_services = services["compose-for-mongodb"];

// This check ensures there is a services for MongoDB databases
assert(!util.isUndefined(mongodb_services), "Must be bound to compose-for-mongodb services");

// We now take the first bound MongoDB service and extract it's credentials object
var credentials = mongodb_services[0].credentials;

// Within the credentials, an entry ca_certificate_base64 contains the SSL pinning key
// We convert that from a string into a Buffer entry in an array which we use when
// connecting.
var ca = [new Buffer(credentials.ca_certificate_base64, 'base64')];

// This is a global variable we'll use for handing the MongoDB client around
var mongodb;

// This is the MongoDB connection. From the application environment, we got the
// credentials and the credentials contain a URI for the database. Here, we
// connect to that URI, and also pass a number of SSL settings to the
// call. Among those SSL settings is the SSL CA, into which we pass the array
// wrapped and now decoded ca_certificate_base64,
MongoClient.connect(credentials.uri, {
        mongos: {
            ssl: true,
            sslValidate: true,
            sslCA: ca,
            poolSize: 1,
            reconnectTries: 1
        }
    },
    function(err, db) {
        // Here we handle the async response. This is a simple example and
        // we're not going to inject the database connection into the
        // middleware, just save it in a global variable, as long as there
        // isn't an error.
        if (err) {
            console.log(err);
        } else {
            // Although we have a connection, it's to the "admin" database
            // of MongoDB deployment. In this example, we want the
            // "examples" database so what we do here is create that
            // connection using the current connection.
            mongodb = db.db("examples");
        }
    }
);

// With the database going to be open as some point in the future, we can
// now set up our web server. First up we set it to server static pages
app.use(express.static(__dirname + '/public'));

//This is used to add a user-service pair to the database.
//team200-user-service.mybluemix.net/add?user=<userid>&service=<service_id>
app.get("/add", function(request, response) {

  var user = request.query.user;
  var service = request.query.service;

  var s = '{"user_id":"' + user + '", "service":"' + service +'"}';

  var j = JSON.parse(s);

  mongodb.collection("users").insertOne(j ,function(err, words) {
    if (err) {
      response.status(500).send(err);
    }
    else {
      response.send(words);
    }
  });
});

//This is used to delete a user-service pair from the database.
//team200-user-service.mybluemix.net/remove?user=<userid>&service=<service_id>
app.get("/remove", function(request, response) {

  var user = request.query.user;
  var service = request.query.service;

  var s = '{"user_id":"' + user + '", "service":"' + service +'"}';
console.log(s);

  var j = JSON.parse(s);

  mongodb.collection("users").deleteMany(j ,function(err, words) {
    if (err) {
      response.status(500).send(err);
    }
    else {
      response.send(words);
    }
  });
});

//Used to return a list of active services that the user is subbed to, and list
//of active services they are not.
app.get("/services", function(request, response) {

  var user = request.query.user;
  var s = '{"user_id":"' + user + '"}';
console.log(s);

  var j = JSON.parse(s);

  mongodb.collection("users").find(j).toArray(function(err, words) {
    if (err) {
      response.status(500).send(err);
    }
    else {
      var output = splitServices(words, response);
      // console.log("output = " + output);
      // response.send(words);
    }
  });
});

//Splits available services into subbed and unsubbed based on users
//subscriptions
function splitServices(words,response){
  var result;

  //Get the list of active services
  var options = {
      host : "team200-service-lister.mybluemix.net",
      path : "/services",
      method : "GET"
  };

  var callback = function(resp){
    var body = '';

    resp.on('data', function(data){
      body += data;
    });

    resp.on('end', function(){
      //Make list of subbed services;
      var sub_list = [];
      for(var i = 0; i < words.length; i++){
        sub_list.push(words[i].service);
      }

      body = JSON.parse(body);


      for(var i = 0; i < body.length; i++){

        if(sub_list.indexOf(body[i].service) === -1){
          body[i].subscribed = false;
        }
        else{
          body[i].subscribed = true;
        }
      }

      result = body;
      response.send(result);
    })
  }
  var req = http.request(options, callback);
  req.end();

}

app.listen(port);

require("cf-deployment-tracker-client").track();
