# Hue Components (Level 1)
A specification for interoperable software running on the Philips Hue bridge.

## Motivation
The Philips Hue system is a highly configurable lighting automation system with a brand and API owned and controlled by Signify and hardware primarily manufactured by Signify, with additional hardware manufacturers providing Zigbee-compatible lights, smart plugs, and other devices. A major piece of the Hue system is the Hue bridge which is a small always-on hardware device that provides a way for client devices on ethernet to communicate with lights and other devices that use the Zigbee wireless communication protocol. The Hue bridge contains a rules engine, a scheduling engine, and a small amount of storage to enable complex automation and control of the lighting system without external devices.

Signify have enabled a small ecosystem of third party developers to produce apps for Hue by providing an API based on JSON data and HTTP requests and responses. However, the API is low level and does not reach the level of "components" so each app is currently limited to functionality provided by the developer of that app. Signify have not shown much interest in progressing the API or enabling component-level features, so this specification aims to fill that gap and enable Hue app developers to allow users to configure components written by third parties. A component in this sense is a collection of sensors, rules, schedules, groups, or scenes that can be installed on a Hue bridge that work together to provide a particular coherent set of features for the user.

## Example Components
These are some examples of the kind of components that developers and system integrators might choose to create:
1. A multizone switch: A user would configure the switch with a list of groups (rooms or zones). Turning the switch off would turn all listed groups off. Turning the switch on would turn all listed groups on. Any app could recognize such a switch and let the user hook it up to a physical switch on a control device such as a Hue dimmer switch or create schedules for it.
2. A power managed zone: A user would provide power-management settings for a group (room or zone) that would specify how long that zone should stay lit in the absence of interaction. Any app could recognize such a component and provide a well-labeled interface to allow users to control it.
3. A scene list: A user could configure the component with a set of scenes and the component would provide the ability to track the currently active scene and move through the list. (Imagine separating the scene list from the Hue dimmer switch so it could be shared between dimmers, for example). 

## Levels
This specification is divided in to 2 levels:
1. Level 1: Component metadata describes how to group related sensors together, what possible state values are available for each sensor, and what each value means. Apps that have access to the component metadata can recognize components and group related sensors together in the UI and give users easy control over the state and functionality of the component as held in the sensors.
2. Level 2: Component code implements complete creation and editing of a component's settings and configuration, including manipulating rules and schedules.

This document only covers Level 1. Level 2 is not yet specified.

## Implementing a Hue Component

### A. Store the component on the bridge
Your component will consist of sensors, rules, schedules, groups, and other bridge resources to achieve a particular goal. Create those on the bridge so that your expected feature works.

### B. Describe the component on the bridge
Now you need to add some extra information to the bridge so that conforming apps can discover that a component instance exists on the bridge.

1. Create a `resourcelink`
2. Set `classid` to `9090`
3. Set the `name` of your `resourcelink` to be the name of the instance of your component. (Example: `"Hall"`)
4. Set the `description` of your `resourcelink` to be the name of the type of your component. (Example: `"Power Managed Zone"`)
5. If your component is "tied to" or "contained within" a `group`, include that group as the first `link`. (Example: `"\groups\3"`)
6. If your component is not tied to or contained within a particular `group`, add `"\groups\0"` as your first `link`. (Example: `"\groups\0"`)
7. Include other `groups` related to your component in the `links`.
8. Include any `sensors` controlled by your component in the `links`.
9. Include any `rules` controlled by your component in the `links`.
10. Include any `schedules` controlled by your component in the `links`.

### C. Provide metadata about your component

Provide a JSON description of your component with the following properties: `manufacturer`, `name`, `comment`, `description`, `url`.

Example:

```
{
        manufacturer: "Callionica",
        name: "Power Managed Zone",
        comment: "A room or zone that turns itself off after a period of time",
        description: "A room or zone that turns itself off after a period of time and that has a list of scenes that can be triggered manually or automatically at a certain time. Power managed zones have three power levels: Full Power, Low Power, and Off. The Low Power level gives you a warning that the lights will be turning off, allowing you to take an action to keep the lights on if necessary. Power Managed Zones have custom integrations with dimmers and motion sensors to ensure that all devices work well together in a standard way. Power management can be disabled (temporarily). The timings are all configurable, but examples might be 10 minutes before the zone switches from Full Power to Low Power, 1 minute before the zone switches from Low Power to Off, and 8 hours before the zone re-enables power management automatically.",
        url: "https://github.com/callionica/hue/power-managed-zone.md",
}
```

### D. Provide metadata about your component sensors

Provide a JSON description of your sensor with the following properties: `modelid`, `manufacturername`, `entity`, `property`, `status`.

```
{
        modelid: "PM.Zone.PowerLevel",
        manufacturername: "Callionica",
        entity: "Power Managed Zone",
        property: "Power Level",
        status: [
            { value: PMZ_FULL_POWER, name: "Full power" },
            { value: PMZ_LOW_POWER, name: "Low power" },
            { value: PMZ_OFF, name: "Off" }
        ]
    },
    {
        modelid: "PM.Zone.PowerManagement",
        manufacturername: "Callionica",
        entity: "Power Managed Zone",
        property: "Power Management",
        status: [
            { value: PMZ_ENABLED, name: "Enabled" },
            { value: PMZ_DISABLED, name: "Disabled" }
        ]
    },
    {
        modelid: "PM.Zone.Configurations.Current",
        manufacturername: "Callionica",
        entity: "Power Managed Zone",
        property: "Configurations > Current Configuration"
    },
    {
        modelid: "PM.Zone.Scenes.Current",
        manufacturername: "Callionica",
        entity: "Power Managed Zone",
        property: "Scenes > Current Scene"
    },
    {
        modelid: "PM.Zone.Scenes.Action",
        manufacturername: "Callionica",
        entity: "Power Managed Zone",
        property: "Scenes > Action",
        status: [
            { value: SC_ACTIVATE, name: "Activate", description: "Activate the appropriate version of the current scene for the zone's power state" },
            { value: SC_NEXT, name: "Next", description: "Move to the next scene and activate it" },
            { value: SC_BRIGHTER, name: "Brighter", description: "Make the lighting brighter" },
            { value: SC_DIMMER, name: "Dimmer", description: "Make the lighting dimmer" },
            { value: SC_FULL_POWER, name: "Full power", description: "Activate the full power version of the current scene" },
            { value: SC_LOW_POWER, name: "Low power", description: "Activate the low power version of the current scene" },
            { value: SC_OFF, name: "Off", description: "Turn off the lights" },
        ]
    }
```

## Summary
