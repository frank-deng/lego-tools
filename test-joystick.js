const EvdevReader=require('evdev');
const joystickSearch=new EvdevReader();

console.log('Hint: Press Ctrl-C to exit.\n');

let readers=[];
joystickSearch.search('/dev/input/by-id','event-joystick',(err,files)=>{
  if(err){
    console.error(err);
    return;
  }
  if(!files.length){
    console.error('No joystick found');
    return;
  }

  for(let file of files){
    let joystickName=file.split('/').pop().replace(/-event-joystick$/,'');
    console.log('Joystick found: ',joystickName);
    let reader=(function(joystickName,filePath){
      const reader=new EvdevReader();
      let device=reader.open(filePath);
      device.on('open',()=>{
        console.log('Opened: ',joystickName);
        reader.on("EV_KEY",function(data){
          console.log(joystickName,data.code,data.value);
        }).on("EV_ABS",function(data){
          console.log(joystickName,data.code,data.value);
        }).on("EV_REL",function(data){
          console.log(joystickName,data.code,data.value);
        });
      });
      return reader;
    })(joystickName, file);
    readers.push(reader);
  }
})

