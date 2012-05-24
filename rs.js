var _ = require('underscorem');
var bin = require('./bin');

var ccc = console.log

function makeReadState(){
	var bufs = [];

	var realGot = 0;
	var got =  0;
	var cur,off,realOff;

	var ranOut;
	var needs;
	
	var s = {
		out: function(){
			return ranOut;
		},
		readInt: function(){
			mergeIfNecessary(4);
			//_.assert(cur.length >= off+4);
			var v = bin.readInt(cur, off);
			//console.log('read int: ' + v)
			off+=4;
			got-=4;
			return v;
		},
		readString: function(len){
			mergeIfNecessary(len);
			var v = cur.toString('utf8', off, off+len);
			off += len;
			got -= len;
			return v;
		},
		readData: function(len){
			mergeIfNecessary(len);
			var v = cur.slice(off, off+len)//toString('utf8', off, off+len);
			off += len;
			got -= len;
			return v;
		},
		readByte: function(){
			mergeIfNecessary(1);
			var v = cur[off];
			off += 1;
			got -= 1;
			return v;
		},
		has: function(many){
			//if(got < many){
				//if(ccc !== console.log) 
			//	console.log('need ' + many + ', got ' + got);
			//}
			var h = got >= many;
			if(!h){
				needs = many - got
				ranOut = true;
				//throw new Error();
				//console.log('ran out (' + many + ') at ' + new Error().stack);
			}
			return h;
		},
		readLong: function(){
			mergeIfNecessary(8);
			var v = bin.readLong(cur, off);
			off+=8;
			got-=8;
			return v;
		},
		readBoolean: function(){
			mergeIfNecessary(1);
			var b = cur[off];

			//console.log(off);
			//console.log('b: ' + b);
			//console.log(cur);

			++off;
			--got;
			_.assert(b === 0 || b === 1);
			return b === 1;
		},
		readLength: function(){
			if(!s.has(1)) return;
			var count = s.readByte();
			if(count === 255){
				if(!s.has(4)) return;
				count += s.readInt();
			}
			return count;
		},
		
		revert: function(){
			off = realOff;
			got = realGot;
		},
		succeed: function(){
			var more = off - realOff;
			realOff = off;
			realGot = got;
			return more;
		},
		quick: function(){
			var str = '';
			var m = 0;
			for(var i=off;i<cur.length;++i){
				if(m > 100) break;
				str += cur[i]+',';
				++m;
			}
			console.log('quick: ' + str);
		}
	}

	function mergeIfNecessary(len){
		while(cur.length - off < len){
			//console.log('merging to get ' + len + ' ' + cur.length + ' ' + off + ' ' + realOff)
			//console.log(new Error().stack)
			merge();
		}
	}

	function merge(){
		//_.errout('TODO');
		_.assert(bufs.length > 1);

		//console.log('off: ' + off + ' realOff: ' + realOff);
		
		var next = bufs[1];
		var n = new Buffer(next.length+(cur.length-realOff));
		cur.copy(n, 0, realOff);
		//console.log(next.length + ' ' + cur.length + ' ' + realOff);
		next.copy(n, (cur.length-realOff));
		off = off - realOff;
		realOff = 0;
		cur = n;
		bufs.shift();
		bufs[0] = n;
		
		if(bufs.length === 1) _.assertEqual(n.length, realGot);
		//console.log('merged, result: ' + n.length + ' got(' + got + '), realGot(' + realGot + ')');
		//console.log('off: ' + off + ' realOff: ' + realOff);
	}
	
	return {
		s: s,
		assertEmpty: function(){
			_.assertEqual(got, 0);
		},
		needs: function(){
			return needs;
		},
		reset: function(){
			bufs = [];
			realGot = 0;
			got =  0;
			cur = off = realOff = undefined
			ranOut = undefined;
		},
		put: function(buf){
			//console.log('put: ' + buf.length)
			//for(var i=0;i<buf.length;++i){
			//	console.log(buf[i])
			//}// + //JSON.stringify(buf.slice(0,Math.min(buf.length,100))));
			if(bufs.length === 0){
				cur = buf;
				realOff = 0;
				off = 0;
			}
			realGot += buf.length;
			got += buf.length;
			bufs.push(buf);
			ranOut = false;
		}
	}
}
exports.make = makeReadState;
