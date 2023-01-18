# Thoughts and Experiments with Philips Hue lights from Signify

## Discovery
This URL is likely to be able to find info on a Hue bridge from Safari on a Mac (as long as you trust the self-signed certificate):

https://philips-hue.local/api/unauthenticated/config

Also try either of these:

https://philips-hue.local/description.xml

http://philips-hue.local/description.xml

You might be able to find IP addresses or MAC addresses of bridges like this:

```
arp -a | grep -F "ec:b5:fa:"
```

This dumps recent routes to devices that begin with Philips' MAC address prefix.

The Hue Bridge uses [mDNS](https://developers.meethue.com/develop/application-design-guidance/hue-bridge-discovery/#mDNS).

Command to list Hue bridges: `dns-sd -B _hue._tcp .`

Command to resolve Hue bridges: `dns-sd -L "Philips Hue - 231268" _hue._tcp .` where the stuff in  quotes is a name provided by the previous command.

The names contain the last 6 digits of the Bridge ID.

This resolves to a host name of "philips-hue". Host names use the name of the bridge set by the user (but only sometimes?!?!)

## Starting

Just a bunch of thoughts as I learn:

The Philips Hue API is REST using JSON format requests and responses

To get data from the hub, you need a user ID that you can register or receive from the hub when you request it soon after pushing the physical button on the hub

You can see all the user IDs registered with the hub

The Hue dimmer switch doesn't appear to be limited to a cycle of 10 items - each button press is just incrementing a counter stored in the `state` of the dimmer; a timer resets the `state` back to zero as does hitting the off switch - but it looks like all this is customizable through the API so it seems like the following would be possible:

## A visual turnstile
1. Set the I button to increment `state.status`; if `state.status` greater than `x`, change scene/color to red
2. Set the O button to decrement `state.status`; if `state.status` less than `x`, change scene/color to white
3. Disable the timer that resets `state.status`

It's not yet clear to me whether `state` values can be incremented (brightness values can) or whether you would need to define 100 separate rules with fixed values to implement the above. Also not clear what the rule count limits are.

ANSWERS: The API doesn't appear to support incrementing a counter (a `state.status` field in a `CLIPGenericStatus` sensor), as a result, it takes a bunch of rules to support incrementing/decrementing. This is worth doing for low numbers of items, but wouldn't work for a visual turnstile, since you need 2 rules (increment & decrement) for each number. (40 rules to count to 20).

## Sensors

You can create sensors using the API. You can think of CLIPGenericStatus and CLIPGenericFlag as representations of real sensors that communicate with the Hue hub over IP, or you can think of them as numbers and Booleans that you can use to simplify logic that runs on the hub.

## Rules
This comment (https://github.com/dresden-elektronik/deconz-rest-plugin/issues/98#issuecomment-326681617) was incredibly useful in understanding how rules are triggered. The upshot is:

Rules are triggered when one of the conditions changes from false to true; the remaining conditions are evaluated and if all are true, the actions are scheduled for execution.

You *can* detect changes in a boolean using the `dx` operator. Note the difference between using `dx` on `state.flag` vs `state.lastupdated`. The second will act as a trigger even if `state.flag` remains unchanged.

Values in rules are always strings.

## dx and ddx
`dx` is true instantly when the specified value changes; `ddx` is true a fixed amount of time after the specified value changes. Using `ddx` in rules means you can avoid creating a bunch of timers to handle logic I guess.

## Ikea bulbs and sensors
Ikea produces zigbee bulbs and sensors that are compatible with the Hue bridge. My personal experience is that the bulbs are easy to pair with the hub and the sensors and controllers ("steering devices") are not at all easy to pair. I've recently (Nov 2019) failed to pair Ikea dimmer and motion sensors with the Hue bridge. Failing to pair the dimmer switch with the Hue system means that when you pair the dimmer switch with the bulbs, it will steal the bulbs off the Hue network. This makes interop with the Ikea controllers worse than useless. The Ikea bulbs are not as slick as the Hue bulbs (with delays in response) and they (or the Hue hub) have a bug where the brightness doesn't adjust the first time that it's set. Although the Ikea bulbs are cheaper and the Ikea CT bulbs are brighter than Hue bulbs (1000 lm vs 806lm), I wouldn't recommend using them with the Hue hub. If you do use Ikea bulbs with Hue, it'd make sense to only use them in a room that is all Ikea. The Ikea stuff is pretty good for a closet where you just want a motion sensor and a white bulb to turn on and off or where you don't want hub control at all.

## Software sensors, testing, simulation
As long as you don't run out of resources on the hub (which is limited in # of sensors, rules, etc), it seems like setting up virtual sensors, master switches, and rules triggered off changes to them is a sensible way to set things up. None of the Hue apps support this model though (although they create special case sensors and rules). For example, these kind of virtual sensors could be useful:
1. Presence sensors that indicate presence within a zone and that have rules to update a Presence sensor for a parent zone. Switches and motion detectors can all update the presence sensors.
2. LightLevel sensor that indicates dawn, daylight, dusk, night whose value can be fed by the hub daylight sensor and the light level sensor from a motion detector
3. Travel: Arriving/Leaving/GuestsArriving/GuestsLeaving
4. Mood: Work/Relaxation/Party

Presence and LightLevel determine whether internal lights should be on or off.
Travel and LightLevel determine whether external lights should be on or off.
Mood and LightLevel determine what the brightness/color of light should be.

## Can you update the conditions in a rule using a schedule?
Someone said: "especially since the API does not allow to change single values, you always have to PUT the entire {conditions} element…:"

## Can you update the light settings in a scene using a rule?
A single action can change the settings for a single light in a scene, but perhaps not more than one light at a time because the payload is too large.

```
{
      "address": "/scenes/${sceneID}/lightstates/${lightID}",
      "body": {
         "bri": 254,
         "ct": 156,
         "on": true
      },
      "method": "PUT"
   }
```

## Time-based lights
There's a Hue Labs formula that updates lighting at different times of the day. It seems to work like this:
1. There's a status sensor called "daypart" that corresponds to the time segments
2. There are scheduled changes that update daypart at the appropriate time
3. There's a custom light group that contains all the lights that have been configured to change in the Hue app
4. There's a rule for each time period that triggers when all the lights in the custom light group are on and sets the group to the appropriate scene for the daypart setting
5. There's also a similar rule for each time period that triggers when the "Play and stop" sensor is updated to 1
6. The scenes  are created by the formula during setup and there are different scenes for "Play and stop" rules (no explicit transitiontime) and the all_on rules (transitiontime: 600)

The implication seems to be that you need multiple instances of this Hue labs formula for different logical groups of lights otherwise the all_on part of the rule will confound expectations. The UI allows you to select multiple rooms, but only one zone so this is a little confusing if you've picked multiple rooms.

## Jason Bourne music and Still of the Night by Whitesnake
Does the music from the Bourne movies sound like the strings from Whitesnake's "Still of the Night"?

## Philips Hue Motion Sensor
The Hue motion sensor is really stingy with its events. If you trigger motion, it will set presence to true and update lastupdated fairly quickly, but if you continue moving in front of the sensor, none of its properties will change. You can keep moving for multiple minutes and there will be no further changes to the motion sensor properties so no triggers or events will fire. This becomes a problem in the following scenario: you have a light controlled by a switch and a motion sensor. You turn off the light with the switch while the motion sensor is detecting your presence, then you change your mind and want to turn the light on using the motion sensor. You keep moving and waving at the sensor, but nothing happens (because the motion sensor is still in the presence == true state). To reenable the motion sensor (without additional rules on the bridge), you have to stay still long enough for the motion sensor to set presence to false and then move again. Because it takes a while for the sensor to switch presence to false after motion stops, this is a bad experience. I was expecting the motion sensor to periodically update lastupdated so that I could use that as a trigger to reenable the lights. It doesn't do that, so you have to set up your own time-based events using a timer or ddx to get things working. This is also a problem when expecting to use the motion sensor to prolong a timeout: no events means the timeout doesn't get prolonged and the light gets switched off. Counter-intuitively under these conditions continuous movement is worse than periodic movement and stillness.

The thing to accept is that the motion detector as exposed by Philips through the API is not a bursty, event-providing device that lets you know each time motion is detected; it's a low information package hiding Philips' own logic that tells you only whether there's a living presence there. It doesn't expose the delay periods used to smooth over its motion detecting foundation, so it's an exercise in frustration trying to treat it like a motion detector when Philips have decided it's a presence sensor.

Because the number of motion detector events is low, for power managed zones, we have to stop thinking of using the motion detector to prolong the timeout to *prevent* a low power state; instead we use the transition into the low power state as the trigger for logic that checks the state of the motion detector and bumps up to full power again if it detects a presence. This is what users do manually with a switch: when they see the lights change in low power mode, they hit the switch to bump it to full power again. The key insight to having things work smoothly is that we delay the visual change triggered by entering the low power state by just 1 second so that any motion detector or other automation has a chance to bump up to full power before users notice the change. This bumping up from low power state to full power state can be handled by any number of switches and motion sensors without coordination between them, so no need for reference counting.

There are a few tricky cases to deal with when using a motion detector and switch in the same room:
1. Presence is detected, user turns light off with switch and leaves room
2. Presence is not detected, user turns light off with switch and leaves room
3. Presence is detected, user turns light off with switch, changes mind and tries to turn on with motion
4. Presence is not detected, user turns light off with switch, changes mind and tries to turn on with motion

Comments:
1. Nothing to do. Next expected event would be presence == false so no change to lights
2. Problem. User likely to trigger motion detector.
3. Problem. Already in presence == true state so no event caused by motion.
4. Nothing to do. Motion causes a state change from presence == false to presence == true that we can react to.

For C2, we could temporarily turn off the motion detector. The problem is that confounds C4. In addition, it *seems* like the sensor is sensing and using its internal logic even when disabled, so presence can move to true internally, the person can leave the room, the sensor is enabled and immediately reports presence as true because of the timeout (testing to confirm).

For C3, we could manufacture a later event to check for presence. The problem there is that if we fire our event too early, we pick up the delayed reading from the sensor even after the person has left. If we fire the event too late, the user has been waving their arms for ages trying to get the lights to come on.

What we need is for disabling the sensor to reset all its internal timeouts so that it only reports a presence after it comes back on if it actually sees motion after it comes back on. Initial testing suggests its not doing that though. Perhaps we can manually set the presence state of the motion sensor to false on the bridge from a rule? Haven't tried that. If that's allowed, it could work if we don't use presence == false as a trigger in any rules (which we don't).

## Patterns
It's useful to be able to provide actions to enhance hardware sensors or to support software sensors. All actions for a component can be provided by a single status sensor and accompanying rules. It's unnecessary to provide a different status sensor for each action. Actions are useful for customizability, readability, etc. They can be useful when using schedules which can trigger only a single command: if you would otherwise trigger multiple commands, instead create an action that triggers those commands and have the schedule trigger the action.

## Does the Hue bridge store/restore the state of generic sensors when the bridge loses power?
Yes, a quick experiment of pulling the power cable from a v2 (square) Hue bridge (SW Version 1935144020, API Version 1.35.0) for a short period of time suggests that the Hue bridge does persist the state of generic status and generic flag sensors so that they come back with the same values after power is removed and then restored. This is useful behavior! If they came back with different values, it would affect the values that you would choose to represent on/off states for example.

## all_on, any_on, reachable
Lights have boolean properties `on` and `reachable`. Groups have boolean properties `all_on` and `any_on`. `all_on` and `any_on` are just a summary of the lights' `on` properties and do not take into account whether they are `reachable`. A light in a reliable network will have `reachable == false` only when it has lost power (switched off at the wired switch, for example). If you wish to automate a network where lights are likely to be switched off at the switch or if you wish to account for power cuts, you cannot use only the `on` property, you must also take into account the `reachable` property. Because the groups' `all_on` and `any_on` properties do not take the `reachable` property of the lights into consideration, you should be careful how you use these properties.

## Tips
1. Give your Hue bridge a static IP address
2. Get adaptors for different bulb socket types: B22 to E27, E27 to B22, and GU10 to E27 are useful in the UK. DiCuno adapters are about £7 for 6. It's not ideal to use an adapter because it lengthens bulbs of the same overall shape, but it also gives you a lot of flexibility, shortens the bulb if you can use a GU10 instead of an E27, and you can take advantage of bulb & fixture sales.
3. Write down the "Serial No." printed on the bulb of every Hue bulb you get

## Can CLIPGenericStatus sensors store custom data on the bridge?
Doesn't look like you can store arbitrary custom data in the `config` section.
You don't get an error if you attempt to store a value from `0` to `255` in `config.battery`, but the returned result from the API is `config.battery: null`, so doesn't work for storing data.

## Patterns of Control
Using the Hue Dimmer switch with four buttons, we can see a pattern that can make a complex control system easier to understand:
1. The ON switch handles multiple presses where each press turns on a wider area of lights
2. The OFF switch handles multiple presses where each press turns off a wider area of lights
3. The DIMMER switch turns off lights, but not in the current room
4. The BRIGHTER switch controls mood/scenes in the current room

The ON/OFF/DIMMER switches should control the same set of lights/rooms/zones, but not necessarily with the same number of button presses.

For example, for a switch in the Living Room, ON/OFF controls:
1. The living room lights
2. The kitchen lights (adjacent room)
3. The hall and outdoor lights (adjacent rooms)
and DIMMER controls:
1. The kitchen lights and hall
2. The outdoor lights
