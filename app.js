var http = require('http');
var express = require('express');
var app = express();

var port = 10001;

console.log('Server started');
console.log('Enabling express...');
app.use('/ringsurf/',express.static(__dirname + '/client'));
var httpServer = http.createServer(app);
httpServer.listen(port);
console.log("Server started on port " + port);
var io = require('socket.io')(httpServer, {"path": "/ringsurf/io"});

var players = {};
var sockets = {};
var rings = {};

var playersStillRacing = 0;
var globalTimer = -175, lag = 0, ops = 0;
var wheelRadius = 20, springiness = 1;
var speedMult = .1;


var Player = function(i){
	var self = {
		color:randRainbow(),
		name:("Guest"+Math.random()*10000).substring(0,8),
		trail:false,
		pingTimer:500,
		
		timer:0,
		finished:false,
		
		lx:0,
		ly:0,
		la:0,
		lvx:0,
		lvy:0,
		lva:0,
		
		w1x:-2*wheelRadius,
		w1y:0,
		w1vx:0,
		w1vy:0,
		
		w2x:2*wheelRadius,
		w2y:0,
		w2vx:0,
		w2vy:0,
		
		id:i,
		
		w:false,
		s:false,
		a:false,
		d:false,
		space:false,
	}
	self.tick = function(){
		if(self.pingTimer--<0){
			var text = self.name + " disconnected!";
			sendAll("chat", {msg:text});
			delete players[self.id];
			return;
		}
		if(globalTimer < 0 || self.finished)
			return;
		if(self.lx > 16384){
			sendAll('chat', {msg:self.name+" crossed the finish line!"});
			self.finished = true;
		}
		self.timer = globalTimer;
		self.move();
		if(!self.space)
			self.collide();
		if(self.ly > self.lx+2048)
			self.respawn();
	}
	self.move = function(){
		self.lvx += ((self.lx+self.w1x+self.w2x)/3.-self.lx)*.01;
		self.lvy += ((self.ly+self.w1y+self.w2y)/3.-self.ly)*.01;
		self.lx += ((self.lx+self.w1x+self.w2x)/3.-self.lx)*.15;
		self.ly += ((self.ly+self.w1y+self.w2y)/3.-self.ly)*.15;
		
		var par1 = ((self.w1y+(self.ly-wheelRadius*2*Math.sin(self.la)))/2.-self.w1y)
		var par2 = ((self.w1x+(self.lx-wheelRadius*2*Math.cos(self.la)))/2.-self.w1x)
		var par3 = ((self.w2y+(self.ly+wheelRadius*2*Math.sin(self.la)))/2.-self.w2y)
		var par4 = ((self.w2x+(self.lx+wheelRadius*2*Math.cos(self.la)))/2.-self.w2x)
		
		
		self.w1vy += par1*.01;
		self.w1vx += par2*.01;
		self.w2vy += par3*.01;
		self.w2vx += par4*.01;
		self.w1y += par1*.7;
		self.w1x += par2*.7;
		self.w2y += par3*.7;
		self.w2x += par4*.7;
		
		self.lvy+=.1;//gravity
		self.w1vy+=.1;
		self.w2vy+=.1;
		
		self.lx += self.lvx;
		self.ly += self.lvy;
		self.w1x += self.w1vx;
		self.w1y += self.w1vy;
		self.w2x += self.w2vx;
		self.w2y += self.w2vy;
		
		var prior = square((self.w1y+(self.ly-wheelRadius*2*Math.sin(self.la)))/2.-self.w1y);
		prior += square((self.w1x+(self.lx-wheelRadius*2*Math.cos(self.la)))/2.-self.w1x);
		prior += square((self.w2y+(self.ly+wheelRadius*2*Math.sin(self.la)))/2.-self.w2y);
		prior += square((self.w2x+(self.lx+wheelRadius*2*Math.cos(self.la)))/2.-self.w2x);
		var post = square((self.w1y+(self.ly-wheelRadius*2*Math.sin(self.la+.01)))/2.-self.w1y);
		post += square((self.w1x+(self.lx-wheelRadius*2*Math.cos(self.la+.01)))/2.-self.w1x);
		post += square((self.w2y+(self.ly+wheelRadius*2*Math.sin(self.la+.01)))/2.-self.w2y);
		post += square((self.w2x+(self.lx+wheelRadius*2*Math.cos(self.la+.01)))/2.-self.w2x);
		self.lva = (prior-post)*.007;
		
		if(self.a)
			self.lva -= .07;
		if(self.d)
			self.lva += .07;
		self.la += self.lva;
		self.lva *= .5;
		
		self.lvy *= .999;//air resistance
		self.lvx *= .999;
		self.w1vx *= .99;
		self.w2vx *= .99;
		self.w1vy *= .99;
		self.w2vy *= .99;
	}
	self.collide = function(){
		for(var i in rings){
			var ring = rings[i];
			var dist = Math.sqrt(hypot2(self.w1x,ring.x,self.w1y,ring.y));
			var squish = Math.abs(dist - ring.r), squishFac = 2*Math.sqrt(wheelRadius-squish+1)-2;
			if(squish<wheelRadius+1){
				var flip = dist>ring.r?1:-1;
				var speedMult = (self.s?-1:0)+(self.w?1:0);
				var mult = springiness*flip/dist
				self.w1vx -= speedMult*mult*(squishFac+2)*(self.w1y-ring.y);
				self.w1vy += speedMult*mult*(squishFac+2)*(self.w1x-ring.x)/dist;
				self.w1vx = self.w1vx*.8+mult*squishFac*(self.w1x-ring.x);
				self.w1vy = self.w1vy*.8+mult*squishFac*(self.w1y-ring.y);
			}
			
			dist = Math.sqrt(hypot2(self.w2x,ring.x,self.w2y,ring.y));
			squish = Math.abs(dist - ring.r), squishFac = 2*Math.sqrt(wheelRadius-squish+1)-2;
			if(squish<wheelRadius+1){
				var flip = dist>ring.r?1:-1;
				var speedMult = (self.s?-1:0)+(self.w?1:0);
				var mult = springiness*flip/dist
				self.w2vx -= mult*speedMult*(squishFac+2)*(self.w2y-ring.y);
				self.w2vy += mult*speedMult*(squishFac+2)*(self.w2x-ring.x);
				self.w2vx = self.w2vx*.8+mult*squishFac*(self.w2x-ring.x);
				self.w2vy = self.w2vy*.8+mult*squishFac*(self.w2y-ring.y);
			}
		}
	}
	self.changeName = function(newName){
		if(newName.length > 16){
			send(self.id, "chat", {msg:"Name must be 1-16 characters."});
			return;
		}
		self.name = newName;
		send(self.id, "chat", {msg:"Name changed successfully."});
	}
	self.sendMap = function(){
		send(self.id, "newMap", {rings:rings});
	}
	self.respawn = function(){
		self.trail = false;
		self.finished = false;
		self.lx = self.ly = self.w1y = self.w2y = 0;
		self.w1x = -2*wheelRadius;
		self.w2x = 2*wheelRadius;
		self.lvx = self.lvy = self.w1vy = self.w2vy = self.w1vx = self.w2vx = 0;
		self.la = self.lva = 0;
		self.score *= .9;
		self.timer = 0;
	}
	return self;
}
var Ring = function(i, x, y, r){
	var self = {
		color:randRainbow(),
		id:i,
		x:x,
		y:y,
		r:r,
	}
	return self;
}



function send(id, msg, data){
	var s = sockets[id];
	if(typeof s !== "undefined")
		s.emit(msg, data);
}



io.sockets.on('connection', function(socket){
	socket.id = Math.random();
	sockets[socket.id]=socket;
	var ip = socket.request.connection.remoteAddress;
	
	socket.on('requestBody',function(data){
		var player = Player(socket.id);
		players[socket.id]=player;
		player.sendMap();
	});
	socket.on('pingmsg',function(data){
		var player = players[socket.id];
		if(typeof player === "undefined")
			return;
		socket.emit('reping', {time:data.time});
		player.pingTimer = 250;
	});
	socket.on('disconnect',function(data){
		var player = players[socket.id];
		if(typeof player === "undefined")
			return;
		var text = player.name + " left the game!";
		sendAll("chat", {msg:text});
		delete players[socket.id];
		return;
	});
	socket.on('key',function(data){
		var player = players[socket.id];
		if(typeof player === "undefined")
			return;
		if(typeof data.inputId === 'undefined' || typeof data.state === 'undefined')
			return;
		if(data.inputId==='w')
			player.w = data.state;
		if(data.inputId==='s')
			player.s = data.state;
		if(data.inputId==='a')
			player.a = data.state;
		if(data.inputId==='d')
			player.d = data.state;
		if(data.inputId===' ')
			player.space = data.state;
	});
	socket.on('chat',function(data){
		var player = players[socket.id];
		if(typeof player === "undefined")
			return;
		if(typeof data.msg !== "string")
			return;
		data.msg = data.msg.trim();
		if(data.msg.startsWith("NAME ")) {
			player.changeName(data.msg.substring(5));
			return;
		}
		if(typeof data.msg !== 'string' || data.msg.length == 0 || data.msg.length > 128)
			return;
		data.msg = (" "+data.msg+" ").replace(/fuck/ig, '****').replace(/fuk/ig, '****').replace(/vagina/ig, '******').replace(/fvck/ig, '****').replace(/penis/ig, '*****').replace(/slut/ig, '****').replace(/ tit /ig, ' *** ').replace(/ tits /ig, ' **** ').replace(/whore/ig, '****').replace(/shit/ig, '****').replace(/cunt/ig, '****').replace(/bitch/ig, '*****').replace(/faggot/ig, '******').replace(/ fag /ig, ' *** ').replace(/nigger/ig, '******').replace(/nigga/ig, '******').replace(/dick/ig, '****').replace(/ ass /ig, ' *** ').replace(/pussy/ig, '*****').replace(/ cock /ig, ' **** ').trim();
		var spaces = "";
		for(var i = player.name.length; i < 16; i++)
			spaces += " ";
			
		const finalMsg = (player.name + ": " + data.msg);
		sendAll('chat', {msg:finalMsg});
	});
});
function findBisector(a1, a2){
	a1 = a1 * 180 / Math.PI;
	a2 = a2 * 180 / Math.PI;
	a1 = mod(a1, 360);
	a2 = mod(a2, 360);
	var small = Math.min(a1, a2);
	var big = Math.max(a1, a2);
	var angle = (big - small) / 2 + small;
	if(big - small > 180)
		angle += 180;
	return angle * Math.PI / 180;
}
function atan(y, x){
	var a = Math.min(abs(x), abs(y)) / Math.max(abs(x), abs(y));
	var s = a * a;
	var r = ((-0.0464964749 * s + 0.15931422) * s - 0.327622764) * s * a + a;
	if (abs(y) > abs(x))
		r = 1.57079637 - r;
	if (x < 0)
		r = 3.14159274 - r;
	if (y < 0)
		r = -r;
	return r;
}
function square(x){
	return x * x;
}
function abs(x){
	return x > 0?x:-x;
}
function mod(n, m) {
    var remain = n % m;
    return Math.floor(remain >= 0 ? remain : remain + m);
}
function r128(){
	return Math.floor(Math.random() * 128);
}
function hypot2(x1, x2, y1, y2){
	return square(x1-x2)+square(y1-y2);
}
function randRainbow(){
	var t = r128();
	var str = ((Math.floor(Math.cos(t) * 128 + 128) << 16) + (Math.floor(Math.cos(t+Math.PI*2/3) * 128 + 128) << 8) + Math.floor(Math.cos(t+Math.PI * 4 / 3) * 128 + 128)).toString(16)
	while (str.length < 6)
		str = "0"+str;
	return "#"+str;
}



function sendAll(out, data){
	for(var i in sockets)
		sockets[i].emit(out, data);
}


newRace();
setTimeout(update,3000);
function newRace(){

	globalTimer = -150;
	
	var besti = 0;
	for(var i in players){
		if(besti == 0 && players[i].finished)
			besti = i;
		if(players[i].finished && players[i].timer < players[besti].timer)
			besti = i;
	}
	
	for(var i in players){
		var player = players[i];
		player.respawn();
	}
	
	if(besti != 0){
		sendAll('chat', {msg:players[besti].name+" won the round!"});
		players[besti].trail = true;
	}
	
	rings = {};
	rings[0] = new Ring(0, 0, 0, 1024);
	rings[0].color = "cyan"
	outer:while(Object.keys(rings).length<800){
		var id = Math.random();
		var x = Math.random() * 16384, y = Math.random() * 16384, r = Math.pow(2, 6 + Math.random() * 4);
		if(y > x)
			continue outer;
		for(var i in rings)
			if(Math.hypot(x - rings[i].x, y - rings[i].y) < r + rings[i].r)
				continue outer;
		rings[id] = new Ring(id, x, y, r);
	}
	
	for(var i in players)
		players[i].sendMap();
	
}



function update(){
	ops++;
	if(globalTimer++ > 6000 || (globalTimer > 300) && playersStillRacing == 0)
		newRace();
	if(ops < 2)
		setTimeout(update, 20);
	var d = new Date();
	var lagTimer = d.getTime();
	var pack = {};
	playersStillRacing = 0;
	for(var i in players){
		var player = players[i];
		if(!player.finished) playersStillRacing++;
		player.tick();
		send(i, 'you', {lx:player.lx,ly:player.ly});
		pack[player.id] = ({finished:player.finished,timer:player.timer,score:player.score,trail:player.trail,w1x:player.w1x,w1y:player.w1y,w2x:player.w2x,w2y:player.w2y,lx:player.lx,ly:player.ly,la:player.la,color:player.color,name:player.name,space:player.space});
	}
	sendAll('posUp', {players:pack, globalTimer:globalTimer});
	ops--;
}

