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
