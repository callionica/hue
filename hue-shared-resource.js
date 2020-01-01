"use strict";


// Hope this works!
export function uuid() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

// Component classid for use in resourcelinks
const COMPONENT_CLASSID = 9090;

// Dimmer constants
const BTN_initial_press = 0;
const BTN_repeat = 1;
const BTN_short_release = 2;
const BTN_long_release = 3;

const BTN_ON = 1000;
const BTN_STAR_UP = 2000;
const BTN_STAR_DOWN = 3000;
const BTN_OFF = 4000;

function describeButtonGesture(gesture) {
    switch (gesture) {
        case BTN_initial_press:
            return "Initial press";
        case BTN_repeat:
            return "Repeat";
        case BTN_short_release:
            return "Short release";
        case BTN_long_release:
            return "Long release";
        default:
            return "Unknown";
    }
}

function describeButtonItself(gesture) {
    switch (gesture) {
        case BTN_ON:
            return "On";
        case BTN_STAR_UP:
            return "Big star";
        case BTN_STAR_DOWN:
            return "Little star";
        case BTN_OFF:
            return "Off";
        default:
            return "Unknown";
    }
}

function describeButton(value) {
    var button;
    if (value >= BTN_OFF) {
        button = BTN_OFF;
    } else if (value >= BTN_STAR_DOWN) {
        button = BTN_STAR_DOWN;
    } else if (value >= BTN_STAR_UP) {
        button = BTN_STAR_UP;
    } else if (value >= BTN_ON) {
        button = BTN_ON;
    } else {
        return { button: "Unknown", gesture: "Unknown" };
    }
    const gesture = value - button;
    return { button: describeButtonItself(button), gesture: describeButtonGesture(gesture) };
}

// Power Managed Zone constants
const PMZ_OFF = 0;
const PMZ_LOW_POWER = 1;
const PMZ_FULL_POWER = 2;

const PMZ_DISABLED = 0;
const PMZ_ENABLED = 1;

// Scene Cycle constants
const SC_NEXT = 1001;        // Move to the next scene and activate it
const SC_BRIGHTER = 1011;    // Make the scene brighter
const SC_DIMMER = 1021;      // Make the scene dimmer
const SC_OFF = 2000 + PMZ_OFF;              // Turn off the lights
const SC_LOW_POWER = 2000 + PMZ_LOW_POWER;  // Activate the low power version of the current scene
const SC_FULL_POWER = 2000 + PMZ_FULL_POWER;// Activate the full power version of the current scene
const SC_ACTIVATE = 2000 + 100;             // Activate the appropriate version of the current scene for the zone's power state

// Motion sensor constants
const PMM_DO_NOTHING = 0;
const PMM_KEEP_ON = 1;
const PMM_TURN_ON = 2;

const PMM_ACTIVATE = 2000 + 100; // Activate according to the motion sensor activation setting

// Sleeping 11PM-7AM, Waking 7AM-8AM, Working 8AM-4PM, Relaxing 4PM-11PM

// A power managed zone is:
// 0. Config: Low power after period A
// 0. Config: Turn off after further period B
// 1. A ClipGenericStatus sensor that represents on(2)/lowpower(1)/off(0)
// 2. A rule: status == on(2) and lastupdate ddx A, change status to lowpower(1)
// 3. A rule: status == lowpower(1) and status ddx B, change status to off(0)
// 4. A ClipGenericFlag sensor to represent enabled state of power management
// Keep light in current state and ignore timer by setting flag to false
// Turn light on (or keep it on & reset timer) by setting status to on(2)
// Go to power saving (but not reset timer if already power-saving) by setting status to lowpower(1)
// Turn light off by setting status to off(0)
// For changes:
// A rule: status == on(2) to change light state
// A rule: status == lowpower(1) to change light state
// A rule: status == off(0) to change light state

// Low power state is useful as a visual aid even if only interested in turning off because it gives users a chance to boost power again.

// To use with a motion sensor or switch:
// A. Motion or switch turns zone on, zone turns itself off
// B. Switch can also turn zone to lowpower or off

// To use with motion sensor & override switch:
// A. Motion turns zone on
// B. Switch turns zone on and disables power management
// C. Switch turns zone off and enables power management

// How to deal with different timeouts like 1 min day & 5 mins night?

// A shared resource is:
// 1. A ClipGenericStatus sensor which represents the number of users
// 2. A ClipGenericFlag sensor that can be used to trigger an increment of the user count
// 3. A ClipGenericFlag sensor that can be used to trigger a  decrement of the user count
// 4. N rules that increment/decrement the user count in response to the triggers (where N is the maximum number of users).
// 5. N ClipGenericFlag sensors: one for each potential user indicating whether they are using the resource or not
// 6. 2N rules that fire the triggers to update the user count on the shared resource (2 rules for each user sensor: one to increment the shared count, one to decrement it)
// 7. A ClipGenericFlag sensor that can be used as an override to switch all the user sensors off or on

// There are so many rules because the Hue hub does not have an action for incrementing or decrementing an integer. The triggers are here so that the rules only need to be implemented once (and not once for each user; with the triggers we have N + 2N rules; without the triggers we'd have 2N^2 rules; if increment was implemented natively, we'd have 2N rules)

// An example of a shared resource is lighting in a hallway
// You want the lights in the hallway to remain on while there is anyone using or intending to use the hallway and you want the lights to turn off when there's no one using it
// You achieve this by removing the ability to directly turn on and turn off lights in the hallway from users and instead give them the ability to say that they are using or not using the hallway. Rules turn on the lights when the hallway is in use and turn off the lights when it's no longer in use.
// This gets rid of any confusion around motion detection and multiple users
// The motion detector is just another user who can let the hallway know it's being used, but is not responsible for turning lights off

export async function create(method, address, body) {
    var json;
    try {
        const result = await fetch(address, { method, body });
        json = await result.json();
    } catch (e) {
        console.log(body);
        console.log(e);
        throw { body, e };
    }

    if (Array.isArray(json) && (json.length === 1) && json[0].success) {
        return json[0].success.id;
    }

    console.log(body);
    console.log(json);
    throw { body, json };
}

export async function createSensor(connection, body) {
    const address = `https://${connection.hub}/api/${connection.app}/sensors`;
    const method = "POST";

    return create(method, address, body);
}

export async function createSchedule(connection, body) {
    const address = `https://${connection.hub}/api/${connection.app}/schedules`;
    const method = "POST";

    return create(method, address, body);
}

export async function createRule(connection, body) {
    const address = `https://${connection.hub}/api/${connection.app}/rules`;
    const method = "POST";

    return create(method, address, body);
}

export async function createResourceLink(connection, body) {
    const address = `https://${connection.hub}/api/${connection.app}/resourcelinks`;
    const method = "POST";

    return create(method, address, body);
}

export async function deleteRule(connection, id) {
    const address = `https://${connection.hub}/api/${connection.app}/rules/${id}`;
    const method = "DELETE";
    return fetch(address, { method });
}

export async function deleteResourceLink(connection, id) {
    const address = `https://${connection.hub}/api/${connection.app}/resourcelinks/${id}`;
    const method = "DELETE";
    return fetch(address, { method });
}

export async function deleteSensor(connection, id) {
    const address = `https://${connection.hub}/api/${connection.app}/sensors/${id}`;
    const method = "DELETE";
    return fetch(address, { method });
}

export async function deleteSchedule(connection, id) {
    const address = `https://${connection.hub}/api/${connection.app}/schedules/${id}`;
    const method = "DELETE";
    return fetch(address, { method });
}

export async function getCategory(connection, category) {
    const address = `https://${connection.hub}/api/${connection.app}/${category}`;

    var json;
    try {
        const result = await fetch(address);
        json = await result.json();
    } catch (e) {
        console.log(e);
        throw { body, e };
    }

    return json;
}

export async function getAllCategories(connection) {
    return getCategory(connection, "");
}

// More useful to have an array of objects
export async function getCategory_(connection, category) {
    return Object.entries(await getCategory(connection, category)).map(([id, value]) => { return { id, ...value }; });
}

export async function getRules(connection) {
    return getCategory_(connection, "rules");
}

export async function getSchedules(connection) {
    return getCategory_(connection, "schedules");
}

export async function getAppSchedules(connection) {
    return (await getSchedules(connection)).filter(schedule => schedule.command.address.startsWith(`/api/${connection.app}/`));
}

export async function getGroups(connection) {
    return getCategory_(connection, "groups");
}

export async function getScenes(connection) {
    return getCategory_(connection, "scenes");
}

export async function getScene(connection, groupID, name) {
    console.log(name);
    const scenes = await getScenes(connection);
    const result = scenes.filter(scene => scene.group === groupID && scene.name === name)[0].id;
    return result;
}

export async function getResourceLinks(connection) {
    return getCategory_(connection, "resourcelinks");
}

export async function getSensors(connection) {
    return getCategory_(connection, "sensors");
}

export async function getLights(connection) {
    return getCategory_(connection, "lights");
}

export async function getDimmers(connection) {
    const sensors = await getSensors(connection);
    return sensors.filter(sensor => sensor.productname === "Hue dimmer switch");
}

export async function getMotionSensors(connection) {
    const sensors = await getSensors(connection);
    return sensors.filter(sensor => sensor.productname === "Hue motion sensor");
}

export async function touchlink(connection) {
    const address = `https://${connection.hub}/api/${connection.app}/config/`;
    const body = `{"touchlink": true}`;
    const method = "PUT";
    var json;
    try {
        const result = await fetch(address, { method, body });
        json = await result.json();
    } catch (e) {
        console.log(body);
        console.log(e);
        throw { body, e };
    }

    if (Array.isArray(json) && (json.length === 1) && json[0].success) {
        return json;
    }

    console.log(body);
    console.log(json);
    throw { body, json };
}

export async function deleteAppRules(connection) {
    const rules = await getRules(connection);

    for (const rule of rules) {
        if (rule.owner === connection.app) {
            await deleteRule(connection, rule.id);
        }
    }
}

export async function deleteDescriptionSchedules(connection, description) {
    const schedules = await getSchedules(connection);

    for (const schedule of schedules) {
        if (schedule.description === description) {
            await deleteSchedule(connection, schedule.id);
        }
    }
}

export async function deleteAppSchedules(connection) {
    const schedules = await getAppSchedules(connection);

    for (const schedule of schedules) {
        await deleteSchedule(connection, schedule.id);
    }
}

export async function deleteManufacturerSensors(connection, manufacturer) {
    const sensors = await getSensors(connection);

    for (const sensor of sensors) {
        if (sensor.manufacturername === manufacturer) {
            await deleteSensor(connection, sensor.id);
        }
    }
}

export async function deleteAppSensors(connection) {
    return deleteManufacturerSensors(connection, connection.app);
}

export async function deleteAppLinks(connection) {
    const links = await getResourceLinks(connection);

    for (const link of links) {
        if (link.owner === connection.app) {
            await deleteResourceLink(connection, link.id);
        }
    }
}

export async function registerApp(hub, appName, user) {
    user = user || "";
    const address = `https://${hub}/api/`;
    const body = `{"devicetype": "${appName}#${user}"}`;
    const method = "POST";
    let json;
    try {
        const result = await fetch(address, { method, body });
        json = await result.json();
    } catch (e) {
        console.log(body);
        console.log(e);
        throw { body, e };
    }

    if (Array.isArray(json) && (json.length === 1) && json[0].success) {
        return { hub, app: json[0].success.username };
    }

    console.log(body);
    console.log(json);
    throw { body, json };
}

export async function connect(hub, appName) {
    const key = "hue-connection:" + hub;
    const json = localStorage.getItem(key);
    var connection;
    if (json) {
        connection = JSON.parse(json);
        if (connection && connection.hub === hub) {
            return connection;
        }
    }

    connection = await registerApp(hub, appName);

    localStorage.setItem(key, JSON.stringify(connection));

    return connection;
}

// =============================

function statusSensorBody(name, model, value) {
    value = value || 0;
    const body = `{
        "name": "${name}",
        "state": {
            "status": ${value}
        },
        "config": {
            "on": true,
            "reachable": true
        },
        "type": "CLIPGenericStatus",
        "modelid": "${model}",
        "manufacturername": "Callionica",
        "swversion": "1.0",
        "uniqueid": "${uuid()}",
        "recycle": false
    }`;
    return body;
}

function flagSensorBody(name, model, value) {
    const body = `{
        "name": "${name}",
        "state": {
            "flag": ${value}
        },
        "config": {
            "on": true,
            "reachable": true
        },
        "type": "CLIPGenericFlag",
        "modelid": "${model}",
        "manufacturername": "Callionica",
        "swversion": "1.0",
        "uniqueid": "${uuid()}",
        "recycle": false
    }`;
    return body;
}

function isPresent(id) {
    return `{
        "address": "/sensors/${id}/state/presence",
        "operator": "eq",
        "value": "true"
    }`;
}

function isEqual(id, value) {
    const store = (typeof value === "boolean") ? "flag" : "status";
    return `{
        "address": "/sensors/${id}/state/${store}",
        "operator": "eq",
        "value": "${value}"
    }`;
}

function isChanged(id, store) {
    return `{
        "address": "/sensors/${id}/state/${store}",
        "operator": "dx"
    }`;
}

function isUpdated(id) {
    return `{
        "address": "/sensors/${id}/state/lastupdated",
        "operator": "dx"
    }`;
}

function isChangedTo(id, value) {
    const store = (typeof value === "boolean") ? "flag" : "status";
    return `${isEqual(id, value)},
    ${isChanged(id, store)}`;
}

function isUpdatedTo(id, value) {
    return `${isEqual(id, value)},
    ${isUpdated(id)}`;
}

function wasChangedTo(id, value, hms) {
    const store = (typeof value === "boolean") ? "flag" : "status";
    return `${isEqual(id, value)},
    {
        "address": "/sensors/${id}/state/${store}",
        "operator": "ddx",
        "value": "PT${hms}"
    }`;
}

function wasUpdatedTo(id, value, hms) {
    const store = (typeof value === "boolean") ? "flag" : "status";
    return `${isEqual(id, value)},
    {
        "address": "/sensors/${id}/state/lastupdated",
        "operator": "ddx",
        "value": "PT${hms}"
    }`;
}

function notUpdatedSince(id, value, hms) {
    const store = (typeof value === "boolean") ? "flag" : "status";
    return `${isEqual(id, value)},
    {
        "address": "/sensors/${id}/state/lastupdated",
        "operator": "stable",
        "value": "PT${hms}"
    }`;
}

function notChangedSince(id, value, hms) {
    const store = (typeof value === "boolean") ? "flag" : "status";
    return `${isEqual(id, value)},
    {
        "address": "/sensors/${id}/state/${store}",
        "operator": "stable",
        "value": "PT${hms}"
    }`;
}

function isButton(id, value) {
    return `{
        "address": "/sensors/${id}/state/buttonevent",
        "operator": "eq",
        "value": "${value}"
    },
    ${isUpdated(id)}`;
}

function setValue(id, value) {
    const store = (typeof value === "boolean") ? "flag" : "status";
    return `{
        "address": "/sensors/${id}/state",
        "method": "PUT",
        "body": {
            "${store}": ${value}
        }
    }`;
}

function setScene(groupID, sceneID) {
    return `{
        "address": "/groups/${groupID}/action",
        "method": "PUT",
        "body": {
            "scene": "${sceneID}"
        }
    }`;
}

// =============================

export async function createUserCount(connection, resourceName, userNames) {
    const hub = connection.hub;
    const app = connection.app;

    const maximumUserCount = userNames.length;

    async function createTriggerRule(countID, triggerID, oldValue, newValue) {
        const body = `{
            "name": "(${resourceName}${oldValue > newValue ? "-" : "+"})",
            "conditions": [
                ${isUpdated(triggerID)},
                ${isEqual(countID, oldValue)}
            ],
            "actions": [
                ${setValue(countID, newValue)}
            ]
        }`;

        return createRule(connection, body);
    }

    async function createTriggerSensor(countID, value) {
        const id = await createFlagSensor(connection, `${resourceName}${value > 0 ? "+" : "-"}`, "(User Count Trigger)", false);
        const rules = [];
        for (var i = 0; i < maximumUserCount; ++i) {
            const oldValue = (value > 0) ? i : i - value;
            const newValue = oldValue + value;
            const ruleID = await createTriggerRule(countID, id, oldValue, newValue);
            rules.push(ruleID);
        }

        return { id, rules };
    }

    async function createUserCountSensor() {
        return createStatusSensor(connection, resourceName, "User Count");
    }

    async function createUserRule(userID, userName, value, triggerID) {
        const body = `{
            "name": "(${userName})",
            "conditions": [
                ${isEqual(userID, value)}
            ],
            "actions": [
                ${setValue(triggerID, true)}
            ]
        }`;

        return createRule(connection, body);
    }

    async function createUserSensor(userName, increment, decrement) {
        const id = await createFlagSensor(connection, userName, "User Count User", false);

        const inc = await createUserRule(id, userName, true, increment.id);
        const dec = await createUserRule(id, userName, false, decrement.id);
        const rules = [inc, dec];

        return { id, name: userName, rules };
    }

    async function createOverrideRule(triggerID, users, value) {
        const actions = users.map(user => setValue(user.id, value)).join(",\n");

        const body = `{
            "name": "(${resourceName} Override)",
            "conditions": [
                ${isUpdatedTo(triggerID, value)}
            ],
            "actions": [
                ${actions}
            ]
        }`;

        return createRule(connection, body);
    }

    async function createOverrideSensor(users) {
        const id = await createFlagSensor(connection, `${resourceName} Override`, "User Count Override", false);

        const rules = [
            await createOverrideRule(id, users, false),
            await createOverrideRule(id, users, true)
        ];

        return { id, rules };
    }

    const id = await createUserCountSensor();
    const increment = await createTriggerSensor(id, +1);
    const decrement = await createTriggerSensor(id, -1);
    const users = [];
    for (const userName of userNames) {
        const user = await createUserSensor(userName, increment, decrement);
        users.push(user);
    }
    const override = await createOverrideSensor(users);

    return { id, name: resourceName, triggers: [increment, decrement], users, override };
}

export async function deleteUserCount(connection, uc) {

    for (const rule of uc.override.rules) {
        await deleteRule(connection, rule);
    }

    await deleteSensor(connection, uc.override.id);

    for (const user of uc.users) {
        for (const rule of user.rules) {
            await deleteRule(connection, rule);
        }

        await deleteSensor(connection, user.id);
    }

    for (const trigger of uc.triggers) {
        for (const rule of trigger.rules) {
            await deleteRule(connection, rule);
        }

        await deleteSensor(connection, trigger.id);
    }

    await deleteSensor(connection, uc.id);
}

// =============================

export async function createStatusSensor(connection, name, model, value) {
    const body = statusSensorBody(name, model, value)
    return createSensor(connection, body);
}

export async function createFlagSensor(connection, name, model, value) {
    const body = flagSensorBody(name, model, value)
    return createSensor(connection, body);
}

export async function createLinks(connection, name, description, links) {
    const body = `{
    "name": "${name}",
    "description": "${description}",
    "classid": ${COMPONENT_CLASSID},
    "links": [
        ${links.map(l => JSON.stringify(l)).join(",\n\t\t")}
    ]
}`;
    return createResourceLink(connection, body);
}

export async function createSceneCycle(connection, groupID, zoneID, cycle) {
    cycle = cycle || [
        { fullPower: "Bright"    , lowPower: "Dimmed"    , startTime: "08:00:00" },
        { fullPower: "Relax"     , lowPower: "Dimmed"                       },
        { fullPower: "Nightlight", lowPower: "Nightlight", startTime: "23:00:00" },
    ];
    
    const bri_inc = 56;

    const cycleID = await createStatusSensor(connection, "Scene Cycle Current", "PM.Zone.Scenes.Current", 0);
    const actionID = await createStatusSensor(connection, "Scene Cycle Action", "PM.Zone.Scenes.Action", 0);

    async function createNext(index) {
        const last = (index === cycle.length - 1);
        const body = `{
        "name": "SC: Next",
        "conditions": [
            ${isUpdatedTo(actionID, SC_NEXT)},
            ${isEqual(cycleID, index)}
        ],
        "actions": [
            ${setValue(cycleID, (last ? 0 : index + 1))}
        ]
        } `;
        return createRule(connection, body);
    }

    async function createBrighter() {
        const body = `{
        "name": "SC: Brighter",
        "conditions": [
            ${isUpdatedTo(actionID, SC_BRIGHTER)}
        ],
        "actions": [
            {
                "address": "/groups/${groupID}/action",
                "method": "PUT",
                "body": {
                   "transitiontime": 9
                }
            },
            {
                "address": "/groups/${groupID}/action",
                "method": "PUT",
                "body": {
                   "bri_inc": ${bri_inc}
                }
            }
        ]
        } `;
        return createRule(connection, body);
    }

    async function createDimmer() {
        const body = `{
        "name": "SC: Dimmer",
        "conditions": [
            ${isUpdatedTo(actionID, SC_DIMMER)}
        ],
        "actions": [
            {
                "address": "/groups/${groupID}/action",
                "method": "PUT",
                "body": {
                   "transitiontime": 9
                }
            },
            {
                "address": "/groups/${groupID}/action",
                "method": "PUT",
                "body": {
                   "bri_inc": -${bri_inc}
                }
             }
        ]
        } `;
        return createRule(connection, body);
    }

    async function createFullPower(item, index) {
        const sceneID = await getScene(connection, groupID, item.fullPower);
        const body = `{
        "name": "SC: Full Power",
        "conditions": [
            ${isUpdatedTo(actionID, SC_FULL_POWER)},
            ${isEqual(cycleID, index)}
        ],
        "actions": [
            ${setScene(groupID, sceneID)}
        ]
        }`;
        return createRule(connection, body);
    }

    async function createLowPower(item, index) {
        const sceneID = await getScene(connection, groupID, item.lowPower);
        const body = `{
        "name": "SC: Low Power",
        "conditions": [
            ${isUpdatedTo(actionID, SC_LOW_POWER)},
            ${isEqual(cycleID, index)}
        ],
        "actions": [
            ${setScene(groupID, sceneID)}
        ]
        }`;
        return createRule(connection, body);
    }

    async function createStartTime(index, startTime) {
        const body = `{
        "name": "SC: Time-based",
        "description": "Time-based scene selection",
        "recycle": false,
        "localtime": "W127/T${startTime}",
        "command": {
            "address": "/api/${connection.app}/sensors/${cycleID}/state",
            "body": {
                "status": ${index}
            },
            "method": "PUT"
        }
        }`;
        return createSchedule(connection, body);
    }

    var schedules = [];
    var rules = [];
    for (const [index, item] of cycle.entries()) {
        rules.push(await createNext(index));
        rules.push(await createFullPower(item, index));
        rules.push(await createLowPower(item, index));
        if (item.startTime) {
            schedules.push(await createStartTime(index, item.startTime));
        }
    }

    async function createActivateFull() {
        const body = `{
        "name": "SC: Activate",
        "conditions": [
            ${isUpdatedTo(actionID, SC_ACTIVATE)},
            ${isEqual(zoneID, PMZ_FULL_POWER)}
        ],
        "actions": [
            ${setValue(actionID, SC_FULL_POWER)}
        ]
        } `;
        return createRule(connection, body);
    }

    async function createActivateLow() {
        const body = `{
        "name": "SC: Activate",
        "conditions": [
            ${isUpdatedTo(actionID, SC_ACTIVATE)},
            ${isEqual(zoneID, PMZ_LOW_POWER)}
        ],
        "actions": [
            ${setValue(actionID, SC_LOW_POWER)}
        ]
        } `;
        return createRule(connection, body);
    }

    async function createOff() {
        const body = `{
        "name": "SC: Off",
        "conditions": [
            ${isUpdatedTo(actionID, SC_OFF)}
        ],
        "actions": [
            {
                "address": "/groups/${groupID}/action",
                "method": "PUT",
                "body": {
                    "on": false
                }
            }
        ]
        } `;
        return createRule(connection, body);
    }

    async function createUpdate(index) {
        const body = `{
        "name": "SC: Update",
        "conditions": [
            ${isUpdated(cycleID)}
        ],
        "actions": [
            ${setValue(actionID, SC_ACTIVATE)}
        ]
        } `;
        return createRule(connection, body);
    }

    rules = rules.concat([
        await createActivateFull(),
        await createActivateLow(),
        await createOff(),
        await createUpdate(),
        await createBrighter(),
        await createDimmer(),
    ]);

    return { cycle: cycleID, action: actionID, sensors: [cycleID, actionID], rules, schedules };
}

async function createPMZConfiguration(connection, configuration, index, powerLevelID, powerManagementID, configurationID) {

    // A time after switching to full power, switch to low power
    async function fullPowerToLowPower() {
        const body = `{
            "name": "PMZ: Full power to low power",
            "conditions": [
                ${isEqual(powerManagementID, PMZ_ENABLED)},
                ${isEqual(configurationID, index)},
                ${wasUpdatedTo(powerLevelID, PMZ_FULL_POWER, configuration.fullPower)}
            ],
            "actions": [
                ${setValue(powerLevelID, PMZ_LOW_POWER)}
            ]
        }`;
        return createRule(connection, body);
    }

    // A time after power management enabled and stable at full power, switch to low power
    async function fullPowerToLowPowerEnablement() {
        const body = `{
            "name": "PMZ: Full power to low power",
            "conditions": [
                ${wasUpdatedTo(powerManagementID, PMZ_ENABLED, configuration.fullPower)},
                ${isEqual(configurationID, index)},
                ${notUpdatedSince(powerLevelID, PMZ_FULL_POWER, configuration.fullPower)}
            ],
            "actions": [
                ${setValue(powerLevelID, PMZ_LOW_POWER)}
            ]
        }`;
        return createRule(connection, body);
    }

    // When config changes, check timings
    async function fullPowerToLowPowerConfigChange() {
        const body = `{
            "name": "PMZ: Full power to low power",
            "conditions": [
                ${isChangedTo(configurationID, index)},
                ${isEqual(powerManagementID, PMZ_ENABLED)},
                ${notUpdatedSince(powerLevelID, PMZ_FULL_POWER, configuration.fullPower)}
            ],
            "actions": [
                ${setValue(powerLevelID, PMZ_LOW_POWER)}
            ]
        }`;
        return createRule(connection, body);
    }

    // A time after being in low power, switch off
    async function lowPowerToOff() {
        const body = `{
            "name": "PMZ: Low power to off",
            "conditions": [
                ${isEqual(configurationID, index)},
                ${wasChangedTo(powerLevelID, PMZ_LOW_POWER, configuration.lowPower)}
            ],
            "actions": [
                ${setValue(powerLevelID, PMZ_OFF)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function lowPowerToOffConfigChange() {
        const body = `{
            "name": "PMZ: Low power to off",
            "conditions": [
                ${isChangedTo(configurationID, index)},
                ${notChangedSince(powerLevelID, PMZ_LOW_POWER, configuration.lowPower)}
            ],
            "actions": [
                ${setValue(powerLevelID, PMZ_OFF)}
            ]
        }`;
        return createRule(connection, body);
    }

    // A time after power management was disabled, switch it back on
    async function reenable() {
        const body = `{
            "name": "PMZ: Enable power management",
            "conditions": [
                ${isEqual(configurationID, index)},
                ${wasChangedTo(powerManagementID, PMZ_DISABLED, configuration.reenable)}
            ],
            "actions": [
                ${setValue(powerManagementID, PMZ_ENABLED)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function reenableConfigChange() {
        const body = `{
            "name": "PMZ: Enable power management",
            "conditions": [
                ${isChangedTo(configurationID, index)},
                ${notChangedSince(powerManagementID, PMZ_DISABLED, configuration.reenable)}
            ],
            "actions": [
                ${setValue(powerManagementID, PMZ_ENABLED)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function createStartTime() {
        const body = `{
        "name": "PMZ: Time-based",
        "description": "Time-based power management",
        "recycle": false,
        "localtime": "W127/T${configuration.startTime}",
        "command": {
            "address": "/api/${connection.app}/sensors/${configurationID}/state",
            "body": {
                "status": ${index}
            },
            "method": "PUT"
        }
        }`;
        return createSchedule(connection, body);
    }

    const result = {
        rules: [
            await fullPowerToLowPower(),
            await fullPowerToLowPowerEnablement(),
            await fullPowerToLowPowerConfigChange(),
            await lowPowerToOff(),
            await lowPowerToOffConfigChange(),
            await reenable(),
            await reenableConfigChange(),
        ],
        schedules: []
    };

    if (configuration.startTime) {
        result.schedules = [
            await createStartTime()
        ];
    }

    return result;
}

// zone: { name, power: { fullPower, lowPower, reenable }}
// cycle: [{ fullPower: "Scene 1", lowPower: "Scene 2", startTime: "hh:mm:ss" }]
export async function createPowerManagedZone(connection, zone) {

    // A power managed zone has three states: ON(2), LOWPOWER(1), and OFF(0)
    // It also has a separate setting for enabling/disabling standard power management.
    // When standard power management is disabled, the transition time for full power
    // to low power uses an extended time period. (Low to Off is unchanged).
    // For example, the standard period might be 3 minutes while the extended period could be 8 hours.
    // The extended period is to allow switches to "disable" low power mode without
    // letting it be completely disabled.
    // If power management is enabled for the zone, the states will change
    // from higher power to lower power automatically over time.
    // If you want to keep the zone in a high power state, updating the sensor is sufficient.
    // If the zone is already at full power, it essentially resets the timer.
    // You can also disable power management to stay at high power and disable the timer.
    // You can switch to a low power state manually if you choose.
    // If you want to keep the zone in a low power state, you should disable power management.
    // Setting the zone to LOWPOWER(1) will switch to low power if not already in that state,
    // but doesn't reset the timer if in that state already.
    // If you disable and reenable power management, the timers start again at the point that
    // power management is enabled.

    async function createFullPowerRule(id, sceneCycle) {
        const body = `{
            "name": "LGT: Zone on full power",
            "conditions": [
                ${isEqual(id, PMZ_FULL_POWER)}
            ],
            "actions": [
                ${setValue(sceneCycle.action, SC_FULL_POWER)}
            ]
        }`;
        return createRule(connection, body);
    }

    // A 1 second delay allows automations to kick in without the user noticing.
    // For example, presence sensors can pull the zone back to full power
    // using the transition to low power as the trigger for the rule,
    // but if we didn't have a delay here, the lights could flicker.
    async function createLowPowerRule(id, sceneCycle) {
        const body = `{
            "name": "LGT: Zone on low power",
            "conditions": [
                ${wasChangedTo(id, PMZ_LOW_POWER, "00:00:01")}
            ],
            "actions": [
                ${setValue(sceneCycle.action, SC_LOW_POWER)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function createOffRule(id, sceneCycle) {
        const body = `{
            "name": "LGT: Zone off",
            "conditions": [
                ${isUpdatedTo(id, PMZ_OFF)}
            ],
            "actions": [
                ${setValue(sceneCycle.action, SC_OFF)}
            ]
        }`;
        return createRule(connection, body);
    }

    // Power management automatically moves a zone from full power (2) to low power (1) to off (0)
    const powerLevelID = await createStatusSensor(connection, zone.name, "PM.Zone.PowerLevel", PMZ_OFF);

    // Power management can be enabled/disabled for each zone
    const powerManagementID = await createStatusSensor(connection, zone.name, "PM.Zone.PowerManagement", PMZ_ENABLED);

    const configurationID = await createStatusSensor(connection, zone.name, "PM.Zone.Configurations.Current", 0);

    // The power switching rules
    var configs = [];
    for (var index = 0; index < zone.configurations.length; ++index) {
        const configuration = zone.configurations[index];
        const config = await createPMZConfiguration(connection, configuration, index, powerLevelID, powerManagementID, configurationID);
        configs.push(config);
    }

    // Create a scene cycle
    const sceneCycle = await createSceneCycle(connection, zone.id, powerLevelID, zone.scenes);

    // Visualize power states
    const fullPowerRule = await createFullPowerRule(powerLevelID, sceneCycle);
    const lowPowerRule = await createLowPowerRule(powerLevelID, sceneCycle);
    const offRule = await createOffRule(powerLevelID, sceneCycle);

    const rl = await createLinks(connection, zone.name, "Power Managed Zone", [
        `/groups/${zone.id}`,
        `/sensors/${powerLevelID}`,
        `/sensors/${powerManagementID}`,
        `/sensors/${configurationID}`,
        ...sceneCycle.sensors.map(r => `/sensors/${r}`),

        ...configs.flatMap(c => c.rules).map(r => `/rules/${r}`),
        
        ...sceneCycle.rules.map(r => `/rules/${r}`),
        `/rules/${fullPowerRule}`,
        `/rules/${lowPowerRule}`,
        `/rules/${offRule}`,

        ...configs.flatMap(c => c.schedules).map(r => `/schedules/${r}`),
        ...sceneCycle.schedules.map(r => `/schedules/${r}`),
    ]);

    return { sceneCycle, sensors: [powerLevelID, powerManagementID], resourceLinks: [rl] };
}

export async function createPowerManagedDimmerRules(connection, dimmerID, zoneID, zoneControlID, sceneCycle) {

    async function onDownWhenOff() {
        const body = `{
            "name": "DMR: Zone on full power",
            "conditions": [
                ${isButton(dimmerID, BTN_ON + BTN_initial_press)},
                {
                    "address": "/sensors/${zoneID}/state/status",
                    "operator": "lt",
                    "value": "2"
                }
            ],
            "actions": [
                ${setValue(zoneID, PMZ_FULL_POWER)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function onDownWhenOn() {
        const body = `{
            "name": "DMR: Next scene",
            "conditions": [
                ${isButton(dimmerID, BTN_ON + BTN_initial_press)},
                ${isEqual(zoneID, 2)}
            ],
            "actions": [
                ${setValue(zoneID, PMZ_FULL_POWER)},
                ${setValue(sceneCycle.action, SC_NEXT)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function bigStarDown() {
        const body = `{
            "name": "DMR: Brighter",
            "conditions": [
                ${isButton(dimmerID, BTN_STAR_UP + BTN_initial_press)}
            ],
            "actions": [
                ${setValue(zoneID, PMZ_FULL_POWER)},
                ${setValue(sceneCycle.action, SC_BRIGHTER)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function bigStarRepeat() {
        const body = `{
            "name": "DMR: Brighter",
            "conditions": [
                ${isButton(dimmerID, BTN_STAR_UP + BTN_repeat)}
            ],
            "actions": [
                ${setValue(zoneID, PMZ_FULL_POWER)},
                ${setValue(sceneCycle.action, SC_BRIGHTER)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function littleStarDown() {
        const body = `{
            "name": "DMR: Dimmer",
            "conditions": [
                ${isButton(dimmerID, BTN_STAR_DOWN + BTN_initial_press)}
            ],
            "actions": [
                ${setValue(zoneID, PMZ_FULL_POWER)},
                ${setValue(sceneCycle.action, SC_DIMMER)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function littleStarRepeat() {
        const body = `{
            "name": "DMR: Dimmer",
            "conditions": [
                ${isButton(dimmerID, BTN_STAR_DOWN + BTN_repeat)}
            ],
            "actions": [
                ${setValue(zoneID, PMZ_FULL_POWER)},
                ${setValue(sceneCycle.action, SC_DIMMER)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function offDownWhenOn() {
        const body = `{
            "name": "DMR: Zone off; mngmnt enabled",
            "conditions": [
                ${isButton(dimmerID, BTN_OFF + BTN_initial_press)},
                {
                    "address": "/sensors/${zoneID}/state/status",
                    "operator": "gt",
                    "value": "0"
                }
            ],
            "actions": [
                ${setValue(zoneControlID, PMZ_ENABLED)},
                ${setValue(zoneID, PMZ_OFF)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function offDownWhenOff() {
        const body = `{
            "name": "DMR: Power management disabled",
            "conditions": [
                ${isButton(dimmerID, BTN_OFF + BTN_initial_press)},
                ${isEqual(zoneID, 0)}
            ],
            "actions": [
                ${setValue(zoneControlID, PMZ_DISABLED)},
                ${setValue(zoneID, PMZ_FULL_POWER)}
            ]
        }`;
        return createRule(connection, body);
    }

    const rules = [
        await onDownWhenOff(), // Zone full power
        await onDownWhenOn(),  // Next scene
        await offDownWhenOn(), // Zone off and management on
        await offDownWhenOff(),// Zone on and management off
        await bigStarDown(),      // Brighter
        await bigStarRepeat(),    // Brighter
        await littleStarDown(),   // Dimmer
        await littleStarRepeat(), // Dimmer
    ];

    const rl = await createLinks(connection, "TODO", "Power Managed Dimmer", [
        `/sensors/${dimmerID}`,
        ...rules.map(rule => `/rules/${rule}`)
    ]);

    return rules;
}


export async function createPowerManagedMotionSensorRules(connection, motionID, zoneID, zoneControlID) {
    
    const activation = await createStatusSensor(connection, "Motion Activation", "PM.Motion.Activation", PMM_TURN_ON);
    const actionID = await createStatusSensor(connection, "Motion Action", "PM.Motion.Action", 0);

    async function onActivate1() {
        const body = `{
            "name": "MTN: Activate",
            "conditions": [
                ${isUpdatedTo(actionID, PMM_ACTIVATE)},
                ${isEqual(activation, PMM_KEEP_ON)},
                {
                    "address": "/sensors/${zoneID}/state/status",
                    "operator": "gt",
                    "value": "0"
                }
            ],
            "actions": [
                ${setValue(zoneID, PMZ_FULL_POWER)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function onActivate2() {
        const body = `{
            "name": "MTN: Activate",
            "conditions": [
                ${isUpdatedTo(actionID, PMM_ACTIVATE)},
                ${isEqual(activation, PMM_TURN_ON)}
            ],
            "actions": [
                ${setValue(zoneID, PMZ_FULL_POWER)}
            ]
        }`;
        return createRule(connection, body);
    }

    /*
    The Philips motion sensor is a presence sensor that only updates itself when
    state.presence changes. This is power efficient, but it does not give continuous indication of motion events, so best not to treat it like it does. Our approach is to detect the zone's power state and, just as a user would click the switch when the lights dim, bump the power state back to full power if presence is true. 
    */

    /*
    When zone transitions to low power, bump to full power if there's someone present.
    Note that we don't bump a zone to full power when its power state has transitioned to OFF(0).
    */
    async function onLowPower() {
        const body = `{
            "name": "MTN: Zone on full power",
            "conditions": [
                ${isPresent(motionID)},
                ${isChangedTo(zoneID, PMZ_LOW_POWER)}
            ],
            "actions": [
                ${setValue(actionID, PMM_ACTIVATE)}
            ]
        }`;
        return createRule(connection, body);
    }

    /*
    When presence is detected, bump to full power or preserve at full power.
    */
    async function onPresence() {
        const body = `{
            "name": "MTN: Zone on full power",
            "conditions": [
                ${isPresent(motionID)},
                ${isUpdated(motionID)}
            ],
            "actions": [
                ${setValue(actionID, PMM_ACTIVATE)}
            ]
        }`;
        return createRule(connection, body);
    }

    // TODO - return all items, resourcelink
    let rules = [
        await onActivate1(),
        await onActivate2(),
        await onLowPower(),
        await onPresence(),
    ];

    const rl = await createLinks(connection, "TODO", "Power Managed Motion Sensor", [
        `/sensors/${motionID}`,
        `/sensors/${activation}`,
        `/sensors/${actionID}`,
        ...rules.map(rule => `/rules/${rule}`)
    ]);

    return rules;
}

const componentSensors = [
    {
        modelid: "PM.Zone.PowerLevel",
        manufacturername: "Callionica",
        component: "Power Managed Zone",
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
        component: "Power Managed Zone",
        property: "Power Management",
        status: [
            { value: PMZ_ENABLED, name: "Enabled" },
            { value: PMZ_DISABLED, name: "Disabled" }
        ]
    },
    {
        modelid: "PM.Zone.Configurations.Current",
        manufacturername: "Callionica",
        component: "Power Managed Zone",
        property: "Configurations > Current Configuration",
        list: [
            {
                property: "Full power",
                item: "PMZ: Full power to low power",
                kind: "ddx"
            },
            {
                property: "Low power",
                item: "PMZ: Low power to off",
                kind: "ddx"
            },
            {
                property: "Reenable power management",
                item: "PMZ: Enable power management",
                kind: "ddx"
            },
            ]
    },
    {
        modelid: "PM.Zone.Scenes.Current",
        manufacturername: "Callionica",
        component: "Power Managed Zone",
        property: "Scenes > Current Scene",
        list: [
            {
                property: "Full power",
                item: "SC: Full power",
                kind: "scene"
            },
            {
                property: "Low power",
                item: "SC: Low power",
                kind: "scene"
            },
            {
                property: "Activate",
                item: "SC: Time-based",
                kind: "schedule"
            },
            ]
    },
    {
        modelid: "PM.Zone.Scenes.Action",
        manufacturername: "Callionica",
        component: "Power Managed Zone",
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
    },
    {
        modelid: "PM.Motion.Activation",
        manufacturername: "Callionica",
        component: "Power Managed Motion Sensor",
        property: "Activation",
        status: [
            { value: PMM_TURN_ON, name: "Turn on", description: "Turn on the power managed zone" },
            { value: PMM_KEEP_ON, name: "Keep on", description: "Keep the power managed zone on if already on" },
            { value: PMM_DO_NOTHING, name: "Do nothing" }
        ]
    },
    {
        modelid: "PM.Motion.Action",
        manufacturername: "Callionica",
        component: "Power Managed Motion Sensor",
        property: "Action",
        status: [
            { value: PMM_ACTIVATE, name: "Activate", description: "Activate according to the motion sensor's Activation setting" }
        ]
    },
];

const components = [
    {
        manufacturer: "Callionica",
        name: "Power Managed Zone",
        comment: "A room or zone that turns itself off after a period of time",
        description: "A room or zone that turns itself off after a period of time and that has a list of scenes that can be triggered manually or automatically at a certain time. Power managed zones have three power levels: Full Power, Low Power, and Off. The Low Power level gives you a warning that the lights will be turning off, allowing you to take an action to keep the lights on if necessary. Power Managed Zones have custom integrations with dimmers and motion sensors to ensure that all devices work well together in a standard way. Power management can be disabled (temporarily). The timings are all configurable, but examples might be 10 minutes before the zone switches from Full Power to Low Power, 1 minute before the zone switches from Low Power to Off, and 8 hours before the zone re-enables power management automatically.",
        url: "https://github.com/callionica/hue/power-managed-zone.md",
    },
    {
        manufacturer: "Callionica",
        name: "Power Managed Dimmer",
        comment: "A dimmer that has been configured to work with a Power Managed Zone",
        description: "A dimmer that has been configured to work with a Power Managed Zone. All actions using the dimmer (except the Off button) will turn on the Power Managed Zone or increase it to Full Power extending the timeout before the zone turns itself off. The On button will (A) Turn on the zone at Full Power if it's off (B) Increase the zone to Full Power if it's at Low Power (C) Switch the lights to the next scene in the scene list managed by the zone if the zone is at Full Power. Note that there is one scene list per zone (and one current scene in the list), not a separate scene list and current scene for each dimmer. Power management can be disabled (temporarily) by using the Off button when the lights are off: this will turn the lights on and keep them on until the zone automatically enables power management again after an extended period of time (configured by the zone). Using the Off button to turn off the lights also immediately re-enables power management.",
        url: "https://github.com/callionica/hue/power-managed-dimmer.md",
    },
    {
        manufacturer: "Callionica",
        name: "Power Managed Motion Sensor",
        comment: "A motion sensor that has been configured to work with a Power Managed Zone",
        description: "A motion sensor that has been configured to work with a Power Managed Zone. Power Managed Motion Sensors are designed to work well together with other Power Managed Motion Sensors and with Power Managed Dimmers controlling the same zone. Power Managed Motion Sensors do not turn off the lights, Power Managed Zones do that themselves. Power Managed Motion Sensors can either turn on the lights, keep the lights on, or do nothing. The option to keep the lights on, but not turn them on, can be useful where the motion sensor can not be positioned to avoid unwanted motion (such as pets). It can also be helpful where people are used to turning lights on and off manually.",
        url: "https://github.com/callionica/hue/power-managed-motion-sensor.md",
    }
];

// A component instance can be identified by:
// 1. A resourcelink
// 2. with classid === 9090
// 3. and description matching one of the known component names
// The resourcelink bundles all the pieces of the component together
// not all of which are created by the component (e.g. PMZ stores the group in its resourcelink)

// Converts a link as used in resourcelinks to a real object with an id property
function expandLink(link, data) {
    const path = link.split("/");
    if (path.length === 3 && path[0] === "") {
        const category = path[1]; // category will be "groups", "sensors", etc
        const c = data[category];
        if (c) {
            const id = path[2]; // id will be "1", "3TcLCtr5vuebVK1", etc
            const o = c[id];
            if (o) {
                return { category, item: { id, ...o } };
            }
        }
    }

    return { category: "invalidLinks", item: link };
}

// Converts all links to their respective objects and separates them into categories
function expandLinks(links, data) {
    var result = {};
    for (const link of links) {
        const o = expandLink(link, data);
        const c = result[o.category] || [];
        c.push(o.item);
        result[o.category] = c;
    }
    return result;
}

// Expands a resource link by adding an id property and pulling in referred-to objects
function expandResourceLink(id, data) {
    const resourceLink = data.resourcelinks[id];
    const links = expandLinks(resourceLink.links, data);
    return { id, ...resourceLink, ...links };
}

function extractProperty(sensor, schedules, rules, propertyMetadata) {

    let values = [];

    if (propertyMetadata.kind === "schedule") {
        const address = `/sensors/${sensor.id}/state`;
        const name = propertyMetadata.item.toLowerCase();
        const enabledSchedules = schedules.filter(schedule => (schedule.name.toLowerCase() === name) && (schedule.status === "enabled") && schedule.command.address.endsWith(address));
        for (const schedule of enabledSchedules) {
            let value = schedule.command.body.status;
            let propertyValue = schedule.localtime;

            values.push({ value, propertyValue });
        }

    } else {

        const address = `/sensors/${sensor.id}/state/status`;
        const ruleName = propertyMetadata.item.toLowerCase();
        const enabledRules = rules.filter(rule => (rule.name.toLowerCase() === ruleName) && (rule.status === "enabled"));


        for (const rule of enabledRules) {
            const valueCondition = rule.conditions.filter(condition => (condition.address === address) && (condition.operator === "eq"))[0];
            if (valueCondition) {
                let value = parseInt(valueCondition.value, 10);
                if (propertyMetadata.kind === "ddx") {
                    const propertyCondition = rule.conditions.filter(condition => (condition.operator === "ddx"))[0];
                    if (propertyCondition) {
                        let propertyValue = propertyCondition.value;
                        values.push({ value, propertyValue });
                        continue;
                    }
                } else if (propertyMetadata.kind === "scene") {
                    // TODO error handling
                    let propertyValue = rule.actions.filter(action => action.body.scene)[0].body.scene;
                    values.push({ value, propertyValue });
                    continue;
                }

                values.push({ value });
            }
        }
    }

    let result = [];

    // Condense all the found values
    for (const v of values) {
        const existing = result.find(e => e.value === v.value);
        if (!existing) {
            result.push(v);
            continue;
        }

        if (v.propertyValue === undefined) {
            continue;
        }
        
        if (existing.propertyValue === undefined) {
            existing.propertyValue = v.propertyValue;
            continue;
        }

        if (existing.propertyValue !== v.propertyValue) {
            // TODO - how to deal with inconsistency
            console.log(existing, v);
        }
    }

    return result;
}

function rearrangeProperties(values) {
    let result = [];

    for (const v of values) {
        for (const d of v.data) {
            let existing = result.find(e => e.value === d.value);
            if (!existing) {
                existing = {value: d.value, properties: []};
                result.push(existing);
            }

            existing.properties.push({ name: v.metadata.property, value: d.propertyValue, kind: v.metadata.kind });
        }
    }

    return result;
}

function pseudoStatus(values, data) {
    function displayValue(p) {
        if (((p.kind === "ddx") || (p.kind === "schedule")) && p.value.startsWith("PT")) {
            return p.value.substring(2);
        }

        if (p.kind === "schedule" && p.value.startsWith("W127/T")) {
            return p.value.substring("W127/T".length);
        }

        if (p.kind === "scene") {
            return data.scenes[p.value].name;
        }

        return p.value;
    }

    return values.map(v => {
        return {
            value: v.value,
            name: v.properties.map(p => p.name + ": " + displayValue(p)).join(", ")
        };
    });
}

export function getComponents(data) {
    return Object.entries(data.resourcelinks).filter(([id, resourceLink]) => resourceLink.classid === COMPONENT_CLASSID).map(([id, resourceLink]) => {
        const component = expandResourceLink(id, data);

        component.metadata = components.filter(c => c.name === component.description)[0];

        for (const sensor of component.sensors) {
            const metadata = componentSensors.filter(cs => cs.modelid === sensor.modelid && cs.manufacturername == sensor.manufacturername)[0];
            if (metadata) {
                sensor.metadata = metadata;
                let value = { value: sensor.state.status, name: sensor.state.status };

                let st = metadata.status;

                if (metadata.list) {
                    let v = metadata.list.map(propertyMetadata => {
                        return {
                            metadata: propertyMetadata,
                            data: extractProperty(sensor, component.schedules, component.rules, propertyMetadata)
                        };
                    });
                    
                    sensor.valueList = rearrangeProperties(v);
                    console.log(sensor.valueList);

                    st = pseudoStatus(sensor.valueList, data);
                }

                if (st) {
                    value = st.filter(status => status.value === sensor.state.status)[0];
                }
                sensor.value = value;
            }
        }

        const first = component.links && component.links[0];
        if (first && first !== "/groups/0") {
            if (first.startsWith("/groups/")) {
                component.tiedTo = { category: "groups", item: component.groups[0] };
            } else if (first.startsWith("/sensors/")) {
                component.tiedTo = { category: "sensors", item: component.sensors[0] };
            }
        }

        return component;
    });
}
