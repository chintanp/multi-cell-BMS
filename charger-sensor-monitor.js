var express = require('express'),
    routes = require('./routes'),
    socket = require('./routes/socket.js'),
    util = require('util'),
    http = require('http'),
    fs = require('fs'),
    net = require('net'),             // For TCP communication with datalogger
    url = require('url'),
    events = require('events'),
    path = require('path');         //For manipulating file-paths

var app = module.exports = express();
var server = require('http').createServer(app);

// Hook Socket.io into Express
var io = require('socket.io').listen(server);

// Configuration
app.configure(function() {
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(express.static(__dirname + '/public'));
    app.use(app.router);
});

app.configure('development', function(){
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
    app.use(express.errorHandler());
});

// Routes
app.get('/', routes.index);
app.get('/partials/:name', routes.partials);

// redirect all others to the index (HTML5 history)
app.get('*', routes.index);
    
var can = require('socketcan');
var com = require("serialport");

var BATTERY_STATS = "";
var cell_voltages = "";
var circuit_current = 0.0;

var UI_UPDATE_RATE = 2.0;

var MAX_CHARGE_VOLTAGE = 25000;
var MAX_CHARGE_CURRENT = 3000;
// The charger on CANbus 
var channel = can.createRawChannel("can0");
var charger_state = " ";
channel.start();
// Log any message
channel.addListener("onMessage", function(msg) { charger_state = msg; } );

// The current sensor - serial thru Arduino
var sp_current = new com.SerialPort("/dev/ttyACM0", {
    baudrate: 19200, 
    parser: com.parsers.readline("\n")
});

sp_current.open(function (error) {
  if ( error ) {
    console.log('failed to open: '+error);
  } else {
    console.log('current sensor communicating');
  }
});

// The Battery monitor via MSP 430 - serial 
var sp_monitor = new com.SerialPort("/dev/ttyAMA0", {
    baudrate: 57600, 
    parser: com.parsers.readline("\n")
});

sp_monitor.open(function (error) {
  if ( error ) {
    console.log('failed to open: '+error);
  } else {
    console.log('battery monitor communicating');
  }
});

var charge_current = 500.0;  // set charger current in mA
var charge_voltage = 25000.0; // set charge voltage in mV

if (charge_voltage > MAX_CHARGE_VOLTAGE) charge_voltage = MAX_CHARGE_VOLTAGE;
if (charge_current > MAX_CHARGE_CURRENT) charge_current = MAX_CHARGE_CURRENT;

var can_hex_current = ((charge_current/1000)*10).toString(16);
var can_hex_voltage = ((charge_voltage/1000)*10).toString(16);
// pad with zeroes
var can_hex_current_padded = ('0000'+can_hex_current).slice(-4);
var can_hex_voltage_padded = ('0000'+can_hex_voltage).slice(-4);

// Default CAN message template
var canmsg = { id: 403105268, 
               data: new Buffer([ 0x00, 0x00, 0, 0x00, 0, 0, 0, 0 ]), 
               "ext" : true };  // For using the extended CAN frame

// set the charger voltage and current here
// 0, 1 and set the voltage*10 V and 2, 3 set current*10 amps
canmsg.data[0] = parseInt(can_hex_voltage_padded.substr(0,2), 16);
canmsg.data[1] = parseInt(can_hex_voltage_padded.substr(2,2), 16);
canmsg.data[2] = parseInt(can_hex_current_padded.substr(0,2), 16);
canmsg.data[3] = parseInt(can_hex_current_padded.substr(2,2), 16);

// sends a CAN msg every one second to the charger
setInterval(function() {
    // writing to the CANbus
    channel.send(canmsg);
    console.log("Written to CAN device");
    //console.log("Charger status " + charger_state.data);
    
    // querying the sensor for data
    sp_current.write('s', function(err, results) {
        if (err) console.log('err ' + err);
        console.log('results ' + results);
    });
    
    // querying the battery monitor for data
    sp_monitor.write('cv\r', function(err, results) {
        if (err) console.log('err ' + err);
        console.log('results ' + results);
    });
    
}, 1000); 

// displaying the data from current sensor
sp_current.on('data', function(current) {
    console.log("The current is: " + current);
    circuit_current = current;
});
    
// displaying the data from battery monitor  
sp_monitor.on('data', function(cv) {
    console.log(cv.toString('ascii'));   
    cell_voltages = cv.split(',');
});

// TODO: Error handling for socket.io
io.on('connection', function(http_socket) {
    console.log("Socket connected");
    // Emits battery stats every UPDATE_RATE seconds
    BATTERY_STATS.current = circuit_current;
    BATTERY_STATS.cell_voltages = cell_voltages;
    
    setInterval(function() {
        http_socket.emit('old_data', {livedata: BATTERY_STATS}); 
    }, UI_UPDATE_RATE*1000);
});

    