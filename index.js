'use strict';
var request = require('request');
var streamify = require('streamify');
var path = require('path');
var fs = require('fs');
var Readable = require('stream').Readable;
var Promise = require('bluebird');

/**
 * Is status code 2xx
 * @param  {Integer}  statusCode
 * @return {Boolean}
 */
function isOk(statusCode) {
	return (statusCode / 100 | 0) === 2;
}

/**
 * Make a request
 * @param {Object} opts options to request
 * @return {Promise} resolves with response or rejects with ResponseError or ConnectionError
 */
function requestProm(opts) {
	var defer = Promise.defer();
	createRequest(opts, defer);
	return defer.promise;
}

/**
 * Make a [GET, POST, PATCH, DELETE, HEAD, PUT] request
 * @param {String} url
 * @param {Object} [opts] options to request
 * @return {Promise} resolves with response
 */
['GET', 'POST', 'PATCH', 'DELETE', 'HEAD', 'PUT'].forEach(function (method) {
	// create short hand functions
	requestProm[method.toLowerCase()] = function (url, opts) {
		opts = opts || {};
		opts.url = url;
		opts.method = method;
		return requestProm(opts);
	};
});

/**
 * Make a request that returns a stream thats not sensitive to use after a process.nextTick()
 * @param  {String}  url
 * @param  {Object} opts options to request
 * @return {Stream}	from streamify
 */
 requestProm.stream = function (opts) {
	var stream = streamify();
	opts = opts || {};

	var req = request(opts);
	req.on('error', function (err) {
		if (err.code && (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT')) {
			return stream.emit('error', new ConnectionError(
				'Connect timeout occurred when requesting url: ' + opts.url,
			 	err.code
			));
		}

		return stream.emit('error', new ConnectionError(err.message, err.code));
	});

	req.on('response', function (res) {
		if (!isOk(res.statusCode)) {
			stream.emit('error', new ResponseError(
				'Server responded with ' + res.statusCode + ', unable get data from url: ' + opts.url,
				res
			));
		}
		stream.resolve(req);
	});

	return stream;
};

/**
 * Make a form POST request with a file.
 * @param {String} url
 * @param {String|stream.Readable} file the full path to the file or a stream.Readable.
 * @param {Object} [opts] options to request
 * @return {Promise} resolves with response
 */
 requestProm.postFile = function (url, file, opts) {
	var defer = Promise.defer();
	opts = opts || {};
	opts.url = url;
	opts.method = 'POST';

	var req = createRequest(opts, defer),
		form = req.form();

	if (file instanceof Readable) {
		form.append('file', file);
	} else {
		form.append('file', fs.createReadStream(file), { filename: path.basename(file) });
	}

	return defer.promise;
};

/**
 * Create Request
 * @param  {Object} opts options to request
 * @param  {Object} defer promise deferer
 * @return {Request}
 */
function createRequest(opts, defer) {
	return request(opts,
		function (err, res, body) {
			if (err) {
				if (err.code && (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT')) {
					return defer.reject(new ConnectionError(
						'Connect timeout occurred when requesting url: ' + opts.url,
						err.code
					));
				}

				return defer.reject(new ConnectionError(err.message, err.code));
			}

			if (!isOk(res.statusCode)) {
				return defer.reject(new ResponseError('Request to ' + opts.url + ' failed. code: ' + res.statusCode, res));
			}

			if (opts.json && typeof(body) !== 'object') {
				return defer.reject(new ResponseError('Unable to parse json from url: ' + opts.url, res));
			}

			return defer.resolve(res);
		}
	);
}

/**
 * ResponseError
 */
function ResponseError(message, response) {
    this.message = message;
    this.name = "ResponseError";
    if (response) {
    	this.body = response.body;
    	this.statusCode = response.statusCode;
    }
    Error.captureStackTrace(this, ResponseError);
}
ResponseError.prototype = Object.create(Error.prototype);
ResponseError.prototype.constructor = ResponseError;

requestProm.ResponseError = ResponseError;

/**
 * ConnectionError
 */
function ConnectionError(message, code) {
    this.message = message;
    this.code = code;
    this.name = "ConnectionError";
    Error.captureStackTrace(this, ConnectionError);
}
ConnectionError.prototype = Object.create(Error.prototype);
ConnectionError.prototype.constructor = ConnectionError;

requestProm.ConnectionError = ConnectionError;

module.exports = requestProm;
