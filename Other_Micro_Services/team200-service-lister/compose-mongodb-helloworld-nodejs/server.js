/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the “License”);
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *  https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an “AS IS” BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

 // First add the obligatory web framework
var express = require('express');
var fs = require('fs');
var https = require('https');
var app = express();

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
var port = process.env.PORT || 8081;

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

app.get("")


var alive_range = 30;

//This is used to recieve the heartbeat from services
//team200-user-service.mybluemix.net/heartbeat?service=<service_id>&desc=<description>&url=<url>
app.get("/heartbeat", function(request, response) {

  var service = request.query.service;
  var desc = request.query.desc;
  var url = request.query.url;

  if(!service){
    response.send('{"error":"service value cannot be blank"}');
  }

  if(!url){
    response.send('{"error":"url value cannot be blank"}');
  }

  var s = '{"service":"' + service + '"}';
  var j = JSON.parse(s);

  //Delete old instances from the database
  mongodb.collection("services").deleteMany(j ,function(err, words) {
    if (err) {
      response.status(500).send(err);
    }
    else {

    }
  });


  //Get current time
  var d = new Date();
  var time = Math.floor(d.getTime()/1000);

  //Add the new heartbeat timestamp to the database
  s = '{"service":"' + service +'", "desc":"'+desc+'", "url":"'+url+'", "time":'+time+'}';
  console.log(s);
  j = JSON.parse(s);

  mongodb.collection("services").insertOne(j ,function(err, words) {
    if (err) {
      response.status(500).send(err);
    }
    else {
      response.send(words);
    }
  });
});

//Gets all services that have checked in within the last 30 seconds
app.get("/services", function(request, response) {

  //Get current time
  var d = new Date();
  var time = Math.floor(d.getTime()/1000);


  var s = '{ "time": {"$gt" : ' +(time - alive_range) +'} }'
  var j = JSON.parse(s);

  mongodb.collection("services").find(j).toArray(function(err, words) {
    if (err) {
      response.status(500).send(err);
    }
    else {
      response.send(words);
    }
  });
});

//deletes the db
app.get("/reset", function(request, response) {

  mongodb.collection("services").drop(function(err, words) {
    if (err) {
      response.status(500).send(err);
    }
    else {
      response.send(words);
    }
  });
});

app.listen(port);

require("cf-deployment-tracker-client").track();
