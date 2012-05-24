"use strict";

//var bufw = require('./bufw').W;

var parserAst = require('./parserast');

//var rs = require('./rs');

var _ = require('underscorem');


//var optimizer = require('./optimizer');

var binarystream = require('./binarystream')
var binarysingle = require('./binarysingle')

function make(wrapped, cb){
	if(arguments.length === 1){
		cb = wrapped;
		wrapped = undefined;
	}else{
		_.assertLength(arguments, 2);
	}
	_.assertFunction(cb);
	
	var state = {
		ids: [],
		parsers: {},
		idCodes: {}
	}
	
	var handle = {
		binary: {},
		ascii: {}
	}

	cb(function(id, type, cb){
		if(state.parsers[id] !== undefined){
			throw new Error('parser id already taken: ' + id);
		}

		state.ids.push(id);
		
		var p = parserAst.make(type)
		cb(p);
		
		state.parsers[id] = p;
		p.id = id;
	})
	
	
	state.ids.sort();
	Object.freeze(state.ids)
	for(var i=0;i<state.ids.length;++i){
		state.idCodes[state.ids[i]] = i;
		state.parsers[state.ids[i]].code = i;
		//console.log(require('util').inspect(state.parsers[state.ids[i]], null, 9))
	}

	
	binarystream.add(wrapped, state, handle)
	binarysingle.add(wrapped, state, handle)
	
	return handle;
}

exports.make = make;
