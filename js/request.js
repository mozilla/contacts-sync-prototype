/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global Promise */

var Request;

(function(exports) {

'use strict';

function XhrRequest(uri, creds) {
  // XXX check for valid uri
  this.uri = uri;
  this.creds = creds || {};
  this.headers = {};
  this.charset = 'UTF-8';

  // make this a property of the object so we can inspect it in testing
  this.xhr = null;
}

XhrRequest.prototype = {
  response: null,
  statusText: null,
  contentType: 'application/json',

  setHeader: function(name, value) {
    this.headers[name.toLowerCase()] = value.trim();
  },

  get: function(onProgress) {
    return this.dispatch('GET', null, onProgress);
  },

  put: function(data, onProgress) {
    return this.dispatch('PUT', data, onProgress);
  },

  post: function(data, onProgress) {
    return this.dispatch('POST', data, onProgress);
  },

  delete: function(onProgress) {
    return this.dispatch('DELETE', null, onProgress);
  },

  dispatch: function(method, data, onProgress) {
    var self = this;
    onProgress = onProgress || function() {};

    if (data && typeof data != 'string') {
      data = JSON.stringify(data);
    }
    if (!data) {
      data = '';
    }

    self.xhr = new XMLHttpRequest({mozSystem: true});

    if (!this.headers['content-type']) {
      this.setHeader('content-type',
              this.contentType + '; charset=' + this.charset);
    }

    return new Promise(function done(resolve, reject) {
      self.xhr.onload = function() {
        var result = {
          status: self.xhr.status,
          statusText: self.xhr.statusText,
          response: self.xhr.response,
          responseText: self.xhr.responseText
        };
        resolve(result);
      };

      self.xhr.onerror = function(error) {
        reject(error);
      };

      self.xhr.onprogress = onProgress;

      self.xhr.open(method, self.uri, true,
          self.creds.username, self.creds.password);

      Object.keys(self.headers).forEach(function(header) {
        self.xhr.setRequestHeader(header, self.headers[header]);
      });

      self.xhr.send(data);
    });
  },
};

Request = XhrRequest;

}());

