var expect = require('expect.js'),
    level = require('level'),
    levelPromise = require('level-promise'),
    bytewise = require('bytewise'),
    path = require('path'),
    rimraf = require('rimraf'),
    diff = require('changeset'),
    pathdb = require('..');

describe('pathdb promise api', function() {
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
    db = pathdb(levelPromise(db));
    db.pathdb.put(o)
      .then(function () {
        return db.get([ 'cars', 1, 'make' ]);
      })
      .then(function (data) {
        expect(data).to.equal('Toyota');
        done();
      })
      .catch(done);
  });

  it('should be able to serialize an object at a path', function(done) {
    db = pathdb(levelPromise(db));
    db.pathdb.put(['my', 'people'], o)
      .then(function () {
        return db.get(['my', 'people', 'cars', 1, 'make']);
      })
      .then(function (data) {
        expect(data).to.equal('Toyota');
        done();
      })
      .catch(done);
  });

  it('should be able to retrieve an object from the database', function(done) {
    db = pathdb(levelPromise(db));
    db.pathdb.put(o)
      .then(function () {
        return db.pathdb.get();
      })
      .then(function (data) {
        expect(data).to.eql(o);
        done();
      })
      .catch(done);
  });

  it('should be able to query sub trees', function(done) {
    db = pathdb(levelPromise(db));
    db.pathdb.put(o)
      .then(function () {
        return db.pathdb.get(['cars']);
      })
      .then(function (data) {
        expect(data).to.eql([
          { make: 'Toyota', model: 'Camry' },
          { make: 'Toyota', model: 'Corolla' },
        ]);
        done();
      })
      .catch(done);
  });

  it('should be able to delete objects', function(done) {
    db = pathdb(levelPromise(db));
    db.pathdb.put(['people'], o)
      .then(function () {
        return db.pathdb.del(['people']);
      })
      .then(function () {
        return db.pathdb.get(['people']);
      })
      .catch(function (err) {
        expect(err.name).to.equal('NotFoundError');
        done();
      });
  });

  it('should be able to watch a path for changes', function(done) {
    db = pathdb(levelPromise(db));
    db.pathdb.put(['people'], { old: 'data' })
      .then(function () {
        var obj;
        db.pathdb.watch(['people'])
          .on('value', function (value) {
            expect(value).to.eql({ old: 'data' });
            obj = value;
            process.nextTick(put);
          })
          .on('change', function (changeset) {
            obj = diff.apply(changeset, obj, true);
            expect(obj).to.eql(o);
            done();
          })
          .once('error', done);
        })
      .catch(done);

      function put(err) {
        db.pathdb.put(['people'], o);
      }
  });

  it('should be able to watch a subpath for changes', function(done) {
    db = pathdb(levelPromise(db));
    db.pathdb.put(['people'], { old: 'data' })
      .then(function () {
        var obj;
        db.pathdb.watch(['people', 'cars'], [])
          .on('value', function (value) {
            expect(value).to.eql([]);
            obj = value;
            process.nextTick(put);
          })
          .on('change', function (changeset) {
            obj = diff.apply(changeset, obj, true);
            expect(obj).to.eql(o.cars);
            done();
          })
          .once('error', done);
        })
      .catch(done);

      function put(err) {
        db.pathdb.put(['people'], o);
      }
  });

  it('should be able to apply batch updates to a path', function(done) {
    db = pathdb(levelPromise(db));
    db.pathdb.put(['people'], { old: 'data', smelly: 'socks' })
      .then(function () {
        return db.pathdb.batch(['people'], [
          { type: 'del', key: ['smelly'] },
          { type: 'put', key: ['my', 'new'], value: 'data' },
          { type: 'put', key: ['my', 'extra'], value: 'data' }
        ]);
      })
      .then(function () {
        return db.pathdb.get(['people']);
      })
      .then(function (data) {
        expect(data).to.eql({ my: { extra: 'data', new: 'data' }, old: 'data' });
        done();
      })
      .catch(done);
  });
});
