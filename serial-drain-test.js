var SerialPort = require("serialport").SerialPort;

var sp = new SerialPort("/dev/ttyAMA0", {
  baudrate: 57600
});


  var message = new Buffer('cv\r');

  function writeThenDrainThenWait(duration) {
    console.log('Calling write...');
    sp.write(message, function() {
      console.log('...Write callback returned...');
      // At this point, data may still be buffered and not sent out from the port yet (write function returns asynchrounously).
      console.log('...Calling drain...');
      sp.drain(function() {
        // Now data has "left the pipe" (tcdrain[1]/FlushFileBuffers[2] finished blocking).
        // [1] http://linux.die.net/man/3/tcdrain
        // [2] http://msdn.microsoft.com/en-us/library/windows/desktop/aa364439(v=vs.85).aspx
        console.log('...Drain callback returned...');
        console.log('...Waiting', duration, 'milliseconds...');
        setInterval(writeThenDrainThenWait, duration);
      });
    });
  };

sp.on('open',function() {
  sp.on('data', function(data) {
    console.log('>>>>>', data);
  });
});

 // Stuff starts happening here
  writeThenDrainThenWait(1000);
  
  sp.on('data', function(data) {
    console.log('>>>>>', data);
  });