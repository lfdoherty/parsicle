
var rs = require('./rs');

var bufw = require('./bufw').W;
var binaryWriter = require('./binarywriter');
var binaryReader = require('./binaryreader');

var _ = require('underscorem');

var optimizer = require('./optimizer');

exports.add = function(wrapped, state, handle){

	function makeBinaryStreamReader(reader){
	
		var ss = rs.make();
		var s = ss.s;

		var selector = makeBinaryStreamReaderInternal(reader, s).selector;

		var totalBytes = 0;		
		
		input.manyRead = 0;
		input.manyBytesRead = 0;
		function input(buf){

			ss.put(buf);
			
			while(true){
				var worked = selector();
				if(worked === undefined){
					//if(ccc !== console.log) console.log('failed: ' + worked)
					s.revert();
					break;
				}else{
					//if(ccc !== console.log) console.log('worked')
					++input.manyRead;
					input.manyBytesRead += s.succeed();
				}
			}
		}
		
		input.makeWriter = function(bufferCb, endCb){
			_.assertFunction(bufferCb)
			
			return makeBinaryStreamWriter({
				write: bufferCb,
				end: endCb
			})
		}
		return input;
	}
	
	function makeBinaryStreamReaderInternal(reader, s){
		//var s = ss.s;
		
		//console.log(new Error().stack)
	
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
				return;
			}
			var idCode = s.readInt();

			var id = state.ids[idCode];
			var obj = readObject(idCode);
			if(obj !== undefined){
				if(!noReader){
					var typeReader = reader[id];
					if(typeReader === undefined){
						console.log('ids: ' + JSON.stringify(state.ids))
						console.log('got: ' + JSON.stringify(Object.keys(reader)));
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
		
		var wrappedReader = wrapped ? wrapped.binary.stream._internalMakeReader({},s) : undefined;
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

	function makeBinaryStreamWriter(bufferSize, ws){
		if(arguments.length === 1){
			ws = bufferSize;
			bufferSize = undefined;
		}		

		//_.assertFunction(ws.on)
		//_.assertFunction(ws.once)

		bufferSize = bufferSize || (10*1024*1024)
		
		_.assertInt(bufferSize)
		
		var w = new bufw(bufferSize, ws)/*{
			write: function(buf){
				bufferCb(buf);
			},
			end: function(cb){
				if(endCb){
					if(cb){
						endCb(cb);
					}else{
						endCb();
					}
				}else{
					if(cb){
						cb();
					}
				}
			}
		});*/
		
		return makeBinaryStreamWriterInternal(w);
	}
	
	function makeBinaryStreamWriterInternal(w){
		var writeParsers = JSON.parse(JSON.stringify(state.parsers));
		writeParsers.codeCount = state.ids.length;

		var wrappedWriter = wrapped ? wrapped.binary.stream._internalMakeWriter(w).internal : undefined;
		
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
				w.delay();//ensure we can rollback if there's an exception thrown during the write
				try{
					rf(json);
				}catch(e){
					w.cancel();
					console.log('error thrown while writing: ' + JSON.stringify(json).slice(0,300));
					throw e;
				}
				w.resume();
			}
		})
		
		for(var i=0;i<after.length;++i){after[i]();}
		after = undefined;
		
		h.end = function(cb){
			w.close(cb);
		}
		h.flush = function(cb){
			w.flush(cb);
		}
		h.internal = unwrapped;
		h.internal.getWrapper = function(){return wrappedWriter;}
		return h;
	}
	
	handle.binary.stream = {
		makeReader: makeBinaryStreamReader,
		makeWriter: makeBinaryStreamWriter,
		
		_internalMakeWriter: makeBinaryStreamWriterInternal,
		_internalMakeReader: makeBinaryStreamReaderInternal
	}
	
}
