var pathos = require('pathos'),
    bytewise = require('bytewise'),
    EventEmitter = require('events').EventEmitter,
    createError   = require('errno').create
    LevelUPError  = createError('LevelUPError')
    NotFoundError = createError('NotFoundError', LevelUPError);

NotFoundError.prototype.notFound = true;
NotFoundError.prototype.status   = 404;

module.exports = pathdb;
function pathdb(db) {
  if (db && !db.pathdb) {
    db.pathdb = {
      put: put.bind(null, db),
      get: get.bind(null, db),
      del: del.bind(null, db),
      watch: watch.bind(null, db)
    };
  }
  return db;
}

function put(db, key, value, cb) {
  if (typeof cb === 'undefined') {
    cb = value;
    value = key;
    key = [];
  }

  children(db, key, function (err, data) {
    if (err) return cb(err);
    var batch = data.map(function (k) {
      return {
        type: 'del',
        key: k,
      };
    });
    var paths = pathos(value);
    paths.forEach(function (e) {
      batch.push({
        type: 'put',
        key: key.concat(e.key),
        value: e.value
      });
    });
    db.batch(batch, { keyEncoding: bytewise, valueEncoding: 'json' }, cb);
  });
}

function get(db, key, cb) {
  if (typeof cb === 'undefined') {
    cb = key;
    key = [];
  }

  var result = []
  db.createReadStream({
      keyEncoding: bytewise, valueEncoding: 'json',
      start: key.concat(null), end: key.concat(undefined)
    })
    .on('data', function (data) {
      result.push(data);
    })
    .on('error', function (err) {
      cb(err);
    })
    .on('end', function () {
      if (result.length) {
        var leaves = result.map(function (item) {
          item.key = item.key.slice(key.length);
          return item;
        });
        var obj = pathos.build(leaves);
        cb(null, obj);
      } else {
        cb(new NotFoundError('Path not found in database ' + JSON.stringify(key)));
      }
    });
}

function del(db, key, cb) {
  if (typeof cb === 'undefined') {
    cb = key;
    key = [];
  }

  children(db, key, function (err, data) {
    if (err) return cb(err);
    var batch = data.map(function (k) {
      return {
        type: 'del',
        key: k
      };
    });
    db.batch(batch, cb);
  });
}

function children(db, key, cb) {
  if (typeof cb === 'undefined') {
    cb = key;
    key = [];
  }

  var batch = []
  db.createReadStream({
      keyEncoding: bytewise,
      keys: true,
      values: false,
      start: key.concat(null), end: key.concat(undefined)
    })
    .on('data', function (key) {
      batch.push(key);
    })
    .on('error', function (err) {
      cb(err);
    })
    .on('end', function () {
      cb(null, batch);
    });
}

function watch(db, key) {
  var ee = new EventEmitter();
  db.pathdb.get(key, function (err, value) {
    ee.emit('value', value);
    db.on('batch', function (batch) {
      var relevant = batch.filter(function (item) {
        return startsWith(item.key, key);
      })
      .map(function (item) {
        item.key = item.key.slice(key.length);
        return item;
      });
      ee.emit('change', relevant);
    });
  });

  return ee;
}

function startsWith(haystack, prefix) {
  var i = 0;
  while (i < haystack.length && i < prefix.length) {
    if (prefix[i] !== haystack[i]) return false;
    i++;
  }
  return (i === prefix.length)
}
