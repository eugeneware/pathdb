var pathos = require('pathos'),
    bytewise = require('bytewise'),
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
      del: del.bind(null, db)
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

  var paths = pathos(value);
  var batch = paths.map(function (e) {
    return {
      type: 'put',
      key: key.concat(e.key),
      value: e.value
    };
  });
  db.batch(batch, { keyEncoding: bytewise, valueEncoding: 'json' }, cb);
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
        var obj = pathos.build(result);
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

  var batch = []
  db.createReadStream({
      keyEncoding: bytewise,
      keys: true,
      values: false,
      start: key.concat(null), end: key.concat(undefined)
    })
    .on('data', function (key) {
      batch.push({ type: 'del', key: key });
    })
    .on('error', function (err) {
      cb(err);
    })
    .on('end', function () {
      db.batch(batch, cb);
    });
}
