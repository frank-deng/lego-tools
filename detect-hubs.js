const PoweredUP=require('node-poweredup');
const poweredUp=new PoweredUP.PoweredUP();

poweredUp.on('discover',(hub)=>{
  console.log(`Hub Discovered, ID: ${hub.uuid}    Name: ${hub.name}    Battery: ${hub.batteryLevel}%`);
});
console.log('Start scanning...');
poweredUp.scan();

