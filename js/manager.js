/* receive and store configuration settings via IAC API */

(function() {

'use strict';

var PROVIDERS_SETINGS = 'identity.services.contacts.providers';

window.addEventListener('iac-contacts-backup-settings', function(evt) {
  var message = evt.detail;
  console.log('** manager received: ' + message.action);
  switch (message.action) {
    case 'enable':
      navigator.mozSettings.createLock().set({SYNC_ENABLED_PREF: message.enabled});
      break;
    case 'configure':
      // XXX somehow we would get the id of the currently-signed-in fxa user in
      // here and add it to the message data.
      console.log('** get accounts ...');
      FxAccountsClient.getAccounts(
        function onsuccess(account) {
          if (account) {
            // XXX assert account.verified === true
            message.fxa_id = account.accountId;

            if (message.provider == 'default') {
              var req = navigator.mozSettings.createLock().get(PROVIDERS_SETTINGS);
              req.onsuccess = function() {
                var config = req.result[PROVIDERS_SETTINGS].default;
                message.url = config.url;

                // these will be provisioned from the default service
                message.username = null;
                message.password = null;

                ContactsBackupStorage.save(message);
              };
            } else {
              ContactsBackupStorage.save(message);
            }
          }
        },
        function onerror(error) {
          console.log('** error: ' + error.toString());
        }
      );
      break;
    default:
      console.error('** bogus message: ' + JSON.stringify(message));
      break;
  }
});

}());
