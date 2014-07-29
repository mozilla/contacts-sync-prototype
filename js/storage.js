/* global BackupService */

// Exposes the ContactsBackupStorage object, which wraps an internal indexedDB
// database for holding carddav config and credentials for the user.
//
// Schema:
//
// {fxa_id,
//  provider,
//  {provider1: {url, canProvision, username, password},
//   provider2: {url, canProvision, username, password},
//   ...}
// }

// Global db for this module
var gdb = {};
var STORE_NAME = 'settings';
var CONTACTS_PROVIDERS = 'identity.services.contacts.providers';

// XXX maybe create an fxa dom api that encrypts/decrypts records using kB -
// helper function so we don't store stuff in the clear

// Hide db internals
(function() {
  'use strict';

  var DB_NAME = 'services-contacts-backup';
  var VERSION = 1;

  var req = window.indexedDB.open(DB_NAME, VERSION);

  req.onupgradeneeded = function(event) {
    var db = event.target.result;
    db.createObjectStore(STORE_NAME, {keyPath: 'fxa_id'});
    setup(db);
  };

  req.onerror = function() {
    console.error('indexedDB error: ' + req.errorCode);
  };

  req.onsuccess = function(event) {
    var db = req.result;
    setup(db);
  };

  function setup(db) {
    gdb = {
      _db: db,

      // Save credentials for the current fxa user
      //
      // XXX this isn't so good because it blows away the previous settings.
      // if we have default and custom, the user should be able to toggle
      // between them, add more accounts, etc., without having previous
      // settings clobbered.
      save: function(data, onSuccess, onError) {

        var trans = gdb._db.transaction([STORE_NAME], 'readwrite');
        trans.onerror = function(event) {
          onError(event.target.error);
        };

        trans.oncomplete = onSuccess;

        var store = trans.objectStore(STORE_NAME);
        store.put(data);
      },

      // Load the credentials for the current fxa user
      load: function(fxa_id, onSuccess, onError) {
        var results = [];
        if (!gdb._db) {
          return onError(new Error('No database'));
        }

        var store = this._db.transaction(STORE_NAME).objectStore(STORE_NAME);
        var range = store.openCursor(IDBKeyRange.only(fxa_id));

        range.onsuccess = function(event) {
          if (!event.target.result) {
            console.log('** no cursor, so storing defaults');
            var req = navigator.mozSettings.createLock()
                      .get(CONTACTS_PROVIDERS);
            req.onsuccess = function() {
              var data = req.result[CONTACTS_PROVIDERS];
              data.fxa_id = fxa_id;
              console.log('** save: ' + JSON.stringify(data));
              gdb.save(data,
                function onsuccess() {
                  return onSuccess(data);
                },
                function onerror() {
                  return onError(new Error('No cursor'));
                }
              );
            };
            req.onerror = onError;
          }

          var cursor = event.target.result;
          results = cursor.value;
          onSuccess(results);
        };
        range.onerror = onError;
      }
    };
  }
}());

// Public interface
var ContactsBackupStorage = {
  load: function(fxa_id) {
    var deferred = new Promise(function done(resolve, reject) {
      gdb.load(fxa_id, resolve, reject);
    });
    return deferred;
  },

  save: function(data) {
    var deferred = new Promise(function done(resolve, reject) {
      gdb.save(data, resolve, reject);
    });
    return deferred;
  },

  // Load the data for the current provider
  getProviderProfile: function(fxa_id) {
    return new Promise(function done(resolve, reject) {
      this.load(fxa_id).then(
        function (data) {
          var profile = data.providers[data.provider] || null;
          resolve(profile);
        },
        reject
      );
    }.bind(this));
  },

  // Update the profile of the currently-selected provider
  updateProviderProfile: function(fxa_id, profile) {
    var self = this;
    return new Promise(function done(resolve, reject) {
      self.load(fxa_id).then(
        function(data) {
          if (!data.providers) {
            data.providers = {};
          }
          data.providers[data.provider] = profile;
          self.save(data).then(resolve, reject);
        },
        reject
      );
    });
  },

  // Query the currently-selected provider
  getProvider: function(fxa_id) {
    return new Promise(function done(resolve, reject) {
      this.load(fxa_id).then(
        function(data) {
          resolve(data.provider);
        }
      );
    }.bind(this));
  },

  // Change the currently-selected provider
  setProvider: function(fxa_id, provider) {
    var self = this;
    return new Promise(function done(resolve, reject) {
      self.load(fxa_id).then(
        function(data) {
          data.provider = provider;
          self.save(data).then(resolve, reject);
        },
        reject
      );
    });
  },

  // Update the settings for the given provider
  setAndUpdateProvider: function(fxa_id, provider, profile) {
    var self = this;
    return new Promise(function done(resolve, reject) {
      self.load(fxa_id).then(
        function(data) {
          data.provider = provider;
          data.providers[provider] = profile;
          self.save(data).then(resolve, reject);
        },
        reject
      );
    });
  },
};
