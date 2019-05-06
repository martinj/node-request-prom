'use strict';
const req = require('../');
const ResponseError = req.ResponseError;
const ConnectionError = req.ConnectionError;
const nock = require('nock');
const should = require('should');

describe('request-prom', () => {
	const url = 'http://foo.com';

	beforeEach(() => {
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
			.get('/slowBody')
			.delay({body: 50})
			.reply(200, 'ok')
			.post('/postFile')
			.reply(200, (path, body) => {
				return body.match(/filename="index\.test\.js"/) ? 'OK' : 'FAIL';
			});
	});

	afterEach(() => {
		nock.cleanAll();
	});

	it('should reject with ResponseError on response failure', (done) => {
		req({url: url + '/500'}).catch(ResponseError, (e) => {
			e.message.should.equal('Request to http://foo.com/500 failed. code: 500');
			e.statusCode.should.equal(500);
			should.exists(e.response);
			done();
		}).catch(done);
	});

	it('should should look for failed url in opts.uri', (done) => {
		req({uri: url + '/500'}).catch(ResponseError, (e) => {
			e.message.should.equal('Request to http://foo.com/500 failed. code: 500');
			e.statusCode.should.equal(500);
			should.exists(e.response);
			done();
		}).catch(done);
	});

	it('should reject with ConnectionError on timeout', (done) => {
		req({url: url + '/timeout', timeout: 10}).catch(ConnectionError, (e) => {
			e.code.should.equal('ESOCKETTIMEDOUT');
			done();
		}).catch(done);
	});

	it('should reject with ConnectionError on request error', (done) => {
		req({url: url + '/error'}).catch(ConnectionError, () => {
			done();
		}).catch(done);
	});

	it('should validate json parsing', (done) => {
		req({url: url + '/badJSON', json: true}).catch(ResponseError, (e) => {
			e.message.should.equal('Unable to parse json from url: http://foo.com/badJSON');
			done();
		}).catch(done);
	});

	describe('stream()', () => {
		it('should return stream that works with nextTick', (done) => {
			const stream = req.stream({url: url + '/file'});
			let content = '';
			process.nextTick(() => {
				stream.on('data', (d) => {
					content += d;
				});

				stream.on('end', () => {
					content.should.equal('some content');
					done();
				});
			});
		});

		it('should emit error with ResponseError if response is not ok', (done) => {
			const stream = req.stream({url: url + '/500'});
			stream.on('error', (err) => {
				err.should.be.instanceOf(ResponseError);
				done();
			});
		});

		it('should emit error with ConnectionError on timeout', (done) => {
			const stream = req.stream({url: url + '/timeout', timeout: 10});
			stream.on('error', (err) => {
				err.should.be.instanceOf(ConnectionError);
				err.code.should.equal('ESOCKETTIMEDOUT');
				done();
			});
		});

	});

	describe('postFile()', () => {
		it('should add filename if path is used', (done) => {
			req.postFile(url + '/postFile', __dirname + '/index.test.js').then((res) => {
				res.body.should.equal('OK');
				done();
			});
		});
	});

	describe('Short hand methods', () => {
		['get', 'post', 'head', 'delete', 'patch', 'put'].forEach((method) => {
			it('should make a ' + method.toUpperCase() + ' request', (done) => {
				req[method](url + '/' + method).then((res) => {
					res.statusCode.should.equal(200);
					done();
				}).catch(done);
			});
		});

		it('should make a get request with custom header', (done) => {
			nock(url, {reqheaders: {'User-Agent': 'testo'}})
				.get('/get/header')
				.reply(200);

			req.get(url + '/get/header', {headers: {'User-Agent': 'testo'}}).then((res) => {
				res.statusCode.should.equal(200);
				done();
			}).catch(done);
		});
	});

	describe('Additional timeouts', () => {
		it('should reject if option timeout is used with socketTimeout or connectTimeout', (done) => {
			req({url: url + '/foo', timeout: 100, socketTimeout: 100})
				.catch((err) => {
					err.message.should.equal('Can\'t use socketTimeout/connectTimeout in conjuction with timeout');
					return req({url: url + '/foo', timeout: 100, connectTimeout: 100});
				})
				.catch((err) => {
					err.message.should.equal('Can\'t use socketTimeout/connectTimeout in conjuction with timeout');
					done();
				});
		});

		describe('connectTimeout', () => {
			it('rejects on timeout with ConnectionError', (done) => {
				// can't figure out a better way to test a real connection timeout
				req({url: 'http://www.google.com:81', connectTimeout: 10})
					.catch(ConnectionError, (e) => {
						e.message.should.equal('Connect timeout occurred when requesting url: http://www.google.com:81');
						done();
					});
			});

			it('doesnt reject if connect is within time', (done) => {
				req({url: url + '/slowBody', connectTimeout: 1})
					.then(() => {
						done();
					})
					.catch(done);

			});
		});

		describe('socketTimeout', () => {
			it('rejects on timeout with ConnectionError', (done) => {
				req({url: url + '/timeout', socketTimeout: 10})
					.catch(ConnectionError, () => {
						done();
					});
			});
		});
	});
});
