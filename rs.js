var _ = require('underscorem');
var bin = require('./bin');

var ccc = console.log

function makeReadState(throwOnHasFail){
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
			var v = bin.readInt(cur, off);
			off+=4;
			got-=4;
			return v;
		},
		readString: function(len){
			_.assertInt(len)
			mergeIfNecessary(len);
			var v = cur.toString('utf8', off, off+len);
			off += len;
			got -= len;
			return v;
		},
		readData: function(len){
			_.assertInt(len)
			mergeIfNecessary(len);
			var v = cur.slice(off, off+len)
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
			var h = got >= many;
			if(!h){
				needs = many - got
				ranOut = true;
				if(throwOnHasFail){
					throw new Error('ran out (' + many + ') at ' + new Error().stack)
				}
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
			_.assert(s.has(1))
			var b = cur[off];

			++off;
			--got;
			if(b !== 0 && b !== 1) console.log('b: ' + b)
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
	s.readVarUint = s.readLength

	function mergeIfNecessary(len){
		while(cur.length - off < len){
			merge();
		}
	}

	function merge(){
		_.assert(bufs.length > 1);

		var next = bufs[1];
		var n = new Buffer(next.length+(cur.length-realOff));
		cur.copy(n, 0, realOff);
		next.copy(n, (cur.length-realOff));
		off = off - realOff;
		realOff = 0;
		cur = n;
		bufs.shift();
		bufs[0] = n;
		
		if(bufs.length === 1) _.assertEqual(n.length, realGot);
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

