/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

requireApp('contacts-sync/js/vcard.js', loaded);

var CRLF = '\r\n';

function loaded() {
  suite('VCard', function() {
    test('smoke test', function() {
      assert.ok(typeof Property == 'function');
      assert.ok(typeof MozContactTranslator == 'function');
    });

    test('unfold', function() {
      var unfold = new MozContactTranslator({}).unfold;

      // https://tools.ietf.org/html/rfc6350#page-5
      var TEST_LINE_1 = 'NOTE:This is a long description that exists on a long line.';

      // Test of a 'text' value type
      // https://tools.ietf.org/html/rfc6350#page-11
      var TEST_LINE_2 = 'NOTE:Mythical Manager\nHyjinx Software Division\nBabsCo\\, Inc.\n';

      // Test of a 'note' value type, with escaped comma
      // https://tools.ietf.org/html/rfc6350#page-43
      var TEST_LINE_3 = 'NOTE:This fax number is operational 0800 to 1715 EST\\, Mon-Fri.';

      assert.equal(TEST_LINE_1,
        unfold('NOTE:This is a long description\r\n  that exists on a long line.'));

      assert.equal(TEST_LINE_1,
        unfold('NOTE:This is a long descrip\r\n tion that exists o\r\n n a long line.'));

      assert.equal(TEST_LINE_2,
        unfold('NOTE:Mythical Manager\nHyjinx Software Division\n\r\n BabsCo\\, Inc.\n'));

      assert.equal(TEST_LINE_3,
        unfold('NOTE:This fax number is operational 0800 to 1715\r\n  EST\\, Mon-Fri.'));
    });

    test('fold', function() {
      var INPUT =
        '123456789012345678901234567890123456789012345678901234567890123456789012345678' +
        '12345678901234567890123456789012345678901234567890123456789012345678901234567' +
        '12345678901234567890123456789012345678901234567890123456789012345678901234567' +
        '12345678901234567890123456789012345678901234567890123456789012345678901234567' +
        '1';
      var translator = new MozContactTranslator({});
      var result = translator.fold(INPUT);

      var lines = result.toString().split(/\r\n/);
      assert.equal(lines.length, 5);

      // Indentation is correct, and line length compensates for indentation
      assert.equal(lines[0],
        '123456789012345678901234567890123456789012345678901234567890123456789012345678');
      assert.equal(lines[3],
        ' 12345678901234567890123456789012345678901234567890123456789012345678901234567');
      assert.equal(lines[4], ' 1');

      // Round-trip back
      assert.equal(INPUT, translator.unfold(result.toString()));
    });

    test('property params are escaped', function() {
      var EXPECTED = 'EMAIL;TYPE="tl;dr: a ^^ ^\'and^\' ^n a stick":tldr@example.com';

      var contact = {
        email: [{
          type: ['tl;dr: a ^ "and" \n a stick'],
          value: 'tldr@example.com',
        }],
      };

      var result = new MozContactTranslator(contact).EMAIL;
      assert.equal(EXPECTED, result);
    });

    test('multiple values for property', function() {
      var EXPECTED = 'EMAIL;TYPE=home,personal,private:me@example.com';

      var contact = {
        email: [{
          type: ['home', 'personal', 'private'],
          value: 'me@example.com',
        }],
      };

      var result = new MozContactTranslator(contact).EMAIL;
      assert.equal(EXPECTED, result);
    });

    test('FN', function() {
      var EXPECTED = 'FN:Charles Arthur Strong';

      var contact = {
        name: ['Charles Arthur Strong'],
      };

      var result = new MozContactTranslator(contact).FN;
      assert.equal(EXPECTED, result);
    });

    test('N', function() {
      var EXPECTED = 'N:Strong;Charles Arthur;;Brigadier,Sir,Mrs.;O.B.E.';

      var contact = {
        honorificPrefix: ['Brigadier', 'Sir', 'Mrs.'],
        givenName: ['Charles Arthur'],
        additionalName: [''],
        familyName: ['Strong'],
        honorificSuffix: ['O.B.E.'],
        nickname: [''],
      };

      var result = new MozContactTranslator(contact).N;
      assert.equal(EXPECTED, result);
    });

    test('NICKNAME', function() {
      var EXPECTED = 'NICKNAME:Jed,Jedly,Jedster,Jedsterinoooo';

      var contact = {
        nickname: ['Jed', 'Jedly', 'Jedster', 'Jedsterinoooo'],
      };

      var result = new MozContactTranslator(contact).NICKNAME;
      assert.equal(EXPECTED, result);
    });

    // XXX test photo

    test('BDAY', function() {
      var bday = +new Date('Feb 02 1971 07:11 -0500');
      var EXPECTED = 'BDAY:1971-02-02';

      var contact = {
        bday: bday,
      };

      var result = new MozContactTranslator(contact).BDAY;
      assert.equal(EXPECTED, result);
    });

    test('ANNIVERSARY', function() {
      var anniversary = +new Date('Aug 07 2004 06:50 -0700');
      var EXPECTED = 'ANNIVERSARY:' + new Date(anniversary).toISOString();

      var contact = {
        anniversary: anniversary,
      };

      var result = new MozContactTranslator(contact).ANNIVERSARY;
      assert.equal(EXPECTED, result);
    });

    test('GENDER', function() {
      var EXPECTED = 'GENDER:O;parthenogenic';

      var contact = {
        sex: 'O',
        genderIdentity: 'parthenogenic',
      };

      var result = new MozContactTranslator(contact).GENDER;
      assert.equal(EXPECTED, result);
    });

    test('ADR', function() {
      var EXPECTED = 'ADR;TYPE=work;PREF=1:;;Puzzler Tower\\, Car Talk Plaza\\, ' +
                     'Box 3500 Havad Sq.;Cambridge;MA;02238;USA';

      var contact = {adr: [{
        type: 'work',
        pref: true,
        streetAddress: 'Puzzler Tower, Car Talk Plaza, Box 3500 Havad Sq.',
        locality: 'Cambridge',
        region: 'MA',
        postalCode: '02238',
        countryName: 'USA',
      }]};

      var result = new MozContactTranslator(contact).ADR;
      // This is a long line, so it will split
      assert.ok(/\r\n/.test(result));
      assert.equal(EXPECTED, result.toString().split(/\r\n /).join(''));
    });

    test('TEL', function() {
      var EXPECTED = [
        'TEL;TYPE=work;PREF=1;X-MOZ-CARRIER=pigeon:867 5309',
        'TEL;TYPE=home;X-MOZ-CARRIER=AfricanSwallow:0845 748 4950',
        'TEL;TYPE=cell:333 FILM',
      ];

      var contact = {tel: [
        {
          type: ['work'],
          pref: true,
          carrier: 'pigeon',
          value: '867 5309',
        },
        {
          type: ['home'],
          carrier: 'AfricanSwallow',
          value: '0845 748 4950',
        },
        {
          type: ['cell'],
          value: '333 FILM',
        },
      ]};

      var result = new MozContactTranslator(contact).TEL;
      result.forEach(function(x) {
        assert.ok(EXPECTED.indexOf(x.toString()) > -1);
      });
    });

    test('EMAIL', function() {
      var EXPECTED = [
        'EMAIL;TYPE=work;PREF=1:nijones@stockbroker.co.uk',
        'EMAIL;TYPE=home:nigel.i.jones@treehuggers.co.uk',
        'EMAIL;TYPE=yacht:n.incubator-jones@luxury-yacht.ch',
      ];

      var contact = {email: [
        {
          type: ['work'],
          value: 'nijones@stockbroker.co.uk',
          pref: true,
        },
        {
          type: ['home'],
          value: 'nigel.i.jones@treehuggers.co.uk',
        },
        {
          type: ['yacht'],
          value: 'n.incubator-jones@luxury-yacht.ch',
        },
      ]};

      var result = new MozContactTranslator(contact).EMAIL;
      assert.equal(result.length, 3);
      result.forEach(function(x) {
        assert.ok(EXPECTED.indexOf(x.toString()) > -1);
      });
    });

    test('IMPP', function() {
      var EXPECTED = [
        'IMPP;X-MOZ-TYPE=guards:gbhamster@guards.co.uk',
        'IMPP;X-MOZ-TYPE=home;PREF=1:g.brooke-hamster@uctwit.co.uk',
        'IMPP:waste-paper-basket@brooke-hamster.co.uk',
      ];

      var contact = {impp: [
        {
          type: ['guards'],
          value: 'gbhamster@guards.co.uk',
        },
        {
          type: ['home'],
          pref: true,
          value: 'g.brooke-hamster@uctwit.co.uk',
        },
        {
          value: 'waste-paper-basket@brooke-hamster.co.uk',
        },
      ]};

      var result = new MozContactTranslator(contact).IMPP;
      assert.equal(result.length, 3);
      result.forEach(function(x) {
        assert.ok(EXPECTED.indexOf(x.toString()) > -1);
      });
    });

    test('TITLE', function() {
      var EXPECTED = [
        'TITLE:O-level in camel hygiene',
        'TITLE:Can count up to four',
      ];

      var contact = {jobTitle: [
        'O-level in camel hygiene',
        'Can count up to four',
      ]};

      var result = new MozContactTranslator(contact).TITLE;
      assert.equal(result.length, 2);
      result.forEach(function(x) {
        assert.ok(EXPECTED.indexOf(x.toString()) > -1);
      });
    });

    test('ORG', function() {
      // It's a man's life in the British Dental Association
      var EXPECTED = [
        'ORG:British Dental Association',
      ];

      var contact = {org: [
        'British Dental Association',
      ]};

      var result = new MozContactTranslator(contact).ORG;
      assert.equal(result.length, 1);
      assert.equal(result[0], EXPECTED[0]);
    });

    test('NOTE', function() {
      var EXPECTED = [
        'NOTE:Fell off the back of a motorcyclist\\, most likely',
      ];

      var contact = {note: [
        'Fell off the back of a motorcyclist, most likely',
      ]};

      var result = new MozContactTranslator(contact).NOTE;
      assert.equal(result.length, 1);
      assert.equal(result[0], EXPECTED[0]);
    });

    test('PRODID', function() {
      var EXPECTED = 'PRODID:-//Mozilla.org//NONSGML Mozilla Contacts v0.0//EN';

      assert.equal(EXPECTED, new MozContactTranslator({}).PRODID);
    });

    test('REV', function() {
      var EXPECTED = 'REV:2014-03-05T07:34:14.000Z';

      var updated = new Date('Tue Mar 04 2014 23:34:14 GMT-0800 (PST)');
      var contact = {updated: updated};

      var result = new MozContactTranslator(contact).REV;
      assert.equal(EXPECTED, result);
    });

    test('UID', function() {
      var EXPECTED = 'UID:25b75592-3e46-478b-95c7-f442124fce54';

      var contact = {id: '25b75592-3e46-478b-95c7-f442124fce54'};

      var translator = new MozContactTranslator(contact);
      assert.equal(EXPECTED, translator.UID);
    });

    test('URL', function() {
      var EXPECTED = [
        'URL;TYPE=home;PREF=1:https://example.co.uk/dentist',
        'URL;TYPE=work:https://www.bda.co.uk/~leming',
      ];

      var contact = {url: [
        {
          type: ['work'],
          value: 'https://www.bda.co.uk/~leming',
        },
        {
          type: ['home'],
          pref: true,
          value: 'https://example.co.uk/dentist',
        },
      ]};

      var result = new MozContactTranslator(contact).URL;
      assert.equal(result.length, 2);
      result.forEach(function(x) {
        assert.ok(EXPECTED.indexOf(x.toString()) > -1);
      });
    });

    test('KEY', function() {
      var KEY = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDqGO87SVcCwYp8yr2YVjYPJJczhlrb+h8uLhhsglkHPOKkdnLKKIaORiMnHsBLLm4v4pq/tsJNlYWRRTaf1v1WAQLCKr1tY6TbBTq/dWhHFyLcJAbUmBUj5W0e6O62UnJ9VdSUJuDOHOkPD8ehOCKUlx3JMSJTrpKbEt92Fjk1/Jw3YCyCr0UQlphWPHTQKqRgXaahfuXKVH7oNQKQWC1X/73hPoBS/cY9lsgLLshgkdOIHgnl9FpuTlxqodcP8Sfl5KJZje33RwZSRsmf2RsSoQwSOlz7UY7CZ6khxFAB4WRXqA+0VSxbsPH9JKPCJjzCv9CHNxpr0iXShrHdziIT alice@example.org';
      var EXPECTED = 'KEY:' + KEY;

      var contact = {key: [KEY]};
      var result = new MozContactTranslator(contact).KEY;

      // This should wrap
      assert.ok(/\r\n/.test(result));
      assert.equal(EXPECTED, result.toString().split(/\r\n /).join(''));
    });

    test('CATEGORIES', function() {
      var EXPECTED = 'CATEGORIES:pie,flan';
      var contact = {categories: ['pie', 'flan']};
      var result = new MozContactTranslator(contact).CATEGORIES;
      assert.equal(EXPECTED, result);
    });

    test('empty data does not crash', function() {
      // This is a malformed VCard, because it doesn't include both the VERSION and
      // the FN properties.  (See https://tools.ietf.org/html/rfc6350#page-6).
      // XXX should we throw if we have an invalid vcard?
      var EXPECTED =
        'BEGIN:VCARD' + CRLF +
        'VERSION:4.0' + CRLF +
        'END:VCARD'   + CRLF;

      var result = new MozContactTranslator({}).toString();
      assert.equal(EXPECTED, result);
    });

    test('example vcard', function() {
      var UUID = '97fc83ca-3c2d-401a-88c2-6f285dc3befd';
      var NOW = new Date();
      var BDAY = new Date('April 1, 1927');
      var EXPECTED =
        'BEGIN:VCARD' + CRLF +
        'VERSION:4.0' + CRLF +
        'FN:Kevin Phillips-Bong' + CRLF +
        'N:Phillips-Bong;Kevin;;Sir;' + CRLF +
        'NICKNAME:Sir Kev' + CRLF +
        'BDAY:1927-04-01' + CRLF +
        'TEL;TYPE=work:0845 748 4950' + CRLF +
        'EMAIL;TYPE=work;PREF=1:kpb@ssp.co.uk' + CRLF +
        'GENDER:M;' + CRLF +
        // Folded line:
        'ADR;TYPE=home:;;Behind the hot water pipes\\, third washroom along\\, Victoria ' + CRLF +
        ' Station;London;;SW1W 9SJ;UK' + CRLF +
        'ADR;TYPE=work;PREF=1:;;115 Buckingham Palace Road;London;;SW1W 9SJ;UK' + CRLF +
        'TITLE:Candidate' + CRLF +
        'ORG:Slightly Silly Party' + CRLF +
        'NOTE:Lost 1970 general election to the candidate from the Silly Party' + CRLF +
        'REV:' + NOW.toISOString() + CRLF +
        'UID:97fc83ca-3c2d-401a-88c2-6f285dc3befd' + CRLF +
        'URL;TYPE=work;PREF=1:https://slightly-silly-party.co.uk/kev' + CRLF +
        'URL;TYPE=home:https://phillips-bong.co.uk/election' + CRLF +
        'END:VCARD' + CRLF;

      var contact = {
        id: UUID,
        published: NOW,
        updated: NOW,
        name: ['Kevin Phillips-Bong'],
        honorificPrefix: ['Sir'],
        givenName: ['Kevin'],
        additionalName: [],
        familyName: ['Phillips-Bong'],
        honorifixSuffix: ['Esq.'],
        nickname: ['Sir Kev'],
        email: [
          {
            type: ['work'],
            pref: true,
            value: 'kpb@ssp.co.uk',
          },
        ],
        // photo: XXX fix me
        url: [
          {
            type: ['work'],
            pref: true,
            value: 'https://slightly-silly-party.co.uk/kev',
          },
          {
            type: ['home'],
            value: 'https://phillips-bong.co.uk/election',
          },
        ],
        // category: XXX what?
        adr: [
          {
            type: ['home'],
            streetAddress: 'Behind the hot water pipes, third washroom along, Victoria Station',
            locality: 'London',
            postalCode: 'SW1W 9SJ',
            countryName: 'UK',
          },
          {
            type: ['work'],
            pref: true,
            streetAddress: '115 Buckingham Palace Road',
            locality: 'London',
            postalCode: 'SW1W 9SJ',
            countryName: 'UK',
          },
        ],
        tel: [
          {
            type: ['work'],
            value: '0845 748 4950',
          },
        ],
        org: [
          'Slightly Silly Party',
        ],
        jobTitle: [
          'Candidate',
        ],
        bday: BDAY,
        note: [
          'Lost 1970 general election to the candidate from the Silly Party',
        ],
        impp: [],
        sex: 'M',
      };

      var result = new MozContactTranslator(contact).toString();
      assert.equal(EXPECTED, result);
    });

  });
}
