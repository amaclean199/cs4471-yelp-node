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
var app = express();
var bodyParser = require('body-parser');
console.log('before http');
var http = require('http');

app.use(bodyParser.urlencoded({
  extended: false
}));


// Util is handy to have around, so thats why that's here.
const util = require('util')
// and so is assert
const assert = require('assert');

// We want to extract the port to publish our app on
var port = process.env.PORT || 8080;


//-----------------------------------------------
console.log("close to get");
var id = 'AUTHOR';
app.get("/sevices", function(request, response){
  var options = {
      host : "cs4471-yelp-node.mybluemix.net",
      path : "/author",
      method : "GET"
  };
  console.log("befor callback fun");
  var callback = function(resp){
    var body = '';

    resp.on('data', function(data){
      body += data;
      console.log("body " + body);
    });
    console.log("after callback fun");
    resp.on('end', function(){
      console.log(body);
      response.send(body);
    })
  }
  var req = http.request(options, callback);
  //cosole.log(request);
  req.end();
});

// //testing purpose
// function myFunc (arg) {
//   console.log('arg was => ' + arg);
//   app.put(arg, function (req, res) {
//     res.send('Got a PUT request at /user')
//   })
// }
//
//
//
// setInterval(function(){
//   myFunc('/user');
// }, 2000);







//------------------------------------

// Now we go and listen for a connection.
app.listen(port);

require("cf-deployment-tracker-client").track();
