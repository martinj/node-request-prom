'use strict';
var req = require('../');
var ResponseError = req.ResponseError;
var ConnectionError = req.ConnectionError;
var nock = require('nock');
var should = require('should');

describe('request-prom', function () {
	var url = 'http://foo.com';

	beforeEach(function () {
		nock(url)
			.get('/500')
			.reply(500)
			.get('/get')
			.reply(200)
			.post('/post')
			.reply(200)
			.head('/head')
			.reply(200)
			.delete('/delete')
			.reply(200)
			.put('/put')
			.reply(200)
			.patch('/patch')
			.reply(200)
			.get('/badJSON')
			.reply(200, 'fss')
			.get('/file')
			.reply(200, 'some content')
			.get('/timeout')
			.socketDelay(2000)
			.reply(200)
			.get('/error')
			.replyWithError('shit')
			.post('/postFile')
			.reply(200, function (path, body) {
				return body.match(/filename="index\.test\.js"/) ? 'OK' : 'FAIL';
			});
	});

	afterEach(function () {
		nock.cleanAll();
	});

	it('should reject with ResponseError on response failure', function (done) {
		req({ url: url + '/500' }).catch(ResponseError, function (e) {
			e.message.should.equal('Request to http://foo.com/500 failed. code: 500');
			e.statusCode.should.equal(500);
			should.exists(e.response);
			done();
		}).done();
	});

	it('should reject with ConnectionError on timeout', function (done) {
		req({ url: url + '/timeout', timeout: 10 }).catch(ConnectionError, function (e) {
			e.code.should.equal('ESOCKETTIMEDOUT');
			done();
		}).done();
	});

	it('should reject with ConnectionError on request error', function (done) {
		req({ url: url + '/error' }).catch(ConnectionError, function (e) {
			done();
		}).done();
	});

	it('should validate json parsing', function (done) {
		req({ url: url + '/badJSON', json: true }).catch(ResponseError, function (e) {
			e.message.should.equal('Unable to parse json from url: http://foo.com/badJSON');
			done();
		}).done();
	});

	describe('stream()', function () {
		it('should return stream that works with nextTick', function (done) {
			var stream = req.stream({ url: url + '/file' });
			var content = '';
			process.nextTick(function () {
				stream.on('data', function (d) {
					content += d;
				});

				stream.on('end', function () {
					content.should.equal('some content');
					done();
				});
			});
		});

		it('should emit error with ResponseError if response is not ok', function (done) {
			var stream = req.stream({ url: url + '/500' });
			stream.on('error', function (err) {
				err.should.be.instanceOf(ResponseError);
				done();
			});
		});

		it('should emit error with ConnectionError on timeout', function (done) {
			var stream = req.stream({ url: url + '/timeout',  timeout: 10 });
			var firstError = true;
			stream.on('error', function (err) {
				err.should.be.instanceOf(ConnectionError);
				if (firstError) {
					firstError = false;
					err.code.should.equal('ESOCKETTIMEDOUT');
				} else {
					err.message.should.equal('Request aborted');
					done();
				}
			});
		});

	});

	describe('postFile()', function () {
		it('should add filename if path is used', function () {
			req.postFile(url + '/postFile', __dirname + '/index.test.js').then(function (res) {
				res.body.should.equal('OK');
			});
		});
	});

	describe('Short hand methods', function () {
		['get', 'post', 'head', 'delete', 'patch', 'put'].forEach(function (method) {
			it('should make a ' + method.toUpperCase() + ' request', function (done) {
				req[method](url + '/' + method).then(function (res) {
					res.statusCode.should.equal(200);
					done();
				}).done();
			});
		});

		it('should make a get request with custom header', function (done) {
			nock(url, {reqheaders: {'User-Agent': 'testo'}})
				.get('/get/header')
				.reply(200);

			req.get(url + '/get/header', { headers: {'User-Agent': 'testo'}}).then(function (res) {
				res.statusCode.should.equal(200);
				done();
			}).done();
		});
	});
});
