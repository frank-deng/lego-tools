const {throttle}=require('lodash');
const $CONFIG=require('./config.json');

const PoweredUP=require('node-poweredup');
const EvdevReader=require('evdev');

const poweredUp=new PoweredUP.PoweredUP();
const reader=new EvdevReader();

let running=true;
let hubs={}
hubs[$CONFIG.lower_hub_id] = {
	name:'Lower Hub',
	hub:null,
	connected:false
};
hubs[$CONFIG.upper_hub_id] = {
	name:'Upper Hub',
	hub:null,
	connected:false
};
async function onDiscover(hub){
  try{
    if(!hubs.hasOwnProperty(hub.uuid)){
      return;
    }
    if(null === hubs[hub.uuid].hub){
      hubs[hub.uuid].hub=hub;
      await hub.connect();
      hubs[hub.uuid].connected=true;
      console.log(`${hubs[hub.uuid].name} connected, ID: ${hub.uuid}, name: ${hub.name}`);
    }
    if(!hubs[$CONFIG.lower_hub_id].connected ||
      !hubs[$CONFIG.upper_hub_id].connected){
      return;
    }

    poweredUp.stop();
    poweredUp.off('discover',onDiscover);
    let upperHub = hubs[$CONFIG.upper_hub_id].hub;
    let lowerHub = hubs[$CONFIG.lower_hub_id].hub;

    const [rotator,ltrack,rtrack,boom,jib,hook] = await Promise.all([
      lowerHub.waitForDeviceAtPort("B"),
      lowerHub.waitForDeviceAtPort("C"),
      lowerHub.waitForDeviceAtPort("D"),
      upperHub.waitForDeviceAtPort("A"),
      upperHub.waitForDeviceAtPort("D"),
      upperHub.waitForDeviceAtPort("B"),
    ]);
    await Promise.all([lowerHub.sleep(1000), upperHub.sleep(1000)]);
    
    let request={
        ltrack:null,
        rtrack:null,
        rotate:null
    };
    const setSpeed=throttle(()=>{
        if(null!==request.ltrack){
          ltrack.setPower(request.ltrack);
          request.ltrack=null;
        }
        if(null!==request.rtrack){
          rtrack.setPower(request.rtrack);
          request.rtrack=null;
        }
        if(null!==request.rotate){
          rotator.setPower(request.rotate);
          request.rotate=null;
        }
    }, 100, {
        leading:true,
        trailing:true
    });
    reader.on("EV_ABS",(data)=>{
      if($CONFIG.left_track.axis==data.code){
        let value=Math.round((data.value-128)*100/128);
        if($CONFIG.left_track.reverse){
          value=-value;
        }
        request.ltrack=value;
        setSpeed();
      }else if($CONFIG.right_track.axis==data.code){
        let value=Math.round((data.value-128)*100/128);
        if($CONFIG.right_track.reverse){
          value=-value;
        }
        request.rtrack=value;
        setSpeed();
      }else if($CONFIG.rotate.axis==data.code){
        let value=data.value-128;
        if($CONFIG.rotate.reverse){
          value=-value;
        }
        if(Math.abs(value)<64){
          value=0;
        }else if(value > 0){
	  value-=64;
        }else if(value < 0){
	  value+=64;
	}
        request.rotate=value*100/64;
        setSpeed();
      }else if($CONFIG.boom.forward==data.code){
        console.log(`${data.code} ${data.value}`);
        if(data.value>0){
          boom.setPower(100);
        }else{
          boom.setPower(0);
        }
      }else if($CONFIG.boom.back==data.code){
        console.log(`${data.code} ${data.value}`);
        if(data.value>0){
          boom.setPower(-100);
        }else{
          boom.setPower(0);
        }
      }
    });
    reader.on("EV_KEY",(data)=>{
      if($CONFIG.boom.forward==data.code){
        boom.setPower(data.value ? 100 : 0);
      }else if($CONFIG.boom.back==data.code){
        boom.setPower(data.value ? -100 : 0);
      }else if($CONFIG.jib.up==data.code){
        jib.setPower(data.value ? -100 : 0);
      }else if($CONFIG.jib.down==data.code){
        jib.setPower(data.value ? 100 : 0);
      }else if($CONFIG.hook.up==data.code){
        hook.setPower(data.value ? -100 : 0);
      }else if($CONFIG.hook.down==data.code){
        hook.setPower(data.value ? 100 : 0);
      }
    });
  }catch(e){
    console.error(e);
  }
}

process.on('exit',function exitFunction(){
  try{
    running=false;
    poweredUp.stop();
    let upperHub = hubs[$CONFIG.upper_hub_id].hub;
    let lowerHub = hubs[$CONFIG.lower_hub_id].hub;
    if(upperHub){
      upperHub.disconnect();
    }
    if(lowerHub){
      lowerHub.disconnect();
    }
    reader.close();
  }catch(e){
    console.error(e);
  }finally{
    process.kill(process.pid,'SIGQUIT');
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
  device.on('error',(e)=>{
    console.log(e);
  });
});

