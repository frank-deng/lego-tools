const $CONFIG=require('./config.json');

const PoweredUP=require('node-poweredup');
const EvdevReader=require('evdev');

//Parse args
let doCalibrate=false;
const yargs=require('yargs/yargs');
const { hideBin } = require('yargs/helpers')
const argv=yargs(hideBin(process.argv)).option('calibrate',{
  type: 'boolean',
  description: 'Calibrate steering mechanism during initialization.'
}).argv;
if(argv.calibrate){
  doCalibrate=true;
}

const poweredUp=new PoweredUP.PoweredUP();
const reader=new EvdevReader();

async function calibrate(hub, motorC){
  let minAngle=maxAngle=null;
  let calibrateFunc=(e)=>{
    let angle=Number(e.degrees);
    if(isNaN(angle)){
      return;
    }
    if(null==minAngle || angle<minAngle){
      minAngle=angle;
    }
    if(null==maxAngle || angle>maxAngle){
      maxAngle=angle;
    }
  }
  motorC.on('rotate',calibrateFunc);
  motorC.setSpeed(-50);
  await hub.sleep(2000);
  motorC.setSpeed(50);
  await hub.sleep(2000);
  motorC.off('rotate',calibrateFunc);

  let mediumAngle=Math.round((maxAngle+minAngle)/2);
  motorC.gotoAngle(mediumAngle,30);
  await hub.sleep(2000);
  await motorC.resetZero();
  await hub.sleep(100);
  await motorC.gotoAngle(0,10);
  await hub.sleep(1000);
}

let running=true, masterHub=null;
async function onDiscover(hub){
  if($CONFIG.hubId && hub.uuid!=$CONFIG.hubId){
    return;
  }

  //Stop further detection and start connect the corresponding hub
  poweredUp.stop();
  poweredUp.off('discover',onDiscover);
  masterHub=hub;
  await hub.connect();

  console.log(`Hub connected, ID: ${hub.uuid}, name: ${hub.name}`);
  const [motorA,motorB,motorC] = await Promise.all([
    hub.waitForDeviceAtPort("A"),
    hub.waitForDeviceAtPort("B"),
    hub.waitForDeviceAtPort("C")
  ]);

  //Calibrate
  if(doCalibrate){
    console.log(`Start calibration.`);
    await calibrate(hub,motorC);
    console.log(`Calibration complete.`);
  }

  await Promise.all([
    motorA.setAccelerationTime(1),
    motorA.setDecelerationTime(1),
    motorB.setAccelerationTime(1),
    motorB.setDecelerationTime(1),
    motorC.setAccelerationTime(1),
    motorC.setDecelerationTime(1)
  ]);

  await motorC.gotoAngle(0,100);

  let currentAngle=0;
  motorC.on('rotate',(e)=>{
    currentAngle=Number(e.degrees);
  });
  reader.on("EV_ABS",(data)=>{
    if($CONFIG.steer.axis==data.code){
      let requestAngle=Math.round(90*(data.value-128)/128);
      if($CONFIG.steer.reverse){
        requestAngle=-requestAngle;
      }
      speed=Math.abs(currentAngle-requestAngle)/180*100;
      speed=Math.min(Math.max(speed,1),100);
      motorC.gotoAngle(requestAngle,speed);
    }else if($CONFIG.throttle.axis==data.code){
      let value=Math.round((data.value-128)*100/128);
      if($CONFIG.throttle.reverse){
        value=-value;
      }
      motorA.setPower(value);
      motorB.setPower(value);
    }
  });
  reader.on("EV_KEY",async(data)=>{
    if($CONFIG.brakeButton==data.code && data.value){
      motorA.brake();
      motorB.brake();
      await motorC.brake();
      await motorC.gotoAngle(0,10);
    }
  });
}

process.on('exit',function exitFunction(){
  try{
    running=false;
    poweredUp.stop();
    if(masterHub){
      masterHub.disconnect();
    }
    reader.close();
    console.log('Exit.');
  }catch(e){
    console.error(e);
  }finally{
    process.kill(process.pid,'SIGKILL');
  }
});

//Load joystick
reader.search('/dev/input/by-id','event-joystick',(err,files)=>{
  if(err){
    console.error(err);
    return;
  }
  if(!files.length){
    console.error('No joystick found.');
    return;
  }

  //Find the joystick to use, if not found, use the first one
  let file=files[0];
  if($CONFIG.joystick){
    for(let item of files){
      if(-1!=item.indexOf($CONFIG.joystick)){
        file=item;
        break;
      }
    }
  }

  let device=reader.open(file);
  device.on('open',()=>{
    console.log('Joystick loaded, start scanning.');
    poweredUp.on('discover',onDiscover).scan();
  });
});

