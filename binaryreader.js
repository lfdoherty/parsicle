var _ = require('underscorem');

function isPrimitive(pt){
	return pt === 'int' || pt === 'string' || pt === 'constant' || pt === 'boolean' || pt === 'byte' || pt === 'long' || pt === 'binary';
}
//var ccc = console.log
function makePrimitiveReader(type, s,part){
	if(type === 'int'){
		return function(){
			if(!s.has(4)){
				//if(console.log !== ccc){
				//	console.log('no has int')
				//}
				return;
			}
			var i = s.readInt();
			//if(console.log !== ccc){
				//console.log('read int: ' + i)
			//}
			return i;
		}
	}else if(type === 'string'){
		return function(){
			var len = s.readLength();
			if(len === undefined) return;
			if(!s.has(len)) return;
			return s.readString(len);
		}
	}else if(type === 'constant'){
		return function(){
			//console.log('"read" constant: ' + part.value)
			return part.value;
		}
	}else if(type === 'boolean'){
		return function(){
			if(!s.has(1)) return;
			return s.readBoolean();
		}
	}else if(type === 'byte'){
		return function(){
			if(!s.has(1)) return;
			return s.readByte();
		}
	}else if(type === 'long'){
		return function(){
			if(!s.has(8)) return;
			return s.readLong();
		}
	}else if(type === 'binary'){
		return function(){
			var len = s.readLength();
			if(len === undefined) return;
			if(!s.has(len)) return;
			return s.readData(len);
		}
	}else{
		throw new Error('TODO: ' + type);
	}
}

function makeKeyFunction(f,keyValue,next){
	return function key(json){
		//console.log('in key function(' + keyValue + ')');
		var res = f(true);
		if(res === undefined) return;
		json[keyValue] = res;
		return next(json)
	}
}
function makeOptionalKeyFunction(f,keyValue,next,s){
	return function optionalKey(json){
		if(!s.has(1)) return;
		var hasKey = s.readBoolean();

		if(hasKey){
			var v = f(true);
			if(v === undefined) return;
			json[keyValue] = v;
		}
		return next(json);
	}
}
function makeObjectPartReader(ast, index, s, getReader,getWrappedReader){
	if(ast.length <= index) return trueFunc;

	var next = makeObjectPartReader(ast, index+1, s, getReader,getWrappedReader);
	_.assertFunction(next);
	
	var part = ast[index];
	if(part.type === 'key'){

		var pt = part.children[0].type;

		if(isPrimitive(pt)){
			var rf = makePrimitiveReader(part.children[0].type, s,part.children[0]);
			return makeKeyFunction(rf,part.key,next)
		}else{
			var sr = makeSpecificReader(part.children[0], s, getReader,getWrappedReader);
			return makeKeyFunction(sr,part.key,next)
		}
	}else if(part.type === 'optionalKey'){

		var pt = part.children[0].type;

		if(isPrimitive(pt)){
			var rf = makePrimitiveReader(part.children[0].type, s,part.children[0]);
			return makeOptionalKeyFunction(rf,part.key,next,s)
		}else{

			var sr = makeSpecificReader(part.children[0], s, getReader,getWrappedReader);
			return makeOptionalKeyFunction(sr,part.key,next,s)
		}
	}else if(part.type === 'rest'){

		var restFunc;

		var rf;
		var pt = part.children[0].type;

		var readKey = makePrimitiveReader('string', s);
		_.assertFunction(readKey)
		if(isPrimitive(pt)){
			rf = makePrimitiveReader(part.children[0].type, s,part.children[0]);
		}else{
			rf = makeSpecificReader(part.children[0], s, getReader,getWrappedReader);
		}
		_.assertFunction(rf);
		restFunc = function restFunc(json){

			if(!s.has(4)) return;
			var count = s.readInt();

			for(var i=0;i<count;++i){
				var key = readKey();

				if(key === undefined) return;
				var v = rf();
				if(v === undefined) return;
				json[key] = v;
			}			
			
			return next(json)
		}
		/*}else if(pt === 'wrapped'){
			
		}else{
			throw new Error('TODO: ' + JSON.stringify(part.children[0]));
		}*/

		return restFunc;
		
	}else if(part.type === 'loop'){
		throw new Error('TODO: ' + JSON.stringify(part));
	}else{
		throw new Error('TODO: ' + JSON.stringify(part));
	}
}

function trueFunc(){return true;}

function makeArrayPartReader(ast, index, s, getReader,getWrappedReader){
	_.assertFunction(getWrappedReader);
	if(ast.length <= index) return trueFunc;

	var next = makeArrayPartReader(ast, index+1, s, getReader,getWrappedReader);
	_.assertFunction(next);
	
	var part = ast[index];
	if(isPrimitive(part.type)){
		var pr = makePrimitiveReader(part.type, s,part);

		function f(arr){
			var v = pr();
			if(v === undefined) return;

			arr.push(v);
			return next(arr);
		}
		return f;
	}else if(part.type === 'wrapped' || part.type === 'either'){
		var pr = makeSpecificReader(part, s, getReader, getWrappedReader);
		return function(arr){
			var v = pr();
			if(v === undefined) return;
			arr.push(v);
			return next(arr);
		}
	}else if(part.type === 'loop'){

		var elem;
		
		if(isPrimitive(part.children[0].type)){
			var pt = part.children[0].type;
			var primitiveReader = makePrimitiveReader(pt, s,part.children[0]);

			elem = function primitiveElem(json){
				var count = s.readLength();
				if(count === undefined) return;
				for(var i=0;i<count;++i){
					var v = primitiveReader()
					if(v === undefined) return;
					json.push(v);	
				}
				return next(json)
			}

		}else{
			var pr = makeSpecificReader(part.children[0], s, getReader,getWrappedReader);
			
			elem = function elem(json){
				var count = s.readLength();
				if(count === undefined) return;
				for(var i=0;i<count;++i){
					//console.log('reading(' + i + '/' + count + ') ' + part.type)
					var result = pr(true);
					if(result === undefined){
						//console.log('undefined result, returning')
						return;
					}
					json.push(result);
				}
				//console.log('done loop')
				return next(json)
			}
		}


		return elem;
	}else{
		throw new Error('TODO: ' + JSON.stringify(part));
	}
}
function getReaderName(part){
	if(part.type === 'include') return part.name;
	if(part.type === 'array') return 'each'
	if(part.type === 'loop') return getReaderName(part.children[0]);
	
	return part.type;
}
function makeSpecificReader(part, s, getReader,getWrappedReader){
	_.assertFunction(getReader);
	_.assertFunction(getWrappedReader)
	if(part.type === 'array'){
		return makeArrayReader(part.children, s, getReader,getWrappedReader);
	}else if(part.type === 'object'){
		return makeObjectReader(part.children, s, getReader,getWrappedReader);
	}else if(part.type === 'include'){
		return makeIncludeReader(part.name, s, getReader);
	}else if(part.type === 'wrapped'){
		return makeWrappedReader(part.name, part.count, s, getReader,getWrappedReader);
	}else if(part.type === 'encoded'){
		return makeEncodedReader(part.name, s, getReader,getWrappedReader);
	}else if(part.type === 'either'){
		return makeEitherReader(part.children, s, getReader,getWrappedReader);
	}else if(isPrimitive(part.type)){
		var rf = makePrimitiveReader(part.type, s);
		_.assertFunction(rf);

		function primitiveReaderWrapper(){
			var v = rf();
			return v;
		}
		return primitiveReaderWrapper
	}else{
		throw new Error('TODO: ' + JSON.stringify(part));
	}
}
function makeIncludeReader(name, s, getReader){
	return getReader();
}
function makeWrappedReader(name, count, s, getReader,getWrappedReader){
	if(getWrappedReader === undefined) throw new Error('wrapped entry appears in this schema, but there is no wrapping parsicle context?');
	_.assertFunction(getWrappedReader)
	return getWrappedReader(name, count);
}

function makeEncodedReader(name, s, getReader,getWrappedReader){
	return function(){
		var len = s.readLength();
		if(len === undefined) return;
		if(!s.has(len)) return;
		var buf = s.readData(len);
		return buf;
	}
}
function makeEitherReader(ast, s, getReader,getWrappedReader){
	
	var options = [];
	var readersByType = {};
	for(var i=0;i<ast.length;++i){
		var a = ast[i];
		var type = getReaderName(a)
		if(a.type === 'include'){
			type = 'object';//TODO correct this
		}
		options.push(type);

		readersByType[type] = makeSpecificReader(a, s, getReader,getWrappedReader)
	}
	//console.log('either after: ' + after)
	options.sort();
	var readers = [];
	for(var i=0;i<options.length;++i){
		var type = options[i];
		readers[i] = readersByType[type];
	}
	function f(){
		if(!s.has(1)) return;
		var b = s.readByte();
		//console.log('code: ' + b + ' ' + JSON.stringify(options))
		var r = readers[b];
		return r();
	}
	return f;
}

function makeArrayReader(ast, s, getReader,getWrappedReader){
	
	var nextStep = makeArrayPartReader(ast, 0, s, getReader,getWrappedReader);
	_.assertFunction(nextStep)

	function readArray(json){
		var arr = [];
		var worked = nextStep(arr);
		if(worked !== undefined) return arr;
		return;
	}

	return readArray;
}
function makeObjectReader(ast, s, getReader,getWrappedReader){


	var nextStep = makeObjectPartReader(ast, 0, s, getReader,getWrappedReader);
	_.assertFunction(nextStep)
	
	function readObject(){
		//console.log('reading object: ' + JSON.stringify(ast))
		var obj = {};
		var worked = nextStep(obj);
		if(worked === undefined) return;
		return obj;
	}
	return readObject;
}

function makeParserReader(parser, s, getReader,getWrappedReader){
	if(arguments.length !== 4) throw new Error('programmer error');
	
	if(isPrimitive(parser.type)){
		return makePrimitiveReader(parser.type, s,parser);
	}else if(parser.type === 'object'){
		return makeObjectReader(parser.children, s, getReader,getWrappedReader);
	}else if(parser.type === 'array'){
		return makeArrayReader(parser.children, s, getReader,getWrappedReader);
	}else{
		throw new Error('TODO: ' + JSON.stringify(parser));
	}
}
exports.make = makeParserReader
