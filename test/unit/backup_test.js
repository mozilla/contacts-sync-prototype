/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global BackupService */

mocha.globals([
  'BackupService',
]);

requireApp('system/shared/test/unit/mocks/mock_navigator_moz_settings.js');
requireApp('system/js/fxa_client.js');
requireApp('/shared/js/fxa_iac_client.js');
requireApp('contacts-sync/js/request.js');
requireApp('contacts-sync/js/storage.js');
requireApp('contacts-sync/js/vcard.js');

var BACKUP_PROVIDERS_PREF = 'identity.services.contacts.providers';
var DEFAULT_PROVIDERS = {
  'fxa_id': 'ethel',
  'provider': 'default',
  'providers': {
    'default': {
      name: 'Pertelote',
      url: 'https://example.org/',
      canProvision: true
    },
    'custom': {
      name: 'pie',
      url: 'https://example.net/',
      username: 'ozymandias',
      password: 'king of ants'
    }
  }
};

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

function mockFxAccountsClient() {
}
mockFxAccountsClient.prototype = {
  getAccounts: function(successCb, errorCb) {
    successCb({
      accountId: 'ethel',
      verified: true
    });
  },

  getAssertion: function(audience, options, successCb, errorCb) {
    successCb('heres~your.assertion.bro');
  }
};

function MockRequest() {
  this.onsuccess = function() {};
  this.onerror = function() {};
}
MockRequest.prototype = {
  done: function(value) {
    if (value.error) {
      return this.onerror(value);
    }
    return this.onsuccess(value);
  }
};

function MockMozContacts() {
  this.id = 1;
  this.contacts = {};
  this.callbacks = [];
}
MockMozContacts.prototype = {
  find: function(options) {
    // options are always going to be to find by id
    var req = new MockRequest();

    setTimeout(function() {
      var result = {
        target: {
          result: [this.contacts[options.filterValue]]
        }
      };
      req.done(result);
    }.bind(this), 0);

    return req;
  },

  save: function(contact) {
    contact.contactID = this.id++;
    this.contacts[contact.contactID] = contact;

    this.callbacks.forEach(function(callback) {
      callback({contactID: contact.contactID});
    });
  },

  set oncontactchange(callback) {
    this.callbacks.push(callback);
  },

  get oncontactchange() {
    // make jshint happy
  },
};

suite('services/contacts', function() {
  var realXHR;
  var realFxAccountsClient;
  var realMozSettings;
  var realMozContacts;

  suiteSetup(function(done) {
    realMozSettings = navigator.mozSettings;
    navigator.mozSettings = MockNavigatorSettings;

    realXHR = XMLHttpRequest;
    XMLHttpRequest = mockXHR;

    realFxAccountsClient = FxAccountsClient;
    FxAccountsClient = new mockFxAccountsClient();

    realMozContacts = navigator.mozContacts;
    navigator.mozContacts = new MockMozContacts();

    // populate mock settings
    var lock = navigator.mozSettings.createLock(BACKUP_PROVIDERS_PREF);
    var settings = {};
    settings[BACKUP_PROVIDERS_PREF] = DEFAULT_PROVIDERS;
    var result = lock.set(settings);
    result.onsuccess = function() {
      requireApp('contacts-sync/js/backup.js', function() {
        ContactsBackupStorage.save(DEFAULT_PROVIDERS).then(function() {
          done();
        });
      });
    };
  });

  suiteTeardown(function() {
    navigator.mozSettings = realMozSettings;
    XMLHttpRequest = realXHR;
    FxAccountsClient = realFxAccountsClient;
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

  // Test mock settings
  test('mock settings', function(done) {
    var req = navigator.mozSettings.createLock().get(BACKUP_PROVIDERS_PREF);
    req.onsuccess = function() {
      done(function() {
        assert.equal('Pertelote', req.result[BACKUP_PROVIDERS_PREF].providers.default.name);
      });
    };
  });

  // Confirm that getAssertion works
  test('mock FxA Client', function(done) {
    FxAccountsClient.getAccounts(function(account) {
      assert.equal(account.accountId, 'ethel', 'Get account id');
      assert.equal(account.verified, true, 'Get account verified');
      FxAccountsClient.getAssertion('https://example.org', {},
        function onsuccess(assertion) {
          done(function() {
            assert.equal(assertion, 'heres~your.assertion.bro', 'Got assertion');
          });
        }
      );
    });
  });

  // XHR Request - PUT
  test('Request PUT', function(done) {
    var creds = {username: 'Queen Anne', password: '123456'};
    var request = new Request('https://example.org', creds);
    request.put('some data').then(function(result) {
      done(function() {
        assert.equal('PUT', request.xhr.method, 'Request method');
        assert.equal('some data', request.xhr.data, 'XHR data');
        assert.equal('Queen Anne', request.creds.username, 'Username');
        assert.equal('123456', request.creds.password, 'Password');
      });
    });
  });

  test('mock mozContacts', function(done) {
    var contact = {
      name: ['The Queeeeeen of France!'],
    };

    var testMozContacts = new MockMozContacts();
    testMozContacts.oncontactchange = function(event) {
      var options = {
        filterBy: ['id'],
        filterOp: 'equals',
        filterValue: 1
      };
      var req = testMozContacts.find(options);
      req.onsuccess = function(event) {
        done(function() {
          assert.equal('The Queeeeeen of France!', event.target.result[0].name[0]);
        });
      };
    };

    testMozContacts.save(contact);
  });

  // Provision an identity 
  test('identity provisioning', function(done) {
    BackupService.provision().then(
      function success(creds) {
        done(function() {
          assert.equal('ethel', creds.username);
          assert.equal('123456', creds.password);
        });
      }
    );
  });

  // Get credentials already provisioned by previous test
  test('get credentials (already provisioned)', function(done) {
    BackupService.getCredentials().then(
      function success(creds) {
        done(function() {
          assert.equal('ethel', creds.username);
          assert.equal('123456', creds.password);
        });
      }
    );
  });

  // Get credentials without prior provisioning.  Clear the stored credentials
  // and call getCredentials().  The BackupService will provision new identity
  // credentials to replace them.
  test('get credentials (no current stored credentials)', function(done) {
    FxAccountsClient.getAccounts(function(account) {
      // Clear current storage
      var noCreds = {
        url: 'https://example.org',
        canProvision: true
      };
      ContactsBackupStorage.setAndUpdateProvider(account.accountId, 'default', noCreds).then(
        function saved() {
          BackupService.getCredentials().then(
            function success(creds) {
              done(function() {
                assert.equal('ethel', creds.username);
                assert.equal('123456', creds.password);
              });
            }
          );
        }
      );
    });
  });

  // Switch the selected provider and get stored credentials
  test('change provider and get credentials', function() {
    FxAccountsClient.getAccounts(function(account) {
      ContactsBackupStorage.setProvider(account.accountId, 'custom').then(
        function updated() {
          BackupService.getCredentials().then(
            function success(creds) {
              done(function() {
                assert.equal('ozymandias', creds.username);
                assert.equal('king of ants', creds.password);
              });
            }
          );
        }
      );
    });
  });

  // Clear the stored credentials and call getCredentials.  Our current
  // provider does not support provisioning, so we expect the credentials to
  // come back null.
  test('get credentials (empty and cannot provision)', function() {
    FxAccountsClient.getAccounts(function(account) {
      // Clear current storage
      var noCreds = {
        url: 'https://example.org',
      };
      ContactsBackupStorage.setAndUpdateProvider(account.accountId, 'custom', noCreds).then(
        function saved() {
          BackupService.getCredentials().then(
            function success(creds) {
              done(function() {
                assert.equal(null, creds.username);
                assert.equal(null, creds.password);
              });
            }
          );
        }
      );
    });
  });

  // Saving navigator.mozContact triggers vcard upload.
  // Use the default account, which can provision for username and password
  test('contact change triggers vcard upload', function(done) {
    FxAccountsClient.getAccounts(function(account) {
      ContactsBackupStorage
        .setProvider(account.accountId, 'default').then(function() {
          var contact = {
            name: ['Prunella']
          };

          // When the outgoing xhr contains the vcard data, we have won.
          function onResponse(data) {
            if (data.match('FN:Prunella')) {
              done(function() {
                assert.ok(true);
              });
            }
          }

          // Spy on xhr
          observer.subscribe(onResponse);

          // Save the contact; onResponse will hear that the vcard was sent
          navigator.mozContacts.save(contact);
        }
      );
    });
  });
});

