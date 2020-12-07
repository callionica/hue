# Power Managed Zone (with dimmer and motion sensor support)

## Use Cases

Turns off the lights automatically - even if you don't have a motion detector.

You control how long the lights should stay on.

Puts lights in a low power mode before turning them off. The low power mode is a scene configured by you - choose whatever lighting scheme you like for low power mode.

You control how long low power mode should last - use a short low power duration if you want a brief warning before the lights go out, or use a long low power duration if you think of low power as the default setting for the lights. For example, to welcome guests to your home, you might put outdoor lights on a long low power time while keeping full power to a brief period triggered by a motion sensor.

Power management is great most of the time, but we've also made it easy to disable power management so that your lights stay on until you turn them off. You can be sure that they'll never turn off during a party.

Similarly, if you want to keep your lights off when you're airing your house out on a late summer evening, you don't have to disconnect motion sensors or do anything complicated to handle that. Disabling power management automatically adjusts motion sensors so that motion will keep lights on if the lights are already on, but it won't turn the lights on if they're off.

And power management is re-enabled automatically so you don't have to remember to do it.

Every property and setting of the power managed zone can be easily scheduled to change at a particular time.

The full power scene and low power scene can be scheduled too, so your lights will come on with exactly the scene you want for a particular time of day.

Works with multiple dimmers and motion sensors without any complicated setup. Any of the sensors can turn on the lights and any of them can keep on the lights. Turning off the lights is handled by the zone, not the sensor, so there's no possibility for one of the motion sensors to turn off the lights while they're still in use. Any button press, just like any motion, extends the timeout to keep the lights on.

Configuring a new dimmer or motion sensor to work with a power managed zone is a snap: pick the sensor, pick the zone, and you're done.

All the buttons for the dimmer switch are mapped to useful features of your power managed zone: you can turn it on or off, brighten or dim it, cycle through the scenes, and even enable and disable power management. We've added some subtle touches to the experience: tapping any of the buttons on the dimmer will turn the zone on if it's off.

Dimmer switches can be disabled individually from the your Hue bridge's component control panel. If the kids keep messing with a particular dimmer switch or you want to prevent visitors to your home from changing the lighting without removing the physical switches, you can do that now.

Motion sensors can be tricky to set up. We've made it that much easier by giving each motion sensor the responsibility to help keep on the lights, while removing the responsibility for turning off the lights. It's the power managed zone that decides when to turn off the lights using information from all of the motion sensors and dimmer switches that are connected to the zone.

Each motion sensor can be configured to turn on the lights, or to only keep on the lights if they're already on. This is great in two situations.

The first is where you really want it to be a conscious decision to turn on the lights so you don't want motion to trigger new lights. Perhaps you have a sleeping infant in the room and you want to make sure that lights are turned on intentionally. With a power managed zone, you still get the benefit of that motion detector helping you keep the lights on once you've turned them on, but you take away the risk that you'll wake up your baby. Or perhaps you have pets in your home. You may be happy to have the motion of pets help you keep on your lights, but you don't want your pets to be able to turn on lights all by themselves.

The second situation is where you have a large space and you need multiple motion sensors to cover all the area, but the sensor at one end of the area also picks up some activity outside the zone. In that case, it can be useful to configure that motion sensor to only keep on lights if they're already on, and leave the other sensor to turn on the lights. If you have trouble isolating your motion sensor from activity that shouldn't turn on the lights, you can still use it to keep the lights on.


