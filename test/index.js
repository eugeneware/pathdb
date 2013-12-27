var expect = require('expect.js'),
    level = require('level'),
    bytewise = require('bytewise'),
    path = require('path'),
    rimraf = require('rimraf'),
    pathos = require('pathos'),
    typewise = require('typewise'),
    pathdb = require('..');

describe('pathdb', function() {
  var db, dbPath = path.join(__dirname, '..', 'data', 'testdb');
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

  it('should be able to serialize an object to the database', function(done) {
    db = pathdb(db);
    db.pathdb.put(o, get);

    function get(err) {
      if (err) return done(err);
      db.get([ 'cars', '1', 'make' ], check);
    }

    function check(err, data) {
      if (err) return done(err);
      expect(data).to.equal('Toyota');
      done();
    }
  });

  it('should be able to serialize an object at a path', function(done) {
    db = pathdb(db);
    db.pathdb.put(['my', 'people'], o, get);

    function get(err) {
      if (err) return done(err);
      db.get(['my', 'people', 'cars', '1', 'make'], check);
    }

    function check(err, data) {
      if (err) return done(err);
      expect(data).to.equal('Toyota');
      done();
    }
  });

  it('should be able to retrieve an object from the database', function(done) {
    db = pathdb(db);
    db.pathdb.put(o, get);

    function get(err) {
      if (err) return done(err);
      db.pathdb.get(check);
    }

    function check(err, data) {
      if (err) return done(err);
      expect(data).to.eql(o);
      done();
    }
  });

  it('should be able to query sub trees', function(done) {
    db = pathdb(db);
    db.pathdb.put(o, get);

    function get(err) {
      if (err) return done(err);
      db.pathdb.get(['cars'], check);
    }

    function check(err, data) {
      if (err) return done(err);
      expect(data).to.eql({
        cars: [
          { make: 'Toyota', model: 'Camry' },
          { make: 'Toyota', model: 'Corolla' },
        ]
      });
      done();
    }
  });
});
