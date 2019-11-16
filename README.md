# Thoughts and Experiments with Philips Hue lights from Signify

Just a bunch of thoughts as I learn:

The Philips Hue API is REST using JSON format requests and responses

To get data from the hub, you need a user ID that you can register or receive from the hub when you request it soon after pushing the physical button on the hub

You can see all the user IDs registered with the hub

The Hue dimmer switch doesn't appear to be limited to a cycle of 10 items - each button press is just incrementing a counter stored in the `state` of the dimmer; a timer resets the `state` back to zero as does hitting the off switch - but it looks like all this is customizable through the API so it seems like the following would be possible:

## A visual turnstile
1. Set the I button to increment `state`; if `state` greater than `x`, change scene/color to red
2. Set the O button to decrement `state`; if `state` less than `x`, change scene/color to white
3. Disable the timer that resets `state`

It's not yet clear to me whether `state` values can be incremented (brightness values can) or whether you would need to define 100 separate rules with fixed values to implement the above. Also not clear what the rule count limits are.

