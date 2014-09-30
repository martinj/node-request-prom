# request-prom

Promise wrapper for [request](https://github.com/mikeal/request)

[![build status](https://secure.travis-ci.org/martinj/node-request-prom.png)](http://travis-ci.org/martinj/node-request-prom)

## Installation

This module is installed via npm:

	$ npm install request-prom


## Examples


### Simple

```
var request = require('request-prom'),
request.get('http://google.com').then(function(response) {
	console.log(response.body);
});

```


### Stream Request

```
var request = require('request-prom'),
	fs = require('fs'),
	stream = request.stream({ url: 'http://google.com'}),
	output = fs.createWriteStream(__dirname + '/out.html');

//to illustrate that this isn't affected by the process.nextTick problem that request suffers from
process.nextTick(function () {
	stream.pipe(output);
});

```

### Using ResponseError

request-prom rejects promises with ResponseError if the http status code isn't 2xx
 

```
	var request = require('request-prom'),
		ResponseError = request.ResponseError; 
	
	request.get('http://ohno.com/asdaf').catch(ResponseError, function (e) {
		console.log('Oh no! The request failed with status code', e.statusCode, 'And body', e.body);
	});
	
```

## Documentation

Options to request refers to the following [options](https://github.com/mikeal/request#requestoptions-callback) 

requestProm(opts) 
-----------------------------
Make a request

**Parameters**

**opts**: Object, options to request

**Returns**: Promise, resolves with response

get(url, opts) 
-----------------------------
Make a GET request

**Parameters**

**url**: String, Make a GET request

**opts**: Object, options to request

**Returns**: Promise, resolves with response

stream(url, opts) 
-----------------------------
Make a request that returns a stream thats not sensitive to use after a process.nextTick()

**Parameters**

**url**: String, Make a request that returns a stream thats not sensitive to use after a process.nextTick()

**opts**: Object, options to request

**Returns**: Stream, from streamify

post(url, opts) 
-----------------------------
Make a POST request

**Parameters**

**url**: String, Make a POST request

**opts**: Object, options to request

**Returns**: Promise, resolves with response

postFile(url, file, opts) 
-----------------------------
Make a form POST request with a file.

**Parameters**

**url**: String, Make a form POST request with a file.

**file**: String | stream.Readable, the full path to the file or a stream.Readable.

**opts**: Object, options to request

**Returns**: Promise, resolves with response

