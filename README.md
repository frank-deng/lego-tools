LEGO Tools
==========

Control LEGO 42099 via joystick.

Commands
--------

|Command|Description|
|-------|-----------|
|`npm start`|Start main program.|
|`npm run calibrate`|Same as `npm start`, while steering calibration will be done during initialization.|
|`npm run test-joystick`|Get joystick name, axis name, button name, etc. of your joysticks.|
|`npm run detect-hubs`|Get ID, name, battery level of detected LEGO hubs, useful when you have to specify which hub ID to connect.|

Configuration
-------------

`config.json` can be found at the root folder of this repository, following are comments for all the configuration items:

	{
	  "joystick":null,    //Specify joystick name. Leave it null if only one joystick is connected.
	  "hubId":null,       //Specify the hub ID to connect. Leave it null when you have only one LEGO hub available.
	  "steer":{
	    "axis":"ABS_X",   //Specify the joystick axis used for steering
	    "reverse":false   //Specify whether the joystick axis should be reversed
	  },
	  "throttle":{
	    "axis":"ABS_RZ",  //Specify the joystick axis used for throttle
	    "reverse":false   //Specify whether the joystick axis should be reversed
	  },
	  "brakeButton":"BTN_START"  //Specify the joystick button used for stopping all the motors and reverting steering to middle position
	}

TODO
----

* Use `process.exit()` always hangs, and I haven't figured out why. `SIGKILL` is used to terminate the program at present.

