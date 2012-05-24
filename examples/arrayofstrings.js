
var parsicle = require('./../parsicle')//normally just require('parsicle')

var ps = parsicle.make(function(parser){
	//here we define a parser with a name and type
	parser('myMessage', 'array', function(ps){
		//we specify that the array will contain a series of elements
		//it could also contain a fixed sequence, so we have to specify this
		var loop = ps.loop()
		//then we specify that the series elements will be a strings
		loop.string()
	})
	//once we exit the callback, the definition of 'myMessage' is complete
})
//once we exit the 'make' callback the entire parser definition is complete

var readers = {
	//we specify a function for each message type we defined
	myMessage: function(msg){
		console.log('got myMessage: ' + JSON.stringify(msg))
	}
}

//constructing a reader returns a function with which to input binary data
var inputFunction = ps.binary.stream.makeReader(readers);

//we provide the writer with a simple stream-like interface to write to
var w = ps.binary.stream.makeWriter({
	write: inputFunction,
	end: function(){
		console.log('stream ended')
	}	
});

w.myMessage(['a string', 'another string'])
w.myMessage(['more string', 'yet another string'])

//flushing the writer is the responsibility of the library user
//parsicle will not flush until its buffer size is exceeded or flush() is called.
w.flush()

