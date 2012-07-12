//"use strict";

var _ = require('underscorem');

function stub(){}

var EitherFilters = {
	string: _.isString,
	int: _.isInt,
	long: _.isLong,
	array: _.isArray,
	real: function(json){return _.isNumber(json) && !_.isInt(json);},
	object: function(json){
				return !_.isArray(json) && !_.isString(json) && _.isObject(json);
			},
	boolean: function(json){
		return json === true || json === false;
	}
}

function makeWriterMaker(w, getWriter, getWrappedWriter){
	_.assertDefined(w);
	
	function stringWriter(json){
		if(json.constructor !== String){
			throw new Error('not a string: ' + json);
		}
		w.putString(json);
	}
	function realWriter(json){
		if(typeof(json) !== 'number') throw new Error('not a number');		
		w.putString(''+json);
	}
	function binaryWriter(json){
		if(!Buffer.isBuffer(json)) _.errout('not a buffer: ' + typeof(json) + ' ' + JSON.stringify(json).slice(0, 100));
		w.putVarData(json);
	}
	function intWriter(json){
		if(typeof(json) !== 'number') throw new Error('not a number');
		w.putInt(json);	
	}
	function longWriter(json){
		if(typeof(json) !== 'number') throw new Error('not a number');
		w.putLong(json);	
	}
	function booleanWriter(json){
		w.putBoolean(json);
	}
	function byteWriter(json){
		w.putByte(json);
	}
	
	return function makeWriter(ast, index){
		//_.assertLength(arguments, 2);
		
		if(ast.length <= index){
			//console.log('at end: ' + new Error().stack)
			return stub;
		}

		
		var part = ast[index];
		if(part.type === 'key'){
			
			var cf = makeWriter(part.children,0);
			var f = makeWriter(ast, index+1);
			//console.log('next(' + part.key + ')(' + index + '): ' + JSON.stringify(ast[index+1]));
			var keyValue = part.key;
			return function key(json){
				var p = json[keyValue];
				if(p === undefined) throw new Error('json missing property "' + part.key + '": ' + JSON.stringify(json).slice(0,300));
				//console.log('key: ' + keyValue);
				//console.log('value: ' + JSON.stringify(p).slice(0,100))
				try{
					cf(p);
				}catch(e){
					console.log(e.stack)
					throw new Error('error while writing object key: ' + part.key);
				}
				f(json);
			};
			
		}else if(part.type === 'optionalKey'){
			var cf = makeWriter(part.children,0);

			var f = makeWriter(ast, index+1);
			return function optionalKey(json){
				var p = json[part.key];
				//console.log('ast: ' + JSON.stringify(ast))
				//console.log('maybe key: ' + part.key)
				//console.log('value: ' + JSON.stringify(p))
				if(p !== undefined){
					w.putBoolean(true);
					cf(p);
				}else{
					w.putBoolean(false);
				}
				f(json);
			};
		}else if(part.type === 'int'){
			return intWriter;
		}else if(part.type === 'boolean'){
			return booleanWriter;
		}else if(part.type === 'byte'){
			return byteWriter;
		}else if(part.type === 'long'){
			return longWriter;
		}else if(part.type === 'object'){
			var cf = makeWriter(part.children,0);

			var f = makeWriter(ast, index+1);
			
			return function object(json){
				cf(json);
				f(json);
			}
		}else if(part.type === 'rest'){
			var cf = makeWriter(part.children,0);

			var f = makeWriter(ast, index+1);
			
			var already = {};
			for(var i=0;i<part.omit.length;++i){
				already[part.omit[i]] = true;
			}
			return function rest(json){
				var keys = Object.keys(json);
				w.startCount();

				for(var i=0;i<keys.length;++i){
					var key = keys[i];
					if(already[key] === undefined){
						w.putString(key);
						w.countUp();
						var value = json[key];
						cf(value);
					}
				}
				w.endCount();
				f(json);
			}
		}else if(part.type === 'loop'){

			var cf = makeWriter(part.children,0);
			var f = makeWriter(ast, index+1);			
			function loop(json){
				var len = json.length;
				if(len < 255){
					w.putByte(len);
				}else{
					w.putByte(255);
					w.putInt(len-255);
				}
				for(var i=0;i<len;++i){
					cf(json[i]);
				}
				f(json);
			}
			return loop;
		}else if(part.type === 'array'){
			var f = makeWriter(ast, index+1);			

			var elementWriters = [];
			for(var i=0;i<part.children.length;++i){
				elementWriters[i] = makeWriter([part.children[i]], 0);
			}
			//console.log('array(' + elementWriters.length + '): ' + JSON.stringify(part))
			_.assert(part.children.length >= 1);
			var last = elementWriters[elementWriters.length-1];
			if(part.children[part.children.length-1].type === 'loop'){
				var lastIndex = elementWriters.length-1;
				function loopedArray(json){
					//_.assertArray(json);
					//console.log('rs: ' + toString.call(json));
					if(!_.isArray(json)) throw new Error('not an array: ' + JSON.stringify(json));
					
					for(var i=0;i<lastIndex;++i){
						var ew = elementWriters[i];
						ew(json[i]);
					}
					last(json.slice(lastIndex));
				}
				return loopedArray;	
			}else{
				var requiredLength = elementWriters.length;
				function simpleArray(json){
					if(!_.isArray(json)) throw new Error('value for ' + JSON.stringify(part) + ' is not an array: ' + JSON.stringify(json))
					//_.assertArray(json);
					if(json.length !== requiredLength){
						console.log('array(' + elementWriters.length + '): ' + JSON.stringify(part))
						_.errout('array length must be ' + requiredLength);
					}
					for(var i=0;i<requiredLength;++i){
						var ew = elementWriters[i];
						ew(json[i]);
					}
				}
				return simpleArray;
			}
		}else if(part.type === 'string'){
			return stringWriter;
		}else if(part.type === 'real'){
			return realWriter;
		}else if(part.type === 'binary'){
			return binaryWriter;
		}else if(part.type === 'include'){
			var include;
			function includeFunction(json){
				include(json);
			}
			getWriter(part.name, function(f){
				if(f === undefined) _.errout('include has unknown type: ' + part.name);
				_.assertFunction(f);
				include = f;
			});
			return includeFunction;
		}else if(part.type === 'wrapped'){
			//_.errout('TODO')
			return getWrappedWriter(part.name, part.count);
		}else if(part.type === 'either'){
		
			var writersByType = {};
			
			var types = [];
			var checkers = [];
			var writers = [];
			for(var i=0;i<part.children.length;++i){
				var p = part.children[i];
				var type = p.type;
				if(type === 'include'){
					type = p.name//'object';//TODO correct this
					//console.log('include type is object: ' + JSON.stringify(p))
				}
				//_.assertString(type)
				types.push(type);
				writersByType[type] = makeWriter([p], 0);
			}
			types.sort();
			for(var i=0;i<types.length;++i){
				var type = types[i];
				writers[i] = writersByType[type];
				var fff = EitherFilters[type];
				if(fff === undefined){
					//_.errout('no either filter for type: ' + type);
					fff = EitherFilters.object
				}
				_.assertFunction(fff);
				checkers[i] = fff
			}
			
			function either(json){
				for(var i=0;i<checkers.length;++i){
					var checker = checkers[i];
					if(checker(json)){
						//console.log('either found: ' + JSON.stringify(json) + ' ' + JSON.stringify(types) + ' ' + i);
						//if(types.length === 2 && types[1] === 'int' && types[0] === 'object' && i === 0){
						//	_.errout('invalid choice: ' + JSON.stringify(json))
						//}
						//w.putByte(i);
						//console.log('wrote either type: ' + types[i] + ' ' + ' for ' + JSON.stringify(json))
						//console.log(checker)
						//console.log(JSON.stringify(part))
						//console.log(JSON.stringify(types))
						//console.log(new Error().stack)
						var type = types[i]
						//w.putString(type+'')
						if(checker !== EitherFilters.object){
							w.putString(type)
						}
						writersByType[type](json);
						return;
					}
				}
				_.errout('invalid value: ' + JSON.stringify(json).slice(0,100) + ' matches none of the types: ' + JSON.stringify(types));
			}
			
			return either;
		}else if(part.type === 'constant'){
			return function(){
				//console.log('"wrote" constant: ' + part.value)
			}
		}else{
			throw new Error('TODO: ' + JSON.stringify(part))
		}
	}
}

function makeMaker(w, getWriter, getWrappedWriter){
	var makeWriter = makeWriterMaker(w, getWriter, getWrappedWriter);
	return function(parser){
		return makeWriter([parser],0);
	}
}

exports.makeMaker = makeMaker
