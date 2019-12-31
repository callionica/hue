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

