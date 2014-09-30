'use strict';
var req = require('../'),
	ResponseError = req.ResponseError,
	nock = require('nock');

require('should');

describe('request-prom', function () {
	var url = 'http://foo.com';

	beforeEach(function () {
		nock(url)
			.get('/500')
			.reply(500)
			.get('/badJSON')
			.reply(200, 'fss')
			.get('/file')
			.reply(200, 'some content')
			.post('/post')
			.reply(200, 'post')
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
			var stream = req.stream({ url: url + '/file' }),
				content = '';
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
	});

	describe('postFile()', function () {
		it('should add filename if path is used', function () {
			req.postFile(url + '/postFile', __dirname + '/index.test.js').then(function (res) {
				res.body.should.equal('OK');
			});
		});
	});

	describe('get()', function () {
		it('should make a GET request', function (done) {
			req.get(url + '/file').then(function (res) {
				res.body.should.equal('some content');
				done();
			}).done();
		});
	});

	describe('post()', function () {
		it('should make a POST request', function () {
			req.post(url + '/post').then(function (res) {
				res.body.should.equal('post');
			}).done();
		});
	});

});