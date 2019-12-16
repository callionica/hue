"use strict";

// Hope this works!
export function uuid() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

// Dimmer constants
const initial_press = 0;
const repeat = 1;
const short_release = 2;
const long_release = 3;

const BTN_ON = 1000;
const BTN_STAR_UP = 2000;
const BTN_STAR_DOWN = 3000;
const BTN_OFF = 4000;

// Power Managed Zone constants
const PMZ_OFF = 0;
const PMZ_LOW_POWER = 1;
const PMZ_FULL_POWER = 2;

// Scene Cycle constants
const SC_NEXT = 1;        // Move to the next scene without activating it
const SC_FULL_POWER = 10; // Activate the full power version of the current scene
const SC_LOW_POWER = 11;  // Activate the low power version of the current scene
const SC_ACTIVATE = 12;   // Activate the appropriate version of the current scene for the zone's power state

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
    return deleteDescriptionSchedules(connection, connection.app);
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

function statusSensorBody(name, model) {
    const body = `{
        "name": "${name}",
        "state": {
            "status": 0
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

function isEqualSince(id, value, hms) {
    const store = (typeof value === "boolean") ? "flag" : "status";
    return `${isEqual(id, value)},
    {
        "address": "/sensors/${id}/state/${store}",
        "operator": "ddx",
        "value": "PT${hms}"
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

function isButton(id, value) {
    return `{
        "address": "/sensors/${id}/state/buttonevent",
        "operator": "eq",
        "value": "${value}"
    },
    ${isUpdated(id)}`;
}

function isChangedTo(id, value) {
    const store = (typeof value === "boolean") ? "flag" : "status";
    return `${isEqual(id, value)},
    ${isChanged(id, store)}`;
}

function isUpdatedAndEqual(id, value) {
    return `${isEqual(id, value)},
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
                ${isUpdatedAndEqual(triggerID, value)}
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

export async function createStatusSensor(connection, name, model) {
    const body = statusSensorBody(name, model)
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
    "classid": 9090,
    "links": [
        ${links.map(l => JSON.stringify(l)).join(",\n\t\t")}
    ]
}`;
    return createResourceLink(connection, body);
}

export async function createSceneCycle(connection, groupID, zoneID, cycle) {
    cycle = cycle || [
        { fullPower: "Bright", lowPower: "Dimmed", period: "T08:00:00/T23:00:00" },
        { fullPower: "Read", lowPower: "Dimmed" },
        { fullPower: "Nightlight", lowPower: "Nightlight", period: "T23:00:00/T08:00:00" },
    ];

    const cycleID = await createStatusSensor(connection, "Scene Cycle", "SceneCycle");
    const actionsID = await createStatusSensor(connection, "Scene Cycle Actions", "SceneCycle.Actions");

    async function createNext(index) {
        const last = (index === cycle.length - 1);
        const body = `{
        "name": "SC: Next",
        "conditions": [
            ${isUpdatedAndEqual(actionsID, SC_NEXT)},
            ${isEqual(cycleID, index)}
        ],
        "actions": [
            ${setValue(cycleID, (last ? 0 : index + 1))}
        ]
        } `;
        return createRule(connection, body);
    }

    async function createFullPower(item, index) {
        const sceneID = getScene(connection, groupID, item.fullPower);
        const body = `{
        "name": "SC: Full Power",
        "conditions": [
            ${isUpdatedAndEqual(actionsID, SC_FULL_POWER)},
            ${isEqual(cycleID, index)}
        ],
        "actions": [
            ${setScene(groupID, sceneID)}
        ]
        }`;
        return createRule(connection, body);
    }

    async function createLowPower(item, index) {
        const sceneID = getScene(connection, groupID, item.lowPower);
        const body = `{
        "name": "SC: Low Power",
        "conditions": [
            ${isUpdatedAndEqual(actionsID, SC_LOW_POWER)},
            ${isEqual(cycleID, index)}
        ],
        "actions": [
            ${setScene(groupID, sceneID)}
        ]
        }`;
        return createRule(connection, body);
    }

    for (const [index, item] of cycle.entries()) {
        await createNext(index);
        await createFullPower(item, index);
        await createLowPower(item, index);
    }

    async function createActivateFull() {
        const body = `{
        "name": "SC: Activate",
        "conditions": [
            ${ isUpdatedAndEqual(actionsID, SC_ACTIVATE)},
            ${ isEqual(zoneID, PMZ_FULL_POWER)}
        ],
        "actions": [
            ${ setValue(actionsID, SC_FULL_POWER)}
        ]
        } `;
        return createRule(connection, body);
    }

    async function createActivateLow() {
        const body = `{
        "name": "SC: Activate",
        "conditions": [
            ${ isUpdatedAndEqual(actionsID, SC_ACTIVATE)},
            ${ isEqual(zoneID, PMZ_LOW_POWER)}
        ],
        "actions": [
            ${ setValue(actionsID, SC_LOW_POWER)}
        ]
        } `;
        return createRule(connection, body);
    }

    await createActivateFull();
    await createActivateLow();

    return { cycle: cycleID, actions: actionsID };
}

// zone: { name, power: { enabled, fullPower, lowPower, failsafe }}
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

    // 2. A rule: status == on(2) and lastupdate ddx A, change status to lowpower(1)
    async function fullPowerToLowPower(id, controlID, hms) {
        const body = `{
            "name": "PMZ: Full power to low power",
            "conditions": [
                ${isEqual(controlID, true)},
                {
                    "address": "/sensors/${id}/state/lastupdated",
                    "operator": "ddx",
                    "value": "PT${hms}"
                },
                ${isEqual(id, PMZ_FULL_POWER)}
            ],
            "actions": [
                ${setValue(id, PMZ_LOW_POWER)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function fullPowerToLowPowerEnablement(id, controlID, hms) {
        const body = `{
            "name": "PMZ: Full power to low power",
            "conditions": [
                ${isEqual(controlID, true)},
                {
                    "address": "/sensors/${controlID}/state/flag",
                    "operator": "ddx",
                    "value": "PT${hms}"
                },
                ${isEqual(id, PMZ_FULL_POWER)},
                {
                    "address": "/sensors/${id}/state/status",
                    "operator": "stable",
                    "value": "PT${hms}"
                }
            ],
            "actions": [
                ${setValue(id, PMZ_LOW_POWER)}
            ]
        }`;
        return createRule(connection, body);
    }

    // 3. A rule: status == lowpower(1) and status ddx B, change status to off(0)
    async function lowPowerToOff(id, controlID, hms) {
        const body = `{
            "name": "PMZ: Low power to off",
            "conditions": [
                ${isEqualSince(id, PMZ_LOW_POWER, hms)}
            ],
            "actions": [
                ${setValue(id, PMZ_OFF)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function createFailsafeRule(controlID, hms) {
        const body = `{
            "name": "PMZ: Enable power management",
            "conditions": [
                {
                    "address": "/sensors/${controlID}/state/lastupdated",
                    "operator": "ddx",
                    "value": "PT${hms}"
                },
                ${isEqual(controlID, false)}
            ],
            "actions": [
                ${setValue(controlID, true)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function createFullPowerRule(id, sceneCycle) {
        const body = `{
            "name": "LGT: Zone on full power",
            "conditions": [
                ${isEqual(id, PMZ_FULL_POWER)}
            ],
            "actions": [
                ${setValue(sceneCycle.actions, SC_FULL_POWER)}
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
                ${isEqualSince(id, PMZ_LOW_POWER, "00:00:01")}
            ],
            "actions": [
                ${setValue(sceneCycle.actions, SC_LOW_POWER)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function createOffRule(id, zoneID) {
        const body = `{
            "name": "LGT: Zone off",
            "conditions": [
                ${isUpdatedAndEqual(id, PMZ_OFF)}
            ],
            "actions": [
                {
                    "address": "/groups/${zoneID}/action",
                    "method": "PUT",
                    "body": {
                        "on": false
                    }
                }
            ]
        }`;
        return createRule(connection, body);
    }

    // Power management automatically moves a zone from full power (2) to low power (1) to off (0)
    const id = await createStatusSensor(connection, zone.name, "Power Managed Zone");

    // Power management can be enabled/disabled for each zone
    const controlID = await createFlagSensor(connection, zone.name, "Power Management Enabled", zone.power.enabled);

    // The power switching rules
    const fullToLow = await fullPowerToLowPower(id, controlID, zone.power.fullPower);
    const fullToLowEnabled = await fullPowerToLowPowerEnablement(id, controlID, zone.power.fullPower);
    const lowToOff = await lowPowerToOff(id, controlID, zone.power.lowPower);

    // Reenable power management if off for too long
    const failsafe = await createFailsafeRule(controlID, zone.power.failsafe);

    // Create a scene cycle
    const sceneCycle = await createSceneCycle(connection, zone.id, id); // TODO

    // Visualize power states
    const fullPowerRule = await createFullPowerRule(id, sceneCycle);
    const lowPowerRule = await createLowPowerRule(id, sceneCycle);
    const offRule = await createOffRule(id, zone.id);

    const rl = await createLinks(connection, zone.name, "Power Managed Zone. Turns off after period of time.", [
        `/sensors/${id}`,
        `/sensors/${controlID}`,

        `/rules/${fullToLow}`,
        `/rules/${fullToLowEnabled}`,
        `/rules/${lowToOff}`,
        `/rules/${failsafe}`,

        `/rules/${fullPowerRule}`,
        `/rules/${lowPowerRule}`,
        `/rules/${offRule}`,
    ]);

    return { sensors: [id, controlID], rules: [fullToLow, fullToLowEnabled, lowToOff, failsafe, fullPowerRule, lowPowerRule, offRule], resourceLinks: [rl] };
}

export async function createPowerManagedDimmerRules(connection, dimmerID, zoneID, zoneControlID) {

    async function onDown() {
        const body = `{
            "name": "DMR: Zone on full power",
            "conditions": [
                ${isButton(dimmerID, 1000)}
            ],
            "actions": [
                ${setValue(zoneID, PMZ_FULL_POWER)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function onLongUp() {
        const body = `{
            "name": "DMR: Power management disabled",
            "conditions": [
                ${isButton(dimmerID, 1003)}
            ],
            "actions": [
                ${setValue(zoneControlID, false)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function offDownWhenOn() {
        const body = `{
            "name": "DMR: Zone off; mngmnt enabled",
            "conditions": [
                ${isButton(dimmerID, 4000)},
                {
                    "address": "/sensors/${zoneID}/state/status",
                    "operator": "gt",
                    "value": "0"
                }
            ],
            "actions": [
                ${setValue(zoneControlID, true)},
                ${setValue(zoneID, PMZ_OFF)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function offDownWhenOff() {
        const body = `{
            "name": "DMR: Zone on low power",
            "conditions": [
                ${isButton(dimmerID, 4000)},
                ${isEqual(zoneID, 0)}
            ],
            "actions": [
                ${setValue(zoneID, PMZ_LOW_POWER)}
            ]
        }`;
        return createRule(connection, body);
    }

    return [
        await onDown(),
        await onLongUp(),
        await offDownWhenOn(),
        await offDownWhenOff()
    ];
}


export async function createPowerManagedMotionSensorRules(connection, motionID, zoneID, zoneControlID) {
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
                ${setValue(zoneID, PMZ_FULL_POWER)}
            ]
        }`;
        return createRule(connection, body);
    }

    /*
    When presence is detected, bump to full power or preserve at full power.
    Note that we bump any zone power state when presence arrives including turning on the lights.
    It might be a useful option for the motion detector to keep the lights on, but not turn them on (in that case, add a condition for zone state.status gt 0).
    */
    async function onPresence() {
        const body = `{
            "name": "MTN: Zone on full power",
            "conditions": [
                ${isPresent(motionID)},
                ${isUpdated(motionID)}
            ],
            "actions": [
                ${setValue(zoneID, PMZ_FULL_POWER)}
            ]
        }`;
        return createRule(connection, body);
    }

    // TODO - return all items, resourcelink
    return [
        await onLowPower(),
        await onPresence(),
    ];
}
