# Thoughts and Experiments with Philips Hue lights from Signify

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
Ikea produces zigbee bulbs and sensors that are compatible with the Hue bridge. My personal experience is that the bulbs are easy to pair with the hub and the sensors and controllers ("steering devices") are not at all easy to pair. I've recently (Nov 2019) failed to pair Ikea dimmer and motion sensors with the Hue bridge. Failing to pair the dimmer switch with the Hue system means that when you pair the dimmer switch with the bulbs, it will steal the bulbs off the Hue network. This makes interop with the Ikea controllers worse than useless. The Ikea bulbs are not as slick as the Hue bulbs (with delays in response) and they (or the Hue hub) have a bug where they brightness doesn't adjust the first time that it's set. Although the Ikea bulbs are cheaper and the Ikea CT bulbs are brighter than Hue bulbs (1000 lm vs 806lm), I wouldn't recommend using them with the Hue hub. If you do use Ikea bulbs with Hue, it'd make sense to only use them in a room that is all Ikea. The Ikea stuff is pretty good for a closet where you just want a motion sensor and a white bulb to turn on and off or where you don't want hub control at all.

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

