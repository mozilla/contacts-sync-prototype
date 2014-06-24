window.onload = function() {
  console.log('** sync thing setting up');
  var syncNowButton = document.getElementById('sync');

  // toolkit/modules/SyncScheduler.jsm will emit a 'sync' system
  // message when it's time for us to sync.
  navigator.mozSetMessageHandler('sync', function() {
    document.getElementById('feedback').innerHTML =
      'Received sync system message at ' + Date.now();
  });

  syncNowButton.onclick = function() {
    navigator.syncScheduler.requestSync('ohai');
  };
};

