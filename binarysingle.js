
var rs = require('./rs');

var bufw = require('./bufw').W;
var binaryWriter = require('./binarywriter');
var binaryReader = require('./binaryreader');

var _ = require('underscorem');

var optimizer = require('./optimizer');

exports.add = function(wrapped, state, handle){

	function makeBinarySingleReader(reader){
	

		var totalBytes = 0;		
		/*
		input.manyRead = 0;
		input.manyBytesRead = 0;
		function input(buf){

			ss.put(buf);
			
			while(true){
				var worked = selector();
				if(worked === undefined){
					if(ccc !== console.log) console.log('failed: ' + worked)
					s.revert();
					break;
				}else{
					if(ccc !== console.log) console.log('worked')
					++input.manyRead;
					input.manyBytesRead = s.succeed();
				}
			}
		}*/
		
		//input.makeWriter = function(bufferCb, endCb){
		//	return makeBinarySingleWriter(bufferCb, endCb);//TODO make writer inherit parser specializations (optimization)
		//}
		//return input;

		var ss = rs.make();
		var s = ss.s;

		var selector = makeBinarySingleReaderInternal(reader, s).selector;
		
		return function(buf){
			ss.reset()

			_.assertBuffer(buf)
			ss.put(buf);
			var result = selector(true);
			if(result === undefined){
				_.errout('single parsing error, needs more bytes: ' + ss.needs())
			}
			ss.assertEmpty()
			_.assertDefined(result)
			return result;
		}
	}
	
	function makeBinarySingleReaderInternal(reader, s){
		//var s = ss.s;
		
		//_.assert(Object.keys(reader).length > 0)
		_.assertFunction(reader)
	
		var readParsers = JSON.parse(JSON.stringify(state.parsers));
		readParsers.codeCount = state.ids.length;
		
		function readObject(idCode){
			var br = baseReaders[idCode];

			//if(ccc !== console.log) console.log('idCode: ' + idCode)

			if(br === undefined){
				_.errout('internal error, no reader for idCode: ' + idCode);
			}
			var result = br();
			if(result !== undefined){
				br.optimize(result, readParsers,state.ids,baseReaders);
			}
			return result;		
		}
		
		function selector(noReader){
			if(!s.has(4)){
				//if(ccc !== console.log) console.log('no parser int')
				//return;
				_.errout('not enough data to read type (less than 4 bytes!)')
			}
			var idCode = s.readInt();

			var id = state.ids[idCode];
			var obj = readObject(idCode);
			if(obj !== undefined){
				if(!noReader){
					var typeReader = baseReaders[id]//reader[id];
					if(typeReader === undefined){
						console.log('ids: ' + JSON.stringify(state.ids))
						console.log('got: ' + JSON.stringify(Object.keys(baseReaders)));
						_.errout('no reader defined for: ' + id);
					}
					typeReader(obj);
				}
				return obj;
			}
		}
		
		
		readObject.selector = selector;
		readObject.ids = state.ids;

		

		
		var baseReaders = {};
		
		var after = [];
		function getReader(){
			return selector;
		}
		
		var wrappedReader = wrapped ? wrapped.binary.single._internalMakeReader({},s) : undefined;
		//console.log('is wrapped: ' + !!wrapped);

		function getWrappedReader(name, count){

			var rrm = wrappedReader;
			for(var i=1;i<count;++i){
				rrm = wrappedReader.getWrapper();
			}

			return function(){
				if(!s.has(4)) return;
				var idCode = s.readInt();
				var id = rrm.ids[idCode];
				var result = rrm(idCode)
				
				if(result){
					return {type: id, object: result};
				}
			}
		}
		
		function makeReader(parser){
			var br = binaryReader.make(parser, s, getReader,getWrappedReader);
			return br;
		}
	
		state.ids.forEach(function(id, idCode){
			var parser = readParsers[id];
			var br = baseReaders[idCode] = binaryReader.make(parser, s, getReader,getWrappedReader);
			
			_.assertFunction(br);

			optimizer.optimize(br, parser,makeReader,true);
		})
		
		for(var i=0;i<after.length;++i){after[i]();}
		after = undefined;

		readObject.getWrapper = function(){return wrappedReader;}

		return readObject;
	}

	function makeBinarySingleWriter(parsers, parserCb){
		
		var outputBuf;
		var w = new bufw(1024*1024, {
			write: function(buf){
				//console.log('wrote buf: ' + buf.length)
				_.assertUndefined(outputBuf)
				outputBuf = buf;
			}
		});
		
		w.delay()
		
		w.take = function(){
			w.resume()
			w.flush()
			w.delay()
			var buf = outputBuf
			_.assertBuffer(buf)
			outputBuf = undefined
			return buf
		}
		
		return makeBinarySingleWriterInternal(w);
	}
	
	function makeBinarySingleWriterInternal(w){
		var writeParsers = JSON.parse(JSON.stringify(state.parsers));
		writeParsers.codeCount = state.ids.length;

		var wrappedWriter = wrapped ? wrapped.binary.single._internalMakeWriter(w).internal : undefined;
		
		var maker = binaryWriter.makeMaker(w, getWriter,getWrappedWriter);

		
		var after = [];

		function getWriter(name, cb){
			if(after === undefined){
				var f = unwrapped[name];
				_.assertFunction(f);
				cb(f);
				return;
			}
			after.push(function(){
				var f = unwrapped[name];
				if(f === undefined){
					console.log('got: ' + JSON.stringify(Object.keys(unwrapped)));
					_.errout('but no writer for included type: ' + name);
				}
				cb(f);
			})
		}
		
		
		function getWrappedWriter(name, count){
			_.assertInt(count);

			//console.log('count: ' + count)
			var wwm = wrappedWriter;
			for(var i=1;i<count;++i){
				wwm = wrappedWriter.getWrapper();
			}
			if(name === undefined){
				return function(json){
					var type = json.type;
					var object = json.object;
					
					if(type === undefined) _.errout('There is no type parameter in the context of the wrapped type!  The serializer needs to know its type!: ' + JSON.stringify(json));
				
					var ww = wwm[type];
					if(ww === undefined){	
						console.log('got: ' + JSON.stringify(Object.keys(wwm)));
						_.errout('but no wrapped writer for type: ' + type);
					}
					ww(object);
				}
			}else{
				var ww = wwm[name];
				if(ww === undefined){	
					console.log('got(' + count + '): ' + JSON.stringify(Object.keys(wwm)));
					_.errout('but no wrapped writer for type: ' + name);
				}
				return function(json){
					var object = json;
					ww(object);
				}
			}
		}
		
		function makeWriter(parser){
			var f = maker(parser);
			return f;
		}
		
		var h = {};

		var unwrapped = {};
		
		var dummyProcessors = {};
		
		state.ids.forEach(function(parserId){
			var parser = state.parsers[parserId];
			var localIdCode = state.idCodes[parserId];
			var jf = maker(parser)

			after.push(function(){
				optimizer.optimize(jf, parser, makeWriter);
			})

			dummyProcessors[localIdCode] = jf;
			
			var njf = jf;

			var rf = unwrapped[parserId] = function(json){
				_.assertDefined(json);
				
				var sf = jf.specialize(json);
				var code = localIdCode;
				if(sf !== jf) code = sf.code;
				_.assertInt(code)

				w.putInt(code);
				sf(json);
				sf.optimize(json, writeParsers, state.ids, dummyProcessors)
			}
			h[parserId] = function(json){
				//w.delay();//keep all the output to one buffer
				try{
					rf(json);
				}catch(e){
					w.cancel();
					console.log('error thrown while writing: ' + JSON.stringify(json).slice(0,300));
					throw e;
				}
				//w.resume();
				return w.take();
			}
		})
		
		for(var i=0;i<after.length;++i){after[i]();}
		after = undefined;
		
		h.internal = unwrapped;
		h.internal.getWrapper = function(){return wrappedWriter;}
		return h;		
	}
	
	handle.binary.single = {
		makeReader: makeBinarySingleReader,
		makeWriter: makeBinarySingleWriter,
		
		_internalMakeWriter: makeBinarySingleWriterInternal,
		_internalMakeReader: makeBinarySingleReaderInternal
	}
	_.assertFunction(handle.binary.single.makeReader)
}
