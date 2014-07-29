/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

mocha.globals([
  'Request',
]);

function Observer() {
  this.callbacks = [];
}
Observer.prototype = {
  subscribe: function(cb) {
    this.callbacks.push(cb);
  },

  unsubscribe: function(cb) {
    if (this.callbacks.indexOf(cb) !== -1) {
      this.callbacks = this.callbacks.splice(this.callbacks.indexOf(cb), 1);
    }
  },

  observe: function(data) {
    this.callbacks.forEach(function(cb) {
      cb(data);
    });
  },
};

var observer = new Observer();

function mockXHR(properties) {
  this.properties = properties || {};
  this.headers = {};
  this.method = null;
  this.url = null;
  this.data = null;
  this.response = null;
  this.basicAuth = null;
  this.status = 204; // yeah ...
  this.statusText = 'that worked';
  return this;
}
mockXHR.prototype = {
  get responseText() {
    return JSON.stringify({
      properties: this.properties,
      headers: this.headers,
      method: this.method,
      url: this.url,
      data: this.data,
      basicAuth: this.basicAuth,
      links: this.links,
    });
  },

  setRequestHeader: function(header, value) {
    this.headers[header] = value;
  },

  onload: function() {
    console.error("You didn't handle onload");
  },

  open: function(method, url, async) {
    this.method = method;
    this.url = url;

    if (url.match('browserid/login')) {
      // mock provision an identity
      this.basicAuth = {
        userName: 'ethel',
        password: '123456',
      };
      this.links = "{'addressbook-home-set': 'foo/bar'}";
    }
  },

  send: function(data) {
    try {
      this.data = JSON.parse(data);
    } catch(notJSON) {
      this.data = data;
    }
    this.onload(this.responseText);

    observer.observe(data);
  },
};

suite('services/contacts', function() {
  var realXHR;

  suiteSetup(function(done) {
    realXHR = XMLHttpRequest;
    XMLHttpRequest = mockXHR;

    requireApp('contacts-sync/js/request.js', function() {
      done();
    });
  });

  suiteTeardown(function() {
    XMLHttpRequest = realXHR;
  });

  // Test our MockXMLHttpRequest
  test('mockXHR', function(done) {
    var xhr = new XMLHttpRequest({mozSystem: true});
    xhr.onload = function() {
      var result = JSON.parse(xhr.responseText);
      done(function() {
        assert.equal('POST', result.method, 'XHR method');
        assert.ok(result.properties.mozSystem, 'mozSystem request');
        assert.equal('https://example.org', result.url, 'Correct url');
        assert.equal('I like pie!', result.data, 'Correct data');
      });
    };

    xhr.open('POST', 'https://example.org', true);
    xhr.send(JSON.stringify('I like pie!'));
  });

  // Ensure that put(), get(), etc., call the correct methods
  test('method mappings', function(done) {
    var tests = 0;
    var methods = ['put', 'get', 'post', 'delete'];
    methods.forEach(function(method) {
      var request = new Request('https://example.org');
      request[method]().then(function(result) {
        assert.equal(method.toUpperCase(), request.xhr.method, 'method');
        tests += 1;
        if (tests === methods.length) {
          done();
        }
      });
    });
  });

  // Data and headers are correct
  test('request contents', function(done) {
    var creds = {username: 'foo', password: 'bar'};
    var request = new Request('https://example.com', creds);
    request.post({baz: 42}).then(function(result) {
      done(function() {
        // xhr result
        assert.equal(204, result.status, 'Status code');
        assert.equal('that worked', result.statusText, 'Status text');

        // xhr headers and data
        assert.equal('application/json; charset=UTF-8',
          request.xhr.headers['content-type'], 'Content type');
        assert.equal(42, request.xhr.data.baz, 'Request data');

        // request object internals
        assert.equal('foo', request.creds.username, 'Username');
        assert.equal('bar', request.creds.password, 'Password');
      });
    });
  });
});
