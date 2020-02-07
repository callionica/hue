# Hue Bluetooth FAQ

This FAQ covers questions related to the Bluetooth functionality of Philips Hue bulbs.

### Can a BT bulb be added to the Hue bridge before pairing it to a Bluetooth device?
Yes. BT bulbs can be added to the Hue bridge in the normal ways.

### Can a BT bulb be added to the Hue bridge after pairing it to a Bluetooth device?
Yes. BT bulbs can be added to the Hue bridge in the normal ways even after pairing with a Bluetooth device. The iOS app also has a software feature "Add Hue Bridge" that can transfer information about the lights to the bridge.

### Can a BT bulb be Bluetooth-paired to a phone before it has been added to a Hue bridge?
Yes.

### Can a BT bulb be Bluetooth-paired to a phone after it has been added to a Hue bridge?
Yes.

### Can a BT bulb be controlled by Bluetooth after it has been added to a Hue bridge?
Yes. It requires the device to go through Bluetooth pairing using the Hue BT app. The control mechanisms are separate.

### Can a BT bulb be controlled by the Hue bridge after it has been Bluetooth-paired?
Yes. It requires the device to be added to the Hue bridge. The control mechanisms are separate.

### Can the Hue BT iOS app be used without providing an email address?
No. There's no way to skip the page that asks for an email address. In addition, if you transfer your Bluetooth lights to a Hue bridge, it will remove from the app the lights that were registered and the fact that you registered an email address so you'll have to provide it again. (Hue Bluetooth iOS app Version 1.13).

### Can a BT bulb be paired/added to the Hue BT iOS app using the Serial No printed on the bulb?
No. The Hue BT iOS app has no way to provide the serial number or other information to target a particular bulb.

### Can a BT bulb be controlled using Bluetooth from outside the room?
Depends on the size of the room and what the walls are made of, but Yes. The Verge said "within 30 feet".

### Does the Hue BT iOS app allow you to assign lights to rooms or otherwise create groups of lights?
No. (Hue Bluetooth iOS app Version 1.13) The Hue BT iOS app is limited compared to the full-featured Hue iOS app that works with the Hue bridge. Google Home and Alexa can control Hue BT lights over Bluetooth and allow you to assign them to rooms.

### Does the Hue BT iOS app allow you to create schedules to change lights at specific times?
Not exactly, but almost. You can create routines that run at a particular time or with a particular delay, but each routine runs only once then has to be re-enabled in the Hue Bluetooth app. It's not a full scheduling system with recurring timed events. (Hue Bluetooth iOS app Version 1.13, but not earlier)

The Hue Bluetooth app version 1.13 released Feb 3rd 2020 introduces *routines* to Bluetooth-controlled lights using the Hue Bluetooth app. There is also an associated bulb firmware update to support the new features. Based on initial experiments the firmware update is required because the routine is stored in the bulb itself. (Tested by setting a countdown timer then turning off the phone used to set the timer).

You can now click a clock button in the toolbar to access "Routines".

When creating a new routine, you have a choice of 3 kinds: "Wake up", "Go to sleep", and "Timer". For all kinds of routine, you pick a single light then configure the remaining settings. 

#### Wake up
1. Fade in for: 10, 20, or 30 minutes
2. Until: a clock time

#### Go to sleep
1. Go to sleep at: Button press or Time
2. Fade out for: 10, 20, or 30 minutes

#### Timer
1. Set timer for: Countdown or Specific time
2. When timer runs out: Flash, On, Off, Custom (specific colour/brightness)

If you create a "Go to sleep" routine that is triggered by a button press or a "Timer" that uses a countdown, you get a routine added to your list that has a PLAY button. If you create other routines that are triggered at particuar times, you get a routine added to your list that has an ON/OFF button.

When routines start to run, the entry for the routine in the app says "Started at 7:15" or whatever time it started at.
Watch out for times when experimenting: if the "Wake up" routine has a headline time of "7:25" and a fade in time of 10 minutes, the action actually starts at 7:15. If the bulb is off at 7:15 or the schedule has not been created by 7:15, it's not going to run.

When a routine starts running, it disables itself, so you need to click again to get it to run again. The Hue Bluetooth app doesn't yet appear to provide recurring scheduled events.

### Can a single bulb be controlled by multiple iOS devices?
Yes. You can connect any iOS device to the bulb and multiple devices can control the bulb without re-pairing. Apparently there is a 15 device limit per bulb. I don't know what happens when that limit is reached.

### Can you prevent people pairing with Hue BT bulbs?
Not exactly. According to Philips Hue support on Twitter (https://twitter.com/tweethue/status/1213478944739119104), Bluetooth pairing is only possible within 30 minutes of a power cycle of the bulb from a device within 1 meter or 3 feet of the bulb, so if you can be sure of keeping your bulbs powered, people can't pair with them.

### Does the Hue BT app allow you to rename bulbs?
Yes. In addition, the name that you give the bulb appears to be stored externally to the app (probably in the bulb itself) so that when other devices connect to the bulb over Bluetooth, they see the new name. If you transfer your Bluetooth bulbs to a Hue bridge, the names of the bulbs on the bridge match the names that you gave the bulbs in the Hue Bluetooth app.

### Does the Hue BT app help you set up a Hue bridge?
Yes. The Hue Bluetooth app is useful even if you never intend to use the Bluetooth functionality of the bulbs in normal use. When you add a light to a Hue bridge, you typically need to have the bridge and the bulb in close proximity to each other. This can be challenging since the bridge is tied by two wires: power and ethernet. The distance requirement is similar when setting up Bluetooth: you need the device running the Hue Bluetooth app to be close to the bulb. The difference is that the device is usually a phone with no wires so it can be easier to put it close to the bulb. Once you have done Bluetooth setup, you can transfer all the lights to the Hue bridge. This is particularly useful for existing setups where you need to factory reset the bridge, or replace a bridge, or add a new bridge using installed bulbs and where you don't have the serial numbers to hand. You can get your phone close to the bulbs without needing to pull them out, do the Bluetooth setup, then transfer all the lights to the Hue bridge using the Hue Bluetooth app.


