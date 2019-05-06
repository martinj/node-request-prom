'use strict';
const request = require('request');
const streamify = require('streamify');
const path = require('path');
const fs = require('fs');
const Readable = require('stream').Readable;
const Promise = require('bluebird');

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
	return new Promise((resolve, reject) => {
		createRequest(opts, resolve, reject);
	});
}

/**
 * Make a [GET, POST, PATCH, DELETE, HEAD, PUT] request
 * @param {String} url
 * @param {Object} [opts] options to request
 * @return {Promise} resolves with response
 */
['GET', 'POST', 'PATCH', 'DELETE', 'HEAD', 'PUT'].forEach((method) => {
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
 * @param  {Object} opts options to request
 * @return {Stream}	from streamify
 */
requestProm.stream = function (opts) {
	const stream = streamify();
	opts = opts || {};

	const req = request(opts);
	req.on('error', (err) => {
		if (err.code && (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT')) {
			return stream.emit('error', new ConnectionError(
				'Connect timeout occurred when requesting url: ' + (opts.url || opts.uri),
				err.code
			));
		}

		return stream.emit('error', new ConnectionError(err.message, err.code));
	});

	req.on('response', (res) => {
		if (!isOk(res.statusCode)) {
			stream.emit('error', new ResponseError(
				'Server responded with ' + res.statusCode + ', unable get data from url: ' + (opts.url || opts.uri),
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
	opts = opts || {};
	opts.url = url;
	opts.method = 'POST';

	return new Promise((resolve, reject) => {
		const req = createRequest(opts, resolve, reject);
		const form = req.form();

		if (file instanceof Readable) {
			form.append('file', file);
		} else {
			form.append('file', fs.createReadStream(file), {filename: path.basename(file)});
		}
	});
};

/**
 * Create Request
 * @param  {Object} opts options to request
 * @param {Function} resolve promise resolver
 * @param {Function} reject promise rejecter
 * @return {Request}
 */
function createRequest(opts, resolve, reject) {
	if (opts.timeout && (opts.socketTimeout || opts.connectTimeout)) {
		reject(new Error('Can\'t use socketTimeout/connectTimeout in conjuction with timeout'));
	}

	const req = request(opts, (err, res, body) => { // eslint-disable-line complexity
		if (err) {
			if (err.code && (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT')) {
				return reject(new ConnectionError(
					`Connect timeout occurred when requesting url: ${opts.url || opts.uri}`,
					err.code
				));
			}

			return reject(new ConnectionError(err.message, err.code));
		}

		if (!isOk(res.statusCode)) {
			return reject(new ResponseError(`Request to ${opts.url || opts.uri} failed. code: ${res.statusCode}`, res));
		}

		if (opts.json && typeof (body) !== 'object') {
			return reject(new ResponseError(`Unable to parse json from url: ${opts.url || opts.uri}`, res));
		}

		return resolve(res);
	});

	if (opts.socketTimeout) {
		req.on('socket', (socket) => {
			if (!socket.connecting) {
				socket.setTimeout(opts.socketTimeout, sockTimeout);
				return;
			}

			socket.on('connect', () => {
				socket.setTimeout(opts.socketTimeout, sockTimeout);
			});
		});
	}

	if (opts.connectTimeout) {
		const connectTimeoutId = setTimeout(() => {
			if (req.req) {
				req.abort();
				const e = new Error('ESOCKETTIMEDOUT');
				e.code = 'ESOCKETTIMEDOUT';
				e.connect = true;
				req.emit('error', e);
			}
		}, opts.connectTimeout);

		req.on('socket', (socket) => {
			socket.on('connect', () => {
				clearTimeout(connectTimeoutId);
			});
		});
	}

	return req;

	function sockTimeout() {
		req.abort();
		const e = new Error('ESOCKETTIMEDOUT');
		e.code = 'ESOCKETTIMEDOUT';
		e.connect = false;
		req.emit('error', e);
	}
}

function ResponseError(message, response) {
	this.message = message;
	this.name = 'ResponseError';
	this.response = response;
	this.statusCode = response.statusCode;
	Error.captureStackTrace(this, ResponseError);
}
ResponseError.prototype = Object.create(Error.prototype);
ResponseError.prototype.constructor = ResponseError;

requestProm.ResponseError = ResponseError;

function ConnectionError(message, code) {
	this.message = message;
	this.code = code;
	this.name = 'ConnectionError';
	Error.captureStackTrace(this, ConnectionError);
}
ConnectionError.prototype = Object.create(Error.prototype);
ConnectionError.prototype.constructor = ConnectionError;

requestProm.ConnectionError = ConnectionError;

module.exports = requestProm;
