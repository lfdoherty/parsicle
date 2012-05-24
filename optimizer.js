"use strict";

var _ = require('underscorem')

function copyJson(json){return JSON.parse(JSON.stringify(json));}

function stub(){}
function todoStub(){}

function optimize(f, parser, makeProcessor,skipSpecializers){
	_.assertFunction(makeProcessor);

	/*_.assert(!skipSpecializers)
	
	if(!skipSpecializers){
		
	}*/
	f.specialize = function(json){
		return f;
	}
	
	f.optimize = function(json, parsers,ids,processors){
		//TODO
	}
	return;
	
	if(parser.type === 'object' && parser.children.length > 0){
		var first = parser.children[0];
		if((first.type === 'key') && (first.children[0].type === 'int' || first.children[0].type === 'string')){

			var valueCounts = {};
			var values = [];
			var manySamples = 0;
			f.optimize = function(json, parsers,ids,processors){
				_.assertLength(arguments, 4);
				
				var kv = json[first.key];
				var pc = valueCounts[kv];
				++manySamples;
				if(pc === undefined){
					valueCounts[kv] = 0;
					values.push(kv);
				}
				++valueCounts[kv];
				if(manySamples > 50 && values.length < 10){
					var processorMap = {};
					for(var i=0;i<values.length;++i){
						var specialParser = copyJson(parser);
						var v = values[i];
						specialParser.children[0].children[0] = {type: 'constant', value: v};
						//console.log('special: ' + JSON.stringify(specialParser))
						var specialProcessor = makeProcessor(specialParser);
						_.assertDefined(specialProcessor);
						processorMap[v] = specialProcessor;
						specialProcessor.specialize = todoStub;
						specialProcessor.optimize = todoStub;

						++parsers.codeCount;
						specialParser.code = parsers.codeCount;
						specialProcessor.code = specialParser.code;
						ids[specialParser.code] = ids[parser.code];

						processors[specialParser.code] = specialProcessor;
						//console.log('id of new: ' + parser.id);
						//console.log('new code: ' + specialParser.code);
					}
					var keyValue = first.key;
					if(!skipSpecializers){
						f.specialize = function(json){
							//console.log('specialize: ' + new Error().stack)
							var kv = json[keyValue];
							//if(kv === undefined) return;
							var w = processorMap[kv];
							if(w === undefined) return f;
							return w;
						}
					}
					f.optimize = stub;
					console.log('applied key-value sampling optimization to key ' + first.key + ', values: ' + JSON.stringify(values))
				}
			}
		}
	}
}

exports.optimize = optimize;

