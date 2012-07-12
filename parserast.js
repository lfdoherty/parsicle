
var _ = require('underscorem');

function init(t, parent){
	t.children = [];
	t.doneListener;
	t.parent = parent;
	t.isDone = false;
}

function ParserAst(parent){
	init(this, parent);
}

ParserAst.prototype.string = function(){
	this.children.push({type: 'string'});
	return this;
}
ParserAst.prototype.binary = function(){
	this.children.push({type: 'binary'});
	return this;
}
ParserAst.prototype.object = function(){
	var context = new ParserAstObject(this);
	this.children.push({type: 'object', children: context.children});
	return context;
}

ParserAst.prototype.array = function(){

	var context = new ParserAstArray(this);
	this.children.push({type: 'array', children: context.children});
	return context;
}

ParserAst.prototype.include = function(name){
	this.children.push({type: 'include', name: name});
	return this;
}

ParserAst.prototype.wrapped = function(count, name){
	_.assertInt(count);
	var e = {type: 'wrapped', count: count};
	if(name) e.name = name;
	this.children.push(e);
	return this;
}
ParserAst.prototype.either = function(){

	var context = new ParserAst(this);
	this.children.push({type: 'either', children: context.children});
	return context;
}
/*
ParserAst.prototype.done = function(cb){
	if(this.doneListener !== undefined) throw new Error('already has done listener')
	this.doneListener = cb;
}

ParserAst.prototype.end = function(){
	if(this.isDone) throw new Error('end called on already completed ast node');
	
	var context = this.parent;
	if(this.doneListener){
		var up = this.doneListener();
		if(up) context = up;
	}
	this.isDone = true;
	//console.log('ending: ' + this.constructor);
	return context
}*/
ParserAst.prototype.int = function(){
	this.children.push({type: 'int'});
	return this;
}
ParserAst.prototype.long = function(){
	this.children.push({type: 'long'});
	return this;
}
ParserAst.prototype.boolean = function(){
	this.children.push({type: 'boolean'});
	return this;
}
ParserAst.prototype.byte = function(){
	this.children.push({type: 'byte'});
	return this;
}
ParserAst.prototype.real = function(){
	this.children.push({type: 'real'});
	return this;
}

function ParserAstObject(parent){
	init(this, parent);
	this.type = 'object';
}

ParserAstObject.prototype.key = function(key){
	var context = new ParserAstSingle(this);
	this.children.push({type: 'key', children: context.children, key: key});
	return context;
}
ParserAstObject.prototype.optionalKey = function(key){
	var context = new ParserAstSingle(this);
	var ast = this.children.push({type: 'optionalKey', children: context.children, key: key});
	return context;
}

ParserAstObject.prototype.rest = function(key){
	var context = new ParserAstSingle(this);
	var ast = this.children

	//TODO add check to prevent adding keys or optionalKeys after rest call
	
	var already = [];
	for(var i=0;i<this.children.length;++i){
		var a = this.children[i];
		if(a.type === 'key' || a.type === 'optionalKey'){
			already.push(a.key);
		}
	}
	this.children.push({type: 'rest', children: context.children, key: key, omit: already});
	return context;
}

//ParserAstObject.prototype.end = ParserAst.prototype.end
//ParserAstObject.prototype.done = ParserAst.prototype.done

function ParserAstSingle(parent){
	init(this, parent);
}

ParserAstSingle.prototype.object = function(){

	var context = new ParserAstObject(this);
	this.children.push({type: 'object', children: context.children});
	return context;

}
ParserAstSingle.prototype.string = function(){
	ParserAst.prototype.string.apply(this);
}
ParserAstSingle.prototype.constant = function(value){
	this.children.push({type: 'constant', value: value});
}
ParserAstSingle.prototype.int = function(){
	ParserAst.prototype.int.apply(this);
}
ParserAstSingle.prototype.long = function(){
	ParserAst.prototype.long.apply(this);
}
ParserAstSingle.prototype.boolean = function(){
	ParserAst.prototype.boolean.apply(this);
}
ParserAstSingle.prototype.byte = function(){
	ParserAst.prototype.byte.apply(this);
}
ParserAstSingle.prototype.binary = function(){
	ParserAst.prototype.binary.apply(this);
}
ParserAstSingle.prototype.real = function(){
	ParserAst.prototype.real.apply(this);
}
ParserAstSingle.prototype.include = function(name){
	ParserAst.prototype.include.call(this, name);
}
ParserAstSingle.prototype.wrapped = function(count, name){
	ParserAst.prototype.wrapped.call(this, count, name);
}

ParserAstSingle.prototype.array = function(){
	var context = new ParserAstArray(this);
	this.children.push({type: 'array', children: context.children});
	return context;
}
ParserAstSingle.prototype.either = function(){

	var context = new ParserAst(this);
	this.children.push({type: 'either', children: context.children});
	return context;
}

//ParserAstSingle.prototype.done = ParserAst.prototype.done

function ParserAstArray(parent){
	init(this, parent)
	this.type = 'array';
}

ParserAstArray.prototype.loop = function(){
	var context = new ParserAstLoop(this);
	this.children.push({type: 'loop', children: context.children});
	return context;
}
//ParserAstArray.prototype.done = ParserAst.prototype.done
//ParserAstArray.prototype.end = ParserAst.prototype.end
ParserAstArray.prototype.int = ParserAst.prototype.int
ParserAstArray.prototype.string = ParserAst.prototype.string
ParserAstArray.prototype.include = ParserAst.prototype.include
ParserAstArray.prototype.wrapped = ParserAst.prototype.wrapped
ParserAstArray.prototype.object = ParserAst.prototype.object

ParserAstArray.prototype.either = function(){

	var context = new ParserAstArray(this);
	this.children.push({type: 'either', children: context.children});
	return context;
}

function ParserAstLoop(parent){
	init(this, parent);
	this.type = 'loop';
}
//ParserAstLoop.prototype.done = ParserAst.prototype.done
//ParserAstLoop.prototype.end = ParserAst.prototype.end
ParserAstLoop.prototype.array = ParserAstSingle.prototype.array
ParserAstLoop.prototype.include = ParserAstSingle.prototype.include
ParserAstLoop.prototype.int = ParserAstSingle.prototype.int
ParserAstLoop.prototype.boolean = ParserAstSingle.prototype.boolean
ParserAstLoop.prototype.string = ParserAstSingle.prototype.string
ParserAstLoop.prototype.wrapped = ParserAstSingle.prototype.wrapped
ParserAstLoop.prototype.object = ParserAst.prototype.object

ParserAstLoop.prototype.either = function(){

	var context = new ParserAst(this);
	this.children.push({type: 'either', children: context.children});
	return context;
}

exports.make = function(type){
	if(type === 'object'){
		return new ParserAstObject();
	}else if(type === 'array'){
		return new ParserAstArray();
	}else if(type === 'string'){
		return {type: 'string'};
	}else if(type === 'int'){
		return {type: 'int'};
	}else{
		throw new Error('TODO: ' + type);
	}
}
