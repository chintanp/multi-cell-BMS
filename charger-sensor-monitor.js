var can = require('socketcan');
var com = require("serialport");

// The charger on CANbus 
var channel = can.createRawChannel("can0");
channel.start();

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
    baudrate: 57600
});

sp_monitor.open(function (error) {
  if ( error ) {
    console.log('failed to open: '+error);
  } else {
    console.log('battery monitor communicating');
  }
});

// Default CAN message template
var canmsg = { id: 403105268, 
               data: new Buffer([ 0x00, 0x00, 0, 0x00, 0, 0, 0, 0 ]), 
               "ext" : true };  // For using the extended CAN frame

// set the charger voltage and current here
// 0, 1 and set the voltage*10 V and 2, 3 set current*10 amps
canmsg.data[0] = 0x00;
canmsg.data[1] = 0xFA;
canmsg.data[2] = 0x00;
canmsg.data[3] = 0x05;

// sends a CAN msg every one second to the charger
setInterval(function() {
    // writing to the CANbus
    channel.send(canmsg);
    console.log("Written to CAN device");
    
    // querying the sensor for data
    sp_current.write('s', function(err, results) {
        if (err) console.log('err ' + err);
        console.log('results ' + results);
    });
    // displaying the data from current sensor
    sp_current.on('data', function(data) {
        console.log("The current is: " + data);
    });
    
    // querying the battery monitor for data
    sp_monitor.write('cv\r', function(err, results) {
        if (err) console.log('err ' + err);
        console.log('results ' + results);
    });
    // displaying the data from battery monitor  
    sp_monitor.on('data', function(data) {
        //console.log("New data");
        console.log(data.toString('ascii'));
    });
}, 1000);       