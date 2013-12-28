# pathdb

Database built on levelup/leveldb that stores javascript objects as a series of paths and values.

[![build status](https://secure.travis-ci.org/eugeneware/pathdb.png)](http://travis-ci.org/eugeneware/pathdb)

## Installation

This module is installed via npm:

``` bash
$ npm install pathdb
```

## Background

In a typical key-value store such as leveldb, the entire 'object' is stored at
a given key in the database. This is useful, but makes atomic updates to fields
in an object more difficult, and prone to conflicts.

If the child fields in an object stored at a single key need to undergo a lot
of updates from multiple clients, this creates a lot of read/lock/write
operations.

In short, the finer grained the storage of fields is in the database, the lower
the amount of contention and conflicts there will be.

PathDb was built from the ground up to support fine-grained storage of object
properties, and to be able to replicate those changes in **real-time** to
multiple clients, in the same way as say [firebase](https://www.firebase.com),
with real-time data bindings to client-side objects in
[angularjs](http://www.angularjs.org).

### Object paths vs Documents

Pathdb achieves this by taking an object such as:

``` js
// object to slice up
var o = {
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
```

and slicing it into multiple key, value pairs, where the key represents the
"path" to the value, and the value is the "leaf" value. So the object above
becomes:

``` js
var paths =
  [ { key: [ 'name' ], value: 'Eugene' },
    { key: [ 'number' ], value: 42 },
    { key: [ 'tags', '0' ], value: 'tag1' },
    { key: [ 'tags', '1' ], value: 'tag2' },
    { key: [ 'tags', '2' ], value: 'tag3' },
    { key: [ 'cars', '0', 'make' ], value: 'Toyota' },
    { key: [ 'cars', '0', 'model' ], value: 'Camry' },
    { key: [ 'cars', '1', 'make' ], value: 'Toyota' },
    { key: [ 'cars', '1', 'model' ], value: 'Corolla' } ];
```

It does this using the [pathos](https://github.com/eugeneware/pathos) library.

Then, each of these individual slices are stored as individual key-value pairs
in a [levelup](https://github.com/rvagg/node-levelup) database.

Due to the magic of [bytewise](https://github.com/deanlandolt/bytewise)
levelup custom encodings, all the slices that make up an object will sort
next to each other in the leveldb database, making quick retrieval of objects
and object trees using
[db.createReadStream](https://github.com/rvagg/node-levelup#createReadStream).

### The database as a single javascript object

By storing our objects using this path/value system, we can in a sense treat
the entire database as as single javascript JSON object.

We can grab the entire object by fetching the whole database from the root:

``` js
db.pathdb.get([], function (err, obj) {
  // obj contains the whole database as an object
});
```

Or, more practically, we can fetch a subtree of the database:

``` js
db.pathdb.get(['my', 'path'], function (err, obj) {
  // obj contains the whole database as an object
});
```

## Example Usage

### Store and retrieve object

``` js
var pathdb = require('pathdb'),
    level = require('level'),
    bytewise = require('bytewise');

// db will be a levelup instance that has a 'pathdb' property with additional
// pathdb methods.

var db = pathdb(level('/my/db',
  { keyEncoding: bytewise, valueEncoding 'json'}));

// object to store
var person = {
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

// store the object under the 'people' property
db.pathdb.put(['people'], o, cb);

// retrieve the stored object
db.pathdb.get(['people'], cb);

// fetch one of the child properties (will return 'Toyota')
db.get(['people', 'cars', '1', 'make'], cb);

// delete the object
db.pathdb.del(['people'], cb);
```

## API

### Requirements

Currently the pathdb database must be built on a [typewise](https://github.com/deanlandolt/typewise)
compliant levelup custom encoding such as [bytewise](https://github.com/deanlandolt/bytewise).

### pathdb(db)

Adds the pathdb property to an existing levelup instance.

``` js
var pathdb = require('pathdb'),
    bytewise = require('bytewise'),
    level = require('level');

// keyEncoding needs to be bytewise, valueEncoding needs to return a JS object
var db = level('/my/db', { keyEncoding: bytewise, valueEncoding: json });
// add pathdb functions to levelup
db = pathdb(db);
```

### db.pathdb.put([path,] value, callback)

Will store the JSON object ```value``` at the location ```path``` in the pathdb
object tree.

If the path is ommitted, then the object is stored at the root document level
(ie. the entire database will be replaced by the contents of ```value```).

``` js
db.pathdb.put(['my', 'path'], { name: 'Bob', number: 42 }, function (err) {
  // I/O or other error, pass it up the callback chain
  if (err) return callback(err);
});
```

### db.pathdb.get([path, ], callback)

Will retrieve the JSON object subtree located at ```path```. If the ```path```
is ommitted, then the entire database from the root will be retrieved.

``` js
db.pathdb.get(['my', 'path'], function (err, data) {
  if (err.name === 'NotFoundError') {
    // nothing found at the path
    return;
  }

  // I/O or other error, pass it up the callback chain
  if (err) return callback(err);
});
```

### db.pathdb.del([path, ], callback)

Will delete the subtree located at ```path```. If the ```path``` is ommitted,
then the entire database will be deleted.

``` js
db.pathdb.del(['my', 'path'], function (err) {
  // I/O or other error, pass it up the callback chain
  if return callback(err);
});
```

### db.pathdb.batch(path, array, callback)

Helper function to take a set of levelup batch commands with paths as keys,
and store it at the appropriate ```path```. This effectively prepends the
```path``` to the ```key``` attribute of each batch entry.

``` js
// this batch defines the creation of a new object:
//   { name: 'Eugene', number: 42 }

var batch = [
  [ { type: 'put', key: [ 'name' ], value: 'Eugene' },
    { type: 'put', key: [ 'number' ], value: 42 } ];

// store the object at the path [ 'my', 'path' ]
db.pathdb.batch(['my', 'path'], batch, function (err) {
  // I/O or other error, pass it up the callback chain
  if (err) return callback(err);
});

// The new object will effectively look like:
//   { my: { path: { name: 'Eugene', number: 42 } } }
```

### db.pathdb.watch(path, default)

This function watches the object graph for subtree changes for anything at
```path``` or lower.

The function returns an ```EventEmitter``` which emits the following events:

* ```value``` - This gets emitted only once, and contains the initial value
  of the subtree at ```path```. If there is nothing there, then the object
  defined by the second ```default``` parameter will be returned.
* ```change``` - This returns a
  [changeset](https://github.com/eugeneware/changeset) representing the
  changes made to the object defined by the ```path``` subtree.

This function is extremely useful for creating replication. Take a look at
the [replication unit tests](https://github.com/eugeneware/pathdb/blob/master/test/replication.js)
for examples of using this method for replication in conjunction with the
[changeset](https://github.com/eugeneware/changeset) and
[observejs](https://github.com/eugeneware/observejs) modules.

## License

### Copyright (c) 2013, Eugene Ware
#### All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright
   notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in the
   documentation and/or other materials provided with the distribution.
3. Neither the name of Eugene Ware nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY EUGENE WARE ''AS IS'' AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL EUGENE WARE BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
