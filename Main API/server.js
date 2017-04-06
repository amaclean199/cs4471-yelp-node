/**
 * A restful API service that is connected to a mongoDB database.
 * The database is hosted on bluemixm, as is the webserver.
 */

var express = require('express');
var fs = require('fs');
var https = require('https');
var http = require('http');
var app = express();

var bodyParser = require('body-parser');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));


const util = require('util')
const assert = require('assert');

// We want to extract the port to publish our app on
var port = process.env.PORT || 8080;

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

// // Add entries using http put
// //Used to remotely add entries to the reviews data base from the json file
// //provided in the yelp challenge
// app.put("/reviews",  function(request, response) {
//   if(!request.body) response.send("body was empty");
//
//   var temp  = request.body;
//
//   //Need to convert from string to int so comparisions are meaningful
//   temp.useful = parseInt(temp.useful);
//   temp.funny = parseInt(temp.funny);
//   temp.cool = parseInt(temp.cool);
//   temp.stars = parseInt(temp.stars);
//
//   mongodb.collection("yelp").insertOne( temp, function(error, result) {
//       if (error) {
//         response.status(500).send(error);
//       } else {
//         response.send(result);
//       }
//     });
// });
//
// //Resets the database if we mess it up
// app.get("/reset", function(request, response) {
//   mongodb.collection("yelp").drop(function(err, words) {
//     if (err) {
//      response.status(500).send(err);
//     } else {
//      response.send(words);
//     }
//   });
// });

//1 of 3 implementations of an Inventory Endpoint pattern for our catagory services
app.get("/funny", function(request, response) {
  mongodb.collection("yelp").find({ "funny" : {"$gt" : 2} }).sort({"_id":-1}).limit(50).toArray(function(err, words) {
    if (err) {
     response.status(500).send(err);
    } else {
     response.send(words);
    }
  });
});

//2 of 3 implementations of an Inventory Endpoint pattern for our catagory services
app.get("/cool", function(request, response) {
  mongodb.collection("yelp").find({ "cool" : {"$gt" : 2} }).sort({"_id":-1}).limit(50).toArray(function(err, words) {
    if (err) {
     response.status(500).send(err);
    } else {
     response.send(words);
    }
  });
});

//3 of 3 implementations of an Inventory Endpoint pattern for our catagory services
app.get("/useful", function(request, response) {
  mongodb.collection("yelp").find({ "useful" : {"$gt" : 2} }).sort({"_id":-1}).limit(50).toArray(function(err, words) {
    if (err) {
     response.status(500).send(err);
    } else {
     response.send(words);
    }
  });
});

// API handling for reviews based on funny/userful/cool rating
// /api/v1/reviews?type=<type>&value=<number>
app.get("/api/v1/reviews", function(request, response) {

  var type = request.query.type;
  var value = parseInt(request.query.value);;

  if( isNaN(value) ){
      response.send({error: true, message: '(233) bad api call: value'+
        ' must be a non-zero integer.'});
        return;
  }

  //Check for correct input
  if( value<0 || !(type==="funny" || type==="cool" || type==="useful") ){
    response.send({error: true, message: '(233) bad api call'});
    return;
  }

  var s = '{"'+type+'":{"$gt":' + value + '}}';
  var j = JSON.parse(s);

  mongodb.collection("yelp").find(j).toArray(function(err, words) {
    if (err) {
      response.status(500).send(err);
    }
    else {
      response.send(words);
    }
  });

});

// API handling for reviews based on an author id
// /api/v1/authors/?author=<author_id>&stars_min=<number>&stars_max=<number>
//                  &date_min=<number>&date_max=<number>
app.get("/api/v1/authors", function(request, response) {

  var author = request.query.author;

  //If there is no author field send the list of all authors
  if(!author){
    mongodb.collection("yelp").distinct("user_id", function(err, words) {
      if (err) {
        response.status(500).send(err);
      }
      else {
        response.send(words);
      }
    });
  }
  else{
    var stars_min = parseInt(request.query.stars_min);
    var stars_max = parseInt(request.query.stars_max);
    var date_min = request.query.date_min;
    var date_max = request.query.date_max;

    //check for null input
    if( isNaN(stars_min) ){
        stars_min = 0;
    }
    if( isNaN(stars_max) ){
        stars_max = 5;
    }
    //Check for sensible input
    if(stars_min < 0){
      stars_min = 0;
    }
    if(stars_max > 5){
      stars_max = 5;
    }
    if(stars_min > stars_max){
      stars_min = 0;
      stars_max = 5;
    }

    //validate date input
    if( ( date_min === null ) || ( !isValidDate(date_min) ) ){
      date_min = "1000-01-01";
    }
    if( ( date_max === null ) || ( !isValidDate(date_min) ) ){
      date_max = "3000-12-31";
    }
    if(date_min > date_max){
      date_min = "1000-01-01";
      date_max = "3000-12-31";
    }

    //Build user Query
    var user = '"user_id":"'+author+'"';
    //Build star query string
    var stars = '"stars":{"$gte":'+stars_min+',"$lte":'+stars_max+'}';
    //Build date query string
    var date = '"date":{"$gte":"'+date_min+'","$lte":"'+date_max+'"}';

    var s = '{' + user  +','
                + date  +','
                + stars +'}';
    var j = JSON.parse(s);

    mongodb.collection("yelp").find(j).toArray(function(err, words) {
      if (err) {
        response.status(500).send(err);
      }
      else {
        response.send(words);
      }
    });
  }

});

// API handling for reviews based on an author id
// /api/v1/authors/?business=<business_id>&stars_min=<number>&stars_max=<number>
//                  &date_min=<number>&date_max=<number>
app.get("/api/v1/business", function(request, response) {

  var business = request.query.business;

  //If there is no business field send the list of all buisnesses
  if(!business){
    mongodb.collection("yelp").distinct("business_id", function(err, words) {
      if (err) {
        response.status(500).send(err);
      }
      else {
        response.send(words);
      }
    });
  }
  else{
    var stars_min = parseInt(request.query.stars_min);
    var stars_max = parseInt(request.query.stars_max);
    var date_min = request.query.date_min;
    var date_max = request.query.date_max;

    //check for null input
    if( isNaN(stars_min) ){
        stars_min = 0;
    }
    if( isNaN(stars_max) ){
        stars_max = 5;
    }
    //Check for sensible input
    if(stars_min < 0){
      stars_min = 0;
    }
    if(stars_max > 5){
      stars_max = 5;
    }
    if(stars_min > stars_max){
      stars_min = 0;
      stars_max = 5;
    }

    //validate date input
    if( ( date_min === null ) || ( !isValidDate(date_min) ) ){
      date_min = "1000-01-01";
    }
    if( ( date_max === null ) || ( !isValidDate(date_min) ) ){
      date_max = "3000-12-31";
    }
    if(date_min > date_max){
      date_min = "1000-01-01";
      date_max = "3000-12-31";
    }

    //Build user Query
    business = '"business_id":"'+business+'"';
    //Build star query string
    var stars = '"stars":{"$gte":'+stars_min+',"$lte":'+stars_max+'}';
    //Build date query string
    var date = '"date":{"$gte":"'+date_min+'","$lte":"'+date_max+'"}';

    var s = '{' + business  +','
                + date  +','
                + stars +'}';
    var j = JSON.parse(s);

    mongodb.collection("yelp").find(j).toArray(function(err, words) {
      if (err) {
        response.status(500).send(err);
      }
      else {
        response.send(words);
      }
    });
  }


});

//Meta data attached to the heartbeat
var id = 'API';
var desc = 'Full access to the Team200 database API. Intended for developers only.';
var link = 'https://cs4471-yelp-node.mybluemix.net/';

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



app.listen(port);

require("cf-deployment-tracker-client").track();

//Validate dateString
//http://stackoverflow.com/questions/6177975/how-to-validate-date-with-format-mm-dd-yyyy-in-javascript
function isValidDate(dateString)
{
    // First check for the pattern
    var regex_date = /^\d{4}\-\d{2}\-\d{2}$/;

    if(!regex_date.test(dateString))
    {
        return false;
    }

    // Parse the date parts to integers
    var parts   = dateString.split("-");
    var day     = parseInt(parts[2], 10);
    var month   = parseInt(parts[1], 10);
    var year    = parseInt(parts[0], 10);

    // Check the ranges of month and year
    if(year < 1000 || year > 3000 || month == 0 || month > 12)
    {
        return false;
    }

    var monthLength = [ 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 ];

    // Adjust for leap years
    if(year % 400 == 0 || (year % 100 != 0 && year % 4 == 0))
    {
        monthLength[1] = 29;
    }

    // Check the range of the day
    return day > 0 && day <= monthLength[month - 1];
};
