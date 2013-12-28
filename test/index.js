var expect = require('expect.js'),
    level = require('level'),
    bytewise = require('bytewise'),
    path = require('path'),
    rimraf = require('rimraf'),
    diff = require('changeset'),
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
      expect(data).to.eql([
        { make: 'Toyota', model: 'Camry' },
        { make: 'Toyota', model: 'Corolla' },
      ]);
      done();
    }
  });

  it('should be able to delete objects', function(done) {
    db = pathdb(db);
    db.pathdb.put(['people'], o, del);

    function del(err) {
      if (err) return done(err);
      db.pathdb.del(['people'], get);
    }

    function get(err) {
      if (err) return done(err);
      db.pathdb.get(['people'], check);
    }

    function check(err, data) {
      expect(err.name).to.equal('NotFoundError');
      expect(data).to.be(undefined);
      done();
    }
  });

  it('should be able to watch a path for changes', function(done) {
    db = pathdb(db);
    db.pathdb.put(['people'], { old: 'data' }, watch);

    function watch(err) {
      var obj;
      if (err) return done(err);
      db.pathdb.watch(['people'])
        .on('value', function (value) {
          expect(value).to.eql({ old: 'data' });
          obj = value;
          process.nextTick(put);
        })
        .on('change', function (changeset) {
          diff.apply(changeset, obj, true);
          expect(obj).to.eql(o);
          done();
        })
        .on('error', done);
    }

    function put(err) {
      db.pathdb.put(['people'], o, noop);
    }
  });

  it('should be able to watch a subpath for changes', function(done) {
    db = pathdb(db);
    db.pathdb.put(['people'], { old: 'data' }, watch);

    function watch(err) {
      var obj;
      if (err) return done(err);
      db.pathdb.watch(['people', 'cars'], [])
        .on('value', function (value) {
          expect(value).to.eql([]);
          obj = value;
          process.nextTick(put);
        })
        .on('change', function (changeset) {
          diff.apply(changeset, obj, true);
          expect(obj).to.eql(o.cars);
          done();
        })
        .on('error', done);
    }

    function put(err) {
      db.pathdb.put(['people'], o, noop);
    }
  });

  it('should be able to apply batch updates to a path', function(done) {
    db = pathdb(db);
    db.pathdb.put(['people'], { old: 'data', smelly: 'socks' }, batch);
    function batch(err) {
      if (err) return done(err);
      db.pathdb.batch(['people'], [
        { type: 'del', key: ['smelly'] },
        { type: 'put', key: ['my', 'new'], value: 'data' },
        { type: 'put', key: ['my', 'extra'], value: 'data' }
      ], get);
    }

    function get(err) {
      if (err) return done(err);
      db.pathdb.get(['people'], check);
    }

    function check(err, data) {
      if (err) return done(err);
      expect(data).to.eql({ my: { extra: 'data', new: 'data' }, old: 'data' });
      done();
    }
  });
});
