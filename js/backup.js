/* Listener for contacts changes */

/* exported BackupService */
/* global navigator, FxAccountsClient */

var BackupService = (function(exports) {

'use strict';

var BackupService = {
  enabled: true,    // TODO: set this with a pref
  queue: [],
  initialized: false,
  fruuxCallback: undefined,
  provisioningAttempts: 0,
  BACKUP_PROVIDERS: 'identity.services.contacts.providers',
  MAX_PROVISIONING_ATTEMPTS: 5,
  creds: {},

  init: function() {
    navigator.mozContacts.oncontactchange = function(event) {
      if (this.enabled) {
        this.enqueue(event.contactID);
        this.process();
      }
    }.bind(this);

    navigator.mozId.watch({
      wantIssuer: 'firefox-accounts',
      onlogin: function(assertion) {
        console.log('Got FxA assertion: ' + assertion);

        var provider_url = 'http://moz.fruux.net';
        var request = new Request(provider_url + '/browserid/login');
        request.post({assertion: assertion, audience: 'app://'+window.location.host}).then(
          function success(result) {
            console.log(result.responseText);
            switch (result.status) {
              case 200:
              case 201:
              case 204:
                this.receiveProvisionedCreds(result.responseText, provider_url);
                this.backup();
                break;

              default:
                console.log(result.statusText);
                break;
            }
        }.bind(this));
      }.bind(this),
      onlogout: function() {
      },
      onready: function() {
      },
      onerror: function() {
      }
    });
  },

  // Find a single contact by id - returns promise
  findContactById: function (contactID) {
    var options = {
      filterBy: ['id'],
      filterOp: 'equals',
      filterValue: contactID
    };

    return new Promise(function done(resolve, reject) {
      var request = navigator.mozContacts.find(options);

      request.onsuccess = function(event) {
        var result = event.target.result;
        if (!result.length) {
          return resolve(null);
        }
        return resolve(result[0]);
      };

      request.onerror = function(error) {
        return reject(error);
      };
    });
  },

  // Provision an identity from a provider
  provision: function() {
    console.log('Provisioning account...');
    navigator.mozId.request({
      oncancel: function(){}
    });
  },

  // return promise
  receiveProvisionedCreds: function (responseText, provider_url) {
      var response;
      try {
        response = JSON.parse(responseText);
      } catch(error) {
        console.log('could not parse: ' + responseText);
        console.error('provisioned creds: ' + error.toString());
        return;
      }

      if (!response.links || !response.basicAuth) {
        console.log('Response did not include links and basicAuth creds');
        return;
      }

      // TODO: discover the addressbook URL
      // (see Discovery on http://sabre.io/dav/building-a-carddav-client/)
      var url = provider_url + response.links['addressbook-home-set'] +
                'default';
      console.log('provisioned creds: ' +
        response.basicAuth.userName + ':' + response.basicAuth.password + ':' + url);
      
      this.creds = {
        url: url,
        username: response.basicAuth.userName,
        password: response.basicAuth.password
      };
  },

  enqueue: function(contactID) {
    if (this.queue.indexOf(contactID)) {
      this.queue = this.queue.splice(this.queue.indexOf(contactID), 1);
    }
    this.queue.push(contactID);
  },

  process: function(delay) {
    delay = delay || 0;

    setTimeout(function later() {
      this.backup();
    }.bind(this), delay);
  },

  upload: function(contactId, vcard, tryingAgain) {
    var self = this;
    if (!self.enabled) {
      return;
    }

    var creds = this.creds;
    if (!creds.username || !creds.password || !creds.url) {
      console.error('no creds!');
      return;
    }
    var url = creds.url + '/' + contactId + '.vcf';
    var request = new Request(url, creds);
    request.put(vcard).then(
      function onsuccess(result) {
        console.log('contact pushed: ' + result.statusText);
        if (result.status !== 201 || result.status !== 204) {
          // on 401, provision and try again
          console.log('got a ' + result.status + ' - will retry');
          // TODO: put a limit of 5 attempts on pushing a single contact
          //self.upload(contactId, vcard, true);
          //
          // TODO 401: reprovision and try again
        }
      }, 
      function onerror(error) {
        console.error('get creds failed: ' + error.toString());
      }
    );
  },

  download: function() {
    var card_req = "<card:addressbook-query xmlns:d=\"DAV:\" xmlns:card=\"urn:ietf:params:xml:ns:carddav\">" +
      "<d:prop><d:gettag /><card:address-data /></d:prop></card:addressbook-query>";
    var request = new Request(this.creds.url, this.creds);
    request.setHeader('content-type', 'application/xml');
    request.setHeader('Depth', '1');
    request.report(card_req).then(function(result) {
      var parser = new DOMParser();
      var xmlDoc = parser.parseFromString(result.responseText, "text/xml");

      xmlDoc.getElementsByTagName("card:address-data").forEach(function(data) {
        var rawCard = data.childNodes[0].nodeValue;

        VCF.parse(rawCard, function(vcard) {
          console.log("FormattedName:", vcard.fn);
          var info = {
            name: vcard.fn,
            tel: vcard.tel
          };

          var contact = new mozContact(info);

          if ("init" in contact) {
            contact.init(info);
          }

          navigator.mozContacts.save(contact);
        });
      });
    }, function(error) {
      console.log(error);
    });
  },

  backup: function() {
    if(!this.creds.username)
      return;
    var contactID = this.queue.shift();

    var self = this;
    if (!contactID) {
      return;
    }

    this.findContactById(contactID).then(
      function resolve(result) {
        try {
          var vcard = new MozContactTranslator(result).toString();
          console.log('** ok upload this: ' + vcard);
          self.upload(result.id, vcard);
        } catch(err) {
          console.error(err);
        }
      },
      function reject(error) {
        console.error(error);
        self.enqueue(contactID);
        self.process(1000);
      }
    );
  },
};

BackupService.init();
exports.BackupService = BackupService;

return BackupService;
})(window);
