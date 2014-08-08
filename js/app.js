window.onload = function() {
  navigator.mozSetMessageHandler('sync', function() {
    var request = window.navigator.mozContacts.getAll();

    request.onsuccess = function() {
      if(this.result) {
        BackupService.enqueue(this.result.id);
        this.continue();
      } else {
        console.log("Executing");
        BackupService.backup();
      }
    };
  });

  navigator.sync.requestSync("contacts", {
    description: "Sync Contacts",
    minInterval: 5,
    repeating: true
  });
};
