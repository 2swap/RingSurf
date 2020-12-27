var socket = io('alexhontz.com', {path:'/ringsurf/io'});

var canvas = document.getElementById('ctx');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
var ctx = canvas.getContext("2d");






var shift = false;
var keyboard = {};
var typing = false;
var chatLength = 15, globalChat = 0, chatMessage = "", preChatArr = {}, chati = 0;
var messages = {};
for (var i = 0; i < chatLength; i++)
	messages[i] = "";


var ops = 0;
var didW = false;
var empty = 0;
var multiplayer = true;

var trails = {};

var w = window.innerWidth;
var h = window.innerHeight; // Canvas width and height
var players = 0;
var rings = 0;
var globalTimer = 100000;

var lx = 0, ly = 0;//center of screen
var zoom = 1;//proportional to speed
var zoomMult = 1;
var wheelRadius = 20;


var Img = {}
loadAllImages();


socket.emit('requestBody');


function loadImage (name, src) {
	if (Img[name]) {console.error("Loading image twice: " + name); return;}
	Img[name] = new Image();
	Img[name].src = src;
}
function loadAllImages(){
	loadImage("bike", 'img/bike.png');
}



function render(){
	if(empty == 0 || ops > 0)
		return;
	ctx.fillStyle = "black";
	ctx.fillRect(0,0,w,h);
	frames++;
	ops++;
	
	ctx.save();
	ctx.translate(w/2, h/2);
	ctx.scale(zoom*zoomMult, zoom*zoomMult);
	ctx.translate(-w/2, -h/2);
	rEdges();
	rPlayers();
	rRings();
	ctx.restore();
	
	rMinimap();
	if(multiplayer)
		rChat();
	if(multiplayer)
		rLB();
	rTut();
	rTimer();
	ops--;
}


//packet handling
socket.on('posUp', function (data) {
	players = data.players;
	empty = 1;
	globalTimer = data.globalTimer;
});
socket.on('chat', function (data) {
	for (var i = chatLength; i > 0; i--)
		messages[i] = messages[i - 1];
	messages[0] = data.msg;
});
socket.on('you', function (data) {
	zoom = (99*zoom + 10/(10+Math.hypot(lx-data.lx,ly-data.ly)))/100;
	lx=data.lx;
	ly=data.ly;
});
socket.on('reping',function(data){
	let d = new Date();
	var time = d.getTime();
	nLag = time - data.time;
});
socket.on('newMap',function(data){
	rings = data.rings;
});

setInterval(function(){
	let d = new Date();
	var time = d.getTime();
	socket.emit('pingmsg', {time:time});
},1000);
setInterval(function(){
	w = window.innerWidth;
	h = window.innerHeight;
	if(canvas.width != w || canvas.height != h){
		canvas.width = w;
		canvas.height = h;
	}
},40);
setInterval(function(){
	render();
},20);


//input
document.onkeydown = function (event) {
	if (event.keyCode === 16) {
		console.log("a");
		shift = true;
	} else if(typing) {
		console.log("b");
		if (event.keyCode == 13){
			socket.emit('chat', {msg:chatMessage});
			console.log("sent " + chatMessage);
			chatMessage = "";
			typing = false;
		}
		else {
			chatMessage += String.fromCharCode(event.keyCode);
		}
	} else {
		console.log("c");
		didW = true;
		if(keyboard[event.keyCode] == true)
			return;
		keyboard[event.keyCode] = true;
		if (event.keyCode == 13)
			typing = true;
		else if (event.keyCode === 83 || event.keyCode === 40)//s
			socket.emit('key', { inputId: 's', state: true });
		else if (event.keyCode === 87 || event.keyCode === 38)//w
			socket.emit('key', { inputId: 'w', state: true });
		else if (event.keyCode === 65 || event.keyCode === 37)//a
			socket.emit('key', { inputId: 'a', state: true });
		else if (event.keyCode === 68 || event.keyCode === 39)//d
			socket.emit('key', { inputId: 'd', state: true });
		else if (event.keyCode === 72)//h
			multiplayer = !multiplayer;
		else if (event.keyCode === 32)//space
			socket.emit('key', { inputId: ' ', state: true });
		else
			didW = false;
	}
}
document.onkeyup = function (event) {
	if(keyboard[event.keyCode] == false)
		return;
	keyboard[event.keyCode] = false;
	if (event.keyCode === 83 || event.keyCode === 40)//s
		socket.emit('key', { inputId: 's', state: false });
	else if (event.keyCode === 87 || event.keyCode === 38)//w
		socket.emit('key', { inputId: 'w', state: false });
	else if (event.keyCode === 65 || event.keyCode === 37)//a
		socket.emit('key', { inputId: 'a', state: false });
	else if (event.keyCode === 68 || event.keyCode === 39)//d
		socket.emit('key', { inputId: 'd', state: false });
	else if (event.keyCode === 32)//space
		socket.emit('key', { inputId: ' ', state: false });
	else if (event.keyCode === 16)
		shift = false;
}
document.addEventListener('mousewheel', function (evt) {
	zoomMult *= 1+.2*Math.sign(evt.wheelDelta);
}, false);



//random
function write(str, x, y){
	ctx.fillText(str, x, y);
}
function square(x){
	return x * x;
}
function cube(x){
	return x * x * x;
}
function lerp(a,b,w){
	return a * (1 - w) + b * w;
}
function intToTime(x){
	var minutes=Math.floor(x/50/60), seconds=""+Math.floor(x/50%60), dec=(""+(x%50)*2).substring(0,2);
	if(seconds.length<2)
		seconds = "0"+seconds;
	if(dec.endsWith("."))
		dec = dec.substring(0,1);
	while(dec.length < 2)
		dec = "0"+dec;
	return minutes+":"+seconds+"."+dec;
}


function rChat(){
	ctx.textAlign = "left";
	ctx.font = "11px Telegrama";
	
	ctx.fillStyle = "lime";
	write(">"+chatMessage,16,h-20);

	ctx.fillStyle = "white";
	for (var i = 0; i < chatLength; i++){
		ctx.globalAlpha = (19-i) / 20;
		write(messages[i],16,h-32-12*i);
	}
	ctx.globalAlpha = 1;
}
function rLB(){
	ctx.fillStyle = 'yellow';
	ctx.font = "24px Telegrama";
	ctx.textAlign = "center";
	write("Leaderboard", w - 128, 28);
	ctx.font = "11px Telegrama";
	ctx.fillStyle = 'yellow';
	write("Name", w - 208, 48);
	ctx.textAlign = "right";
	write("Time", w - 48 - 16, 48);
	var lb = [];
	var editPlayers = {};
	for(var i in players)
		editPlayers[i] = players[i];
	while(Object.keys(editPlayers).length>0){
		var bestIndex = 0;
		for(var i in editPlayers){
			if(bestIndex == 0)
				bestIndex = i;
			if(editPlayers[i].timer < editPlayers[bestIndex].timer)
				bestIndex = i;
		}
		lb.push(editPlayers[bestIndex]);
		delete editPlayers[bestIndex];
	}
	for(var i = 0; i < lb.length; i++){
		ctx.font = "11px Telegrama";
		var place = 1 + i;
		ctx.fillStyle = lb[i].finished?"lime":"yellow";
		ctx.textAlign = "left";
		write(lb[i].name, w - 216, (i+4)*16);
		ctx.fillStyle = 'yellow';
		write(place + ".", w - 248, (i+4)*16);
		ctx.textAlign = "right";
		write(intToTime(lb[i].timer), w - 48 - 16, (i+4)*16);
	}
}
function rTut(){
	if(lx*lx+ly*ly>=1080*1080 && didW) return;
	ctx.save();
	ctx.textAlign = "center";
	ctx.fillStyle = 'cyan';
	var date = new Date();
	var ms = date.getTime();
	ctx.font = (5 * Math.sin(ms / 180) + 35) + "px Telegrama";
	if(!didW) write("Use WASD to move!", w / 2, 48);
	else if(lx*lx + ly*ly < 1080*1080) write("Use space to pass through walls!", w / 2, 48);
	ctx.restore();
}
function rTimer(){
	if(globalTimer < 48) {
		ctx.textAlign = "center";
		ctx.font = "128px Telegrama";
		ctx.fillStyle=["lime", "yellow","orange","red"][Math.floor((globalTimer-49)/-50)];
		write(globalTimer<0?(""+(Math.floor(globalTimer/-50)+1)):"GO!",w/2,h-64);
	}else{
		ctx.textAlign = "center";
		ctx.font = "32px Telegrama";
		ctx.fillStyle="lime";
		write(intToTime(globalTimer),w/2,h-64);
	}
	if(globalTimer > 5750){
		ctx.textAlign = "center";
		ctx.font = "32px Telegrama";
		ctx.fillStyle="red";
		write(Math.floor((6000-globalTimer)/50+1)+"!",w/2,h-96);
	}
}
function circle(x,y,r){
	ctx.save();
	ctx.translate(x,y);
	ctx.beginPath();
	ctx.arc(0,0,r,0,2*Math.PI);
	ctx.stroke();
	ctx.restore();
}
function rMinimap(){
	ctx.lineWidth = 4;
	ctx.save();
	
	ctx.strokeStyle = "red";
	ctx.beginPath();
	ctx.moveTo(16+128,16);
	ctx.lineTo(16,16);
	ctx.lineTo(16+128,16+128);
	ctx.stroke();
	
	ctx.strokeStyle = "lime";
	ctx.beginPath();
	ctx.moveTo(16+128,16);
	ctx.lineTo(16+128,16+128);
	ctx.stroke();
	
	for(var i in players){
		var player = players[i];
		ctx.fillStyle = player.color;
		ctx.fillRect(16+player.lx*128/16384-2,16+player.ly*128/16384-2,4,4);
	}
	
	ctx.restore();
}


function rEdges(){
	ctx.save();
	ctx.setLineDash([30,30]);
	ctx.lineWidth = 5*zoom*zoomMult+10;
	ctx.strokeStyle = "red";
	ctx.beginPath();
	ctx.moveTo(16384 - lx + w / 2, 0 - ly + h / 2);
	ctx.lineTo(0 - lx + w / 2, 0 - ly + h / 2);
	ctx.lineTo(16384 - lx + w / 2, 16384 - ly + h / 2);
	ctx.stroke();
	
	ctx.strokeStyle = "green";
	ctx.lineWidth = 50*zoom*zoomMult+30;
	ctx.beginPath();
	ctx.moveTo(16384 - lx + w / 2, 0 - ly + h / 2);
	ctx.lineTo(16384 - lx + w / 2, 16384 - ly + h / 2);
	ctx.stroke();
	ctx.restore();
}
function rRings(){
	ctx.lineWidth = 5*zoom*zoomMult+4;
	for (var i in rings) {
		var selfo = rings[i];
		var rendX = selfo.x - lx + w / 2;
		var rendY = selfo.y - ly + h / 2;
		ctx.fillStyle = ctx.strokeStyle = selfo.color;

		circle(rendX, rendY, selfo.r);
	}
}
function rPlayers(){
	var t = globalTimer / 10.;
	var flasher = ((Math.floor(Math.cos(t) * 128 + 128) << 16) + (Math.floor(Math.cos(t+Math.PI*2/3) * 128 + 128) << 8) + Math.floor(Math.cos(t+Math.PI * 4 / 3) * 128 + 128)).toString(16)
	if(flasher.length < 6)
		flasher = "0"+flasher;
	flasher = "#"+flasher;
	ctx.textAlign = "center";
	for (var i in players) {
		var selfo = players[i];
		var img = Img.bike;
		var rendX = selfo.lx - lx + w / 2;
		var rendY = selfo.ly - ly + h / 2;
		
		ctx.font = "40px Telegrama";
		ctx.globalAlpha = selfo.space?.5:1;
		ctx.save();
		ctx.translate(rendX,rendY);
		ctx.rotate(selfo.la);
		ctx.fillStyle = selfo.trail?flasher:selfo.color;
		if(multiplayer)
			write(selfo.name, 0, -100);
		ctx.drawImage(img, -img.width / 4, -img.height / 2, img.width/2, img.height/2);
		ctx.restore();

		
		
		ctx.strokeStyle = selfo.color;
		ctx.lineWidth = 10*zoom*zoomMult;
		circle(selfo.w1x - lx + w / 2, selfo.w1y - ly + h / 2, 20);
		circle(selfo.w2x - lx + w / 2, selfo.w2y - ly + h / 2, 20);
	}
	ctx.strokeStyle = "black";
	ctx.globalAlpha = 1;
	ctx.textAlign = "left";
}

