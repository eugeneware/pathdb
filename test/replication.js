var expect = require('expect.js'),
    level = require('level'),
    bytewise = require('bytewise'),
    path = require('path'),
    rimraf = require('rimraf'),
    diff = require('changeset'),
    clone = require('clone'),
    after = require('after'),
    observejs = require('observejs'),
    through2 = require('through2'),
    pathdb = require('..');

describe('pathdb', function() {
  var db, dbPath = path.join(__dirname, '..', 'data', 'testdb');
  function noop() {}
  var o;

  beforeEach(function(done) {
    o = {
      name: 'Eugene',
      number: 42,
      tags: ['tag1', 'tag2', 'tag3'],
      cars: [
        {
          make: 'Toyota',
          model: 'Camry'
        },
        {
          make: 'Toyota',
          model: 'Corolla'
        }
      ]
    };
    rimraf.sync(dbPath);
    db = level(dbPath, { keyEncoding: bytewise, valueEncoding: 'json' });
    done();
  });

  afterEach(function(done) {
    db.close(done);
  });

  it('should be able to replicate replica changes', function(done) {
    db = pathdb(db);
    db.pathdb.put(['people'], { old: 'data' }, watch);

    function watch(err) {
      var obj;
      if (err) return done(err);
      db.pathdb.watch(['people'])
        .on('value', function (value) {
          expect(value).to.eql({ old: 'data' });
          obj = clone(value);
          obj.my = { changed: 'data' };
          delete obj.old;

          var changes = diff(value, obj);
          db.pathdb.batch(['people'], changes, noop);
        })
        .on('change', function (changeset) {
          diff.apply(changeset, obj, true);
          expect(obj).to.eql({ my: { changed: 'data' }});
          done();
        })
        .on('error', done);
    }
  });

  it('should be able to replicate multiple replica changes', function(done) {
    db = pathdb(db);
    db.pathdb.put(['people'], { old: 'data' }, watches);

    var obj, obj2;

    var next = after(2, change);
    var changed = after(4, check);

    function watches(err) {
      if (err) return done(err);
      watch();
      watch2();
    }

    function watch() {
      db.pathdb.watch(['people'])
        .on('value', function (value) {
          expect(value).to.eql({ old: 'data' });
          obj = clone(value);
          next();
        })
        .on('change', function (changeset) {
          diff.apply(changeset, obj, true);
          changed();
        })
        .on('error', done);
    }

    function watch2() {
      db.pathdb.watch(['people'])
        .on('value', function (value) {
          expect(value).to.eql({ old: 'data' });
          obj2 = clone(value);
          next();
        })
        .on('change', function (changeset) {
          diff.apply(changeset, obj2, true);
          changed();
        })
        .on('error', done);
    }

    function change() {
      var old = clone(obj);
      obj.my = { changed: 'data' };
      delete obj.old;
      db.pathdb.batch(['people'], diff(old, obj), noop);

      obj2.a = { 'new': 'field' };
      db.pathdb.batch(['people'], diff(old, obj2), noop);
    }

    function check() {
      var expected = { my: { changed: 'data' }, a: { 'new': 'field' } };
      expect(obj).to.eql(expected);
      expect(obj2).to.eql(expected);
      expect(obj).to.eql(obj2);
      done();
    }
  });

  it('should be able to detect changes', function(done) {
    var next = after(2, check);
    var batch = [];
    observejs.observe(o).pipe(through2({ objectMode: true },
      function (chunk, enc, cb) {
        batch.push(chunk);
        next();
        cb();
      }));
    o.name = 'Susan';
    o.number = 21;

    function check() {
      expect(batch).to.eql([
        { type: 'put', key: [ 'name' ], value: 'Susan' },
        { type: 'put', key: [ 'number' ], value: 21 }
      ]);
      done();
    }
  });
});
