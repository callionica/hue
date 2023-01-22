// deno-lint-ignore-file require-await no-unused-vars no-constant-condition
"use strict";

import { lightXY, lightCT, ctToXY, Point } from "./hue-callionica-color.js";

/**
 * Generates a unique ID
 * @returns { string }
 */
export function uuid() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

export class Timeout {}
export class TimeoutExpired extends Timeout {}
export class TimeoutCanceled extends Timeout {}

// Timeout expiry and timeout cancelation are not errors
/**
 * 
 * @param { number } ms 
 * @param { AbortSignal } signal 
 * @returns { Promise<TimeoutCanceled> | Promise<TimeoutExpired> }
 */
export function delay(ms, signal) {
    let timeoutHandle;
    let resolve;

    if (signal !== undefined) {
        signal.addEventListener("abort", () => {
            if (timeoutHandle !== undefined) {
                clearTimeout(timeoutHandle);
                timeoutHandle = undefined;
                resolve(new TimeoutCanceled());
            }
        });
    }

    return new Promise((res) => {
        resolve = res;

        timeoutHandle = setTimeout(() => {
            timeoutHandle = undefined;
            resolve(new TimeoutExpired());
        }, ms);
    });
}

// In case we ever decide to redefine 'fetch', we keep track of the original
const original = (() => {
    const fetch = globalThis.fetch.bind(globalThis);

    return { fetch };
})();

// Throws TimeoutExpired or TimeoutCanceled
export async function fetchJSON(input, init = undefined, timeoutMS = 2000) {
    const fetchController = new AbortController();
    const signal = fetchController.signal;

    const timeoutController = new AbortController();
    const timeout = delay(timeoutMS, timeoutController.signal);

    if (init?.signal !== undefined) {
        // A signal from the outside is treated like a timeout cancelation
        // The connection will be aborted naturally, like a timeout expiry
        init.signal.addEventListener("abort", () => {
            timeoutController.abort();
        });
    }

    try {
        // Race the fetch and the timeout
        const response = await Promise.race([original.fetch(input, { ...init, signal }), timeout]);

        // If the winner of the race was the timeout (either expired or canceled), 
        // abort the fetch and convert the result to an exception
        if (response instanceof Timeout) {
            fetchController.abort();
            throw response;
        }

        // Otherwise the winner of the race was the fetch, so continue obtaining the data
        const json = await Promise.race([response.json(), timeout]);

        // If the winner of the race was the timeout (either expired or canceled), 
        // abort the fetch and convert the result to an exception
        if (json instanceof Timeout) {
            fetchController.abort();
            throw json;
        }

        // Otherwise the winner of the race was the json, so return the result
        return json;
    } finally {
        // Aborting the timeout in all cases is safe
        timeoutController.abort();
    }
}

export async function retry(fn, delays) {
    try {
        return await fn();
    } catch (e) {
        if (delays.length === 0) {
            throw e;
        }
        // console.log("RETRY", new Date(), delays[0]);
        await delay(delays[0]);
        return await retry(fn, delays.slice(1));
    }
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
    let button;
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

const ACTION_BASE = 0;

// Scene Cycle constants
const SC_OFF = ACTION_BASE + PMZ_OFF;              // Turn off the lights
const SC_LOW_POWER = ACTION_BASE + PMZ_LOW_POWER;  // Activate the low power version of the current scene
const SC_FULL_POWER = ACTION_BASE + PMZ_FULL_POWER; // Activate the full power version of the current scene

const SC_BRIGHTER = SC_FULL_POWER + 1;    // Make the scene brighter
const SC_DIMMER = SC_FULL_POWER + 2;      // Make the scene dimmer
const SC_ACTIVATE = SC_FULL_POWER + 3;    // Activate the appropriate version of the current scene for the zone's power state
const SC_NEXT = SC_FULL_POWER + 4;        // Move to the next scene and activate it

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

export async function send(method, address, body) {
    if (typeof body !== "string") {
        body = JSON.stringify(body, null, "  ");
    }

    let bridgeResult;
    try {
        bridgeResult = await fetchJSON(address, { method, body });
    } catch (e) {
        console.log(body);
        console.log(e);
        throw { body, e };
    }

    if (Array.isArray(bridgeResult) && (bridgeResult.length >= 1) && bridgeResult[0].success) {
        return bridgeResult;
    }

    console.log(body);
    console.log(bridgeResult);
    throw { body, bridgeResult };
}

export async function put(address, body) {
    return send("PUT", address, body);
}

export async function create(address, body) {
    const bridgeResult = await send("POST", address, body);
    return bridgeResult[0].success.id;
}

function Address(connection, suffix) {
    return `https://${connection.bridge.ip}/api/${connection.token}/` + suffix;
}

export async function createSensor(connection, body) {
    const address = Address(connection, `sensors`);
    return create(address, body);
}

export async function setSensorValue(connection, id, value) {
    const store = (typeof value === "boolean") ? "flag" : "status";
    const address = Address(connection, `sensors/${id}/state`);
    const body = `{ "${store}": ${value} }`;
    return put(address, body);
}

export async function setSensorName(connection, id, value) {
    const address = Address(connection, `sensors/${id}`);
    const body = JSON.stringify({ "name": value });
    return put(address, body);
}

export async function setItemName(connection, kind, id, value) {
    const address = Address(connection, `${kind}/${id}`);
    const body = JSON.stringify({ "name": value });
    return put(address, body);
}

// buttonevent is not modifiable
// export async function setSensorButtonEvent(connection, id, value) {
//     const store = "buttonevent";
//     const address = Address(connection, `sensors/${id}/state`);
//     const body = `{ "${store}": ${value} }`;
//     return put(address, body);
// }

export async function setLightOn(connection, id, value) {
    const address = Address(connection, `lights/${id}/state`);
    const body = { on: value };
    return put(address, body);
}

export async function setLightCT(connection, id, value) {
    const address = Address(connection, `lights/${id}/state`);
    const body = { ct: value };
    return put(address, body);
}

export async function setGroupOn(connection, id, value) {
    const address = Address(connection, `groups/${id}/action`);
    const body = { on: value };
    return put(address, body);
}

export async function setGroupBrightness(connection, id, value, extras) {
    const address = Address(connection, `groups/${id}/action`);
    const body = extras ? { bri: value, ...extras } : { bri: value };
    return put(address, body);
}

export async function setGroupCT(connection, id, value) {
    const address = Address(connection, `groups/${id}/action`);
    const body = { ct: value };
    return put(address, body);
}

export async function setGroupScene(connection, id, sceneID) {
    const address = Address(connection, `groups/${id}/action`);
    const body = { scene: sceneID };
    return put(address, body);
}

export async function setRuleActions(connection, id, actions) {
    const address = Address(connection, `rules/${id}`);
    const body = { actions };
    return put(address, body);
}

export async function createSchedule(connection, body) {
    const address = Address(connection, `schedules`);
    return create(address, body);
}

export async function createRule(connection, body) {
    const address = Address(connection, `rules`);
    return create(address, body);
}

export async function createResourceLink(connection, body) {
    const address = Address(connection, `resourcelinks`);
    return create(address, body);
}

export async function deleteRule(connection, id) {
    const address = Address(connection, `rules/${id}`);
    const method = "DELETE";
    return fetchJSON(address, { method });
}

export async function deleteResourceLink(connection, id) {
    const address = Address(connection, `resourcelinks/${id}`);
    const method = "DELETE";
    return fetchJSON(address, { method });
}

export async function deleteSensor(connection, id) {
    const address = Address(connection, `sensors/${id}`);
    const method = "DELETE";
    return fetchJSON(address, { method });
}

export async function deleteSchedule(connection, id) {
    const address = Address(connection, `schedules/${id}`);
    const method = "DELETE";
    return fetchJSON(address, { method });
}

export async function deleteGroup(connection, id) {
    const address = Address(connection, `groups/${id}`);
    const method = "DELETE";
    return fetchJSON(address, { method });
}

export async function deleteScene(connection, id) {
    const address = Address(connection, `scenes/${id}`);
    const method = "DELETE";
    return fetchJSON(address, { method });
}

export async function getCategory(connection, category) {
    const address = Address(connection, `${category}`);

    let bridgeResult;
    try {
        bridgeResult = await fetchJSON(address);
    } catch (e) {
        console.log(e);
        throw { address, e };
    }

    return bridgeResult;
}

class Cache {
    constructor(name) {
        this.name = name;
        // Must be https for the cache API to work
        this.root = "https://callionica.com";
    }

    async cache() {
        if (this.cache_ === undefined) {
            this.cache_ = await caches.open(this.name);
        }
        return this.cache_;
    }

    async setItem(key, value) {
        const cache = await this.cache();
        const k = new URL(key, this.root);
        const v = { stored: new Date().toISOString(), value };
        const response = new Response(JSON.stringify(v));
        return await cache.put(k, response);
    }

    async getItem(key) {
        const cache = await this.cache();
        const k = new URL(key, this.root);
        const result = await cache.match(k) ?? undefined;
        if (result === undefined) {
            return result;
        }
        const o = await result.json();
        o.stored = new Date(o.stored);
        return o;
    }

    async removeItem(key) {
        const cache = await this.cache();
        const k = new URL(key, this.root);
        await cache.delete(k);
    }
}

const CACHE_NAME = "hue-callionica";
const cache = new Cache(CACHE_NAME);

export async function getAllCategories(connection, maximumCacheAgeMS = 0) {
    // Cache here because we still have non-cyclic data that can be stringified

    const key = `${connection.bridge.id}`;

    if (maximumCacheAgeMS > 0) {
        const o = await cache.getItem(key);
        if (o !== undefined) {
            const now = new Date();
            const milliseconds = now - o.stored;
            if (milliseconds < maximumCacheAgeMS) {
                return o.value;
            }
        }
    }

    const result = await getCategory(connection, "");

    // await here so that the caller doesn't change our data before we save it
    await cache.setItem(key, result);

    return result;
}

export async function getConfig(connection) {
    return getCategory(connection, "config");
}

export async function getCapabilities(connection) {
    return getCategory(connection, "capabilities");
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

const bridgeSceneCache = {};

export async function getSceneComplete(connection, sceneID, lastUpdated) {
    const bridgeID = connection.bridge.id;
    let sceneCache = bridgeSceneCache[bridgeID];
    if (sceneCache === undefined) {
        sceneCache = {};
        bridgeSceneCache[bridgeID] = sceneCache;
    }

    let scene = sceneCache[sceneID];
    if ((scene !== undefined) && (scene.lastupdated === lastUpdated)) {
        return scene;
    }

    const key = `{bridge:"${bridgeID}",scene:"${sceneID}"}`;
    const s = sessionStorage.getItem(key) || localStorage.getItem(key) || undefined;
    if (s !== undefined) {
        scene = JSON.parse(s);
        if (scene.lastupdated === lastUpdated) {
            sceneCache[sceneID] = scene;
            return scene;
        }
    }

    scene = await getCategory(connection, `scenes/${sceneID}`);

    sceneCache[sceneID] = scene;

    const storableValue = JSON.stringify(scene, null, 2);
    sessionStorage.setItem(key, storableValue);

    function storedSceneCount(storage, bridgeID) {
        return Object.entries(storage).filter(([name, value]) => name.startsWith(`{bridge:"${bridgeID}",scene:`)).length;
    }

    // Store some scenes for each bridge to localStorage for performance
    const maxStoredScenes = 200;
    if (localStorage.getItem(key) || storedSceneCount(localStorage, bridgeID) < maxStoredScenes) {
        localStorage.setItem(key, storableValue);
    }

    return scene;
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
    const address = Address(connection, `config/`);
    const body = `{"touchlink": true}`;
    return put(address, body);
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

// export async function registerApp(hub, appName, user) {
//     user = user || "";
//     const address = `https://${hub}/api/`;
//     const body = `{"devicetype": "${appName}#${user}"}`;
//     const method = "POST";
//     let bridgeResult = await send(method, address, body);
//     return { hub, app: bridgeResult[0].success.username };
// }

// export async function connect(hub, appName) {
//     const key = "hue-connection:" + hub;
//     const json = localStorage.getItem(key);
//     let connection;
//     if (json) {
//         connection = JSON.parse(json);
//         if (connection && connection.hub === hub) {
//             return connection;
//         }
//     }

//     connection = await registerApp(hub, appName);

//     localStorage.setItem(key, JSON.stringify(connection));

//     return connection;
// }

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

// function setButton(id, value) {
//     return `{
//         "address": "/sensors/${id}/state",
//         "method": "PUT",
//         "body": {
//             "buttonevent": ${value}
//         }
//     }`;
// }

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

// export async function createUserCount(connection, resourceName, userNames) {
//     const hub = connection.hub;
//     const app = connection.app;

//     const maximumUserCount = userNames.length;

//     async function createTriggerRule(countID, triggerID, oldValue, newValue) {
//         const body = `{
//             "name": "(${resourceName}${oldValue > newValue ? "-" : "+"})",
//             "conditions": [
//                 ${isUpdated(triggerID)},
//                 ${isEqual(countID, oldValue)}
//             ],
//             "actions": [
//                 ${setValue(countID, newValue)}
//             ]
//         }`;

//         return createRule(connection, body);
//     }

//     async function createTriggerSensor(countID, value) {
//         const id = await createFlagSensor(connection, `${resourceName}${value > 0 ? "+" : "-"}`, "(User Count Trigger)", false);
//         const rules = [];
//         for (var i = 0; i < maximumUserCount; ++i) {
//             const oldValue = (value > 0) ? i : i - value;
//             const newValue = oldValue + value;
//             const ruleID = await createTriggerRule(countID, id, oldValue, newValue);
//             rules.push(ruleID);
//         }

//         return { id, rules };
//     }

//     async function createUserCountSensor() {
//         return createStatusSensor(connection, resourceName, "User Count");
//     }

//     async function createUserRule(userID, userName, value, triggerID) {
//         const body = `{
//             "name": "(${userName})",
//             "conditions": [
//                 ${isEqual(userID, value)}
//             ],
//             "actions": [
//                 ${setValue(triggerID, true)}
//             ]
//         }`;

//         return createRule(connection, body);
//     }

//     async function createUserSensor(userName, increment, decrement) {
//         const id = await createFlagSensor(connection, userName, "User Count User", false);

//         const inc = await createUserRule(id, userName, true, increment.id);
//         const dec = await createUserRule(id, userName, false, decrement.id);
//         const rules = [inc, dec];

//         return { id, name: userName, rules };
//     }

//     async function createOverrideRule(triggerID, users, value) {
//         const actions = users.map(user => setValue(user.id, value)).join(",\n");

//         const body = `{
//             "name": "(${resourceName} Override)",
//             "conditions": [
//                 ${isUpdatedTo(triggerID, value)}
//             ],
//             "actions": [
//                 ${actions}
//             ]
//         }`;

//         return createRule(connection, body);
//     }

//     async function createOverrideSensor(users) {
//         const id = await createFlagSensor(connection, `${resourceName} Override`, "User Count Override", false);

//         const rules = [
//             await createOverrideRule(id, users, false),
//             await createOverrideRule(id, users, true)
//         ];

//         return { id, rules };
//     }

//     const id = await createUserCountSensor();
//     const increment = await createTriggerSensor(id, +1);
//     const decrement = await createTriggerSensor(id, -1);
//     const users = [];
//     for (const userName of userNames) {
//         const user = await createUserSensor(userName, increment, decrement);
//         users.push(user);
//     }
//     const override = await createOverrideSensor(users);

//     return { id, name: resourceName, triggers: [increment, decrement], users, override };
// }

// export async function deleteUserCount(connection, uc) {

//     for (const rule of uc.override.rules) {
//         await deleteRule(connection, rule);
//     }

//     await deleteSensor(connection, uc.override.id);

//     for (const user of uc.users) {
//         for (const rule of user.rules) {
//             await deleteRule(connection, rule);
//         }

//         await deleteSensor(connection, user.id);
//     }

//     for (const trigger of uc.triggers) {
//         for (const rule of trigger.rules) {
//             await deleteRule(connection, rule);
//         }

//         await deleteSensor(connection, trigger.id);
//     }

//     await deleteSensor(connection, uc.id);
// }

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

export async function createSceneCycle(connection, groupID, zoneID, powerManagementID, cycle) {
    cycle = cycle || [
        { fullPower: "Bright"    , lowPower: "Dimmed"    , startTime: "08:00:00" },
        { fullPower: "Relax"     , lowPower: "Dimmed"                       },
        { fullPower: "Nightlight", lowPower: "Nightlight", startTime: "23:00:00" },
    ];
    
    const bri_inc = 56;

    const cycleID = await createStatusSensor(connection, "Scene Cycle Current", "PM.Zone.Scenes.Current", 0);
    const actionID = await createStatusSensor(connection, "PMZ Action", "PM.Zone.Action", 0);

    async function createNext(index) {
        const last = (index === cycle.length - 1);
        const body = `{
        "name": "SC: Next",
        "conditions": [
            ${isUpdatedTo(actionID, SC_NEXT)},
            ${isEqual(powerManagementID, PMZ_ENABLED)},
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
            "address": "/api/${connection.token}/sensors/${cycleID}/state",
            "body": {
                "status": ${index}
            },
            "method": "PUT"
        }
        }`;
        return createSchedule(connection, body);
    }

    const schedules = [];
    const rules = [];
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
            ${isEqual(powerManagementID, PMZ_ENABLED)},
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
            ${isEqual(powerManagementID, PMZ_ENABLED)},
            ${isEqual(zoneID, PMZ_LOW_POWER)}
        ],
        "actions": [
            ${setValue(actionID, SC_LOW_POWER)}
        ]
        } `;
        return createRule(connection, body);
    }

    async function createActivateOff() {
        const body = `{
        "name": "SC: Activate",
        "conditions": [
            ${isUpdatedTo(actionID, SC_ACTIVATE)},
            ${isEqual(powerManagementID, PMZ_ENABLED)},
            ${isEqual(zoneID, PMZ_OFF)}
        ],
        "actions": [
            ${setValue(actionID, SC_OFF)}
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
        await createActivateOff(),
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
            "address": "/api/${connection.token}/sensors/${configurationID}/state",
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

// zone: { id, name, power: { fullPower, lowPower, reenable }}
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
                ${setValue(sceneCycle.action, SC_ACTIVATE)}
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
                ${setValue(sceneCycle.action, SC_ACTIVATE)}
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
                ${setValue(sceneCycle.action, SC_ACTIVATE)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function createEnabledRule(id, sceneCycle) {
        const body = `{
            "name": "LGT: Zone enabled",
            "conditions": [
                ${isChangedTo(id, PMZ_ENABLED)}
            ],
            "actions": [
                ${setValue(sceneCycle.action, SC_ACTIVATE)}
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
    const configs = [];
    for (let index = 0; index < zone.configurations.length; ++index) {
        const configuration = zone.configurations[index];
        const config = await createPMZConfiguration(connection, configuration, index, powerLevelID, powerManagementID, configurationID);
        configs.push(config);
    }

    // Create a scene cycle
    const sceneCycle = await createSceneCycle(connection, zone.id, powerLevelID, powerManagementID, zone.scenes);

    // Visualize power states
    const fullPowerRule = await createFullPowerRule(powerLevelID, sceneCycle);
    const lowPowerRule = await createLowPowerRule(powerLevelID, sceneCycle);
    const offRule = await createOffRule(powerLevelID, sceneCycle);

    const enabledRule = await createEnabledRule(powerManagementID, sceneCycle);

    const buttonRules = await createButtonRules(connection, powerLevelID, powerManagementID, sceneCycle)

    const rl = await createLinks(connection, zone.name, "Power Managed Zone", [
        `/groups/${zone.id}`,
        `/groups/0`,
        `/sensors/${powerLevelID}`,
        `/sensors/${powerManagementID}`,
        `/sensors/${configurationID}`,
        ...sceneCycle.sensors.map(r => `/sensors/${r}`),

        ...configs.flatMap(c => c.rules).map(r => `/rules/${r}`),
        
        ...sceneCycle.rules.map(r => `/rules/${r}`),
        `/rules/${fullPowerRule}`,
        `/rules/${lowPowerRule}`,
        `/rules/${offRule}`,
        `/rules/${enabledRule}`,
        ...buttonRules.map(r => `/rules/${r}`),

        ...configs.flatMap(c => c.schedules).map(r => `/schedules/${r}`),
        ...sceneCycle.schedules.map(r => `/schedules/${r}`),
    ]);

    return {
        id: rl,
        zone,
        powerLevel: powerLevelID,
        powerManagement: powerManagementID,
        configuration: configurationID,
        sceneCycle,
        sensors: [powerLevelID, powerManagementID], resourceLinks: [rl]
    };
}

export async function createButtonRules(connection, powerLevelID, powerManagementID, sceneCycle) {
    const actionID = sceneCycle.action;

    async function onDownWhenOff() {
        const body = `{
            "name": "DMR: Zone on full power",
            "conditions": [
                ${isUpdatedTo(actionID, BTN_ON + BTN_initial_press)},
                {
                    "address": "/sensors/${powerLevelID}/state/status",
                    "operator": "lt",
                    "value": "2"
                }
            ],
            "actions": [
                ${setValue(powerManagementID, PMZ_ENABLED)},
                ${setValue(powerLevelID, PMZ_FULL_POWER)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function onDownWhenDisabled() {
        const body = `{
            "name": "DMR: Zone on full power",
            "conditions": [
                ${isUpdatedTo(actionID, BTN_ON + BTN_initial_press)},
                ${isEqual(powerManagementID, PMZ_DISABLED)}
            ],
            "actions": [
                ${setValue(powerManagementID, PMZ_ENABLED)},
                ${setValue(powerLevelID, PMZ_FULL_POWER)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function onDownWhenOn() {
        const body = `{
            "name": "DMR: Next scene",
            "conditions": [
                ${isUpdatedTo(actionID, BTN_ON + BTN_initial_press)},
                ${isEqual(powerLevelID, PMZ_FULL_POWER)}
            ],
            "actions": [
                ${setValue(powerLevelID, PMZ_FULL_POWER)},
                ${setValue(actionID, SC_NEXT)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function bigStarDown() {
        const body = `{
            "name": "DMR: Brighter",
            "conditions": [
                ${isUpdatedTo(actionID, BTN_STAR_UP + BTN_initial_press)}
            ],
            "actions": [
                ${setValue(powerLevelID, PMZ_FULL_POWER)},
                ${setValue(actionID, SC_BRIGHTER)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function bigStarRepeat() {
        const body = `{
            "name": "DMR: Brighter",
            "conditions": [
                ${isUpdatedTo(actionID, BTN_STAR_UP + BTN_repeat)}
            ],
            "actions": [
                ${setValue(powerLevelID, PMZ_FULL_POWER)},
                ${setValue(actionID, SC_BRIGHTER)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function littleStarDown() {
        const body = `{
            "name": "DMR: Dimmer",
            "conditions": [
                ${isUpdatedTo(actionID, BTN_STAR_DOWN + BTN_initial_press)}
            ],
            "actions": [
                ${setValue(powerLevelID, PMZ_FULL_POWER)},
                ${setValue(actionID, SC_DIMMER)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function littleStarRepeat() {
        const body = `{
            "name": "DMR: Dimmer",
            "conditions": [
                ${isUpdatedTo(actionID, BTN_STAR_DOWN + BTN_repeat)}
            ],
            "actions": [
                ${setValue(powerLevelID, PMZ_FULL_POWER)},
                ${setValue(actionID, SC_DIMMER)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function shortOffWhenOn() {
        const body = `{
            "name": "DMR: Zone off; mngmnt enabled",
            "conditions": [
                ${isUpdatedTo(actionID, BTN_OFF + BTN_short_release)},
                {
                    "address": "/sensors/${powerLevelID}/state/status",
                    "operator": "gt",
                    "value": "0"
                }
            ],
            "actions": [
                ${setValue(powerManagementID, PMZ_ENABLED)},
                ${setValue(powerLevelID, PMZ_OFF)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function shortOffWhenOff() {
        const body = `{
            "name": "DMR: Zone on; mngmnt disabled",
            "conditions": [
                ${isUpdatedTo(actionID, BTN_OFF + BTN_short_release)},
                ${isEqual(powerLevelID, PMZ_OFF)}
            ],
            "actions": [
                ${setValue(powerLevelID, PMZ_FULL_POWER)},
                ${setValue(actionID, SC_FULL_POWER)},
                ${setValue(powerManagementID, PMZ_DISABLED)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function longOffWhenOff() {
        const body = `{
            "name": "DMR: Zone off; mngmnt disabled",
            "conditions": [
                ${isUpdatedTo(actionID, BTN_OFF + BTN_long_release)},
                ${isEqual(powerLevelID, PMZ_OFF)}
            ],
            "actions": [
                ${setValue(powerLevelID, PMZ_OFF)},
                ${setValue(actionID, SC_OFF)},
                ${setValue(powerManagementID, PMZ_DISABLED)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function longOff() {
        const body = `{
            "name": "DMR: Management disabled",
            "conditions": [
                ${isUpdatedTo(actionID, BTN_OFF + BTN_long_release)}
            ],
            "actions": [
                ${setValue(powerManagementID, PMZ_DISABLED)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function shortOff() {
        const body = `{
            "name": "DMR: Zone off; mngmnt enabled",
            "conditions": [
                ${isUpdatedTo(actionID, BTN_OFF + BTN_short_release)}
            ],
            "actions": [
                ${setValue(powerManagementID, PMZ_ENABLED)},
                ${setValue(powerLevelID, PMZ_OFF)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function shortOff1() {
        const body = `{
            "name": "DMR: Zone off; mngmnt enabled",
            "conditions": [
                {
                    "address": "/sensors/${powerLevelID}/state/status",
                    "operator": "gt",
                    "value": "0"
                },
                ${isUpdatedTo(actionID, BTN_OFF + BTN_short_release)}
            ],
            "actions": [
                ${setValue(powerManagementID, PMZ_ENABLED)},
                ${setValue(powerLevelID, PMZ_OFF)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function shortOff2() {
        const body = `{
            "name": "DMR: Zone off; mngmnt enabled",
            "conditions": [
                ${isEqual(powerManagementID, PMZ_DISABLED)},
                ${isUpdatedTo(actionID, BTN_OFF + BTN_short_release)}
            ],
            "actions": [
                ${setValue(powerManagementID, PMZ_ENABLED)},
                ${setValue(powerLevelID, PMZ_OFF)}
            ]
        }`;
        return createRule(connection, body);
    }

    async function shortOff3() {
        const body = `{
            "name": "DMR: Same as ON",
            "conditions": [
                ${isEqual(powerManagementID, PMZ_ENABLED)},
                ${isEqual(powerLevelID, PMZ_OFF)},
                ${isUpdatedTo(actionID, BTN_OFF + BTN_short_release)}
            ],
            "actions": [
                ${setValue(powerManagementID, PMZ_ENABLED)},
                ${setValue(powerLevelID, PMZ_FULL_POWER)}
            ]
        }`;
        return createRule(connection, body);
    }

    const rules = [
        await onDownWhenOff(),      // Zone on  and management on
        await onDownWhenDisabled(), // Zone on  and management on
        await onDownWhenOn(),       // Next scene
        
        await shortOff1(), // Zone off and management on
        await shortOff2(), // Zone off and management on
        await shortOff3(), // Zone on and management on
        await longOff(), // Management off

        await bigStarDown(),      // Brighter
        await bigStarRepeat(),    // Brighter

        await littleStarDown(),   // Dimmer
        await littleStarRepeat(), // Dimmer
    ];

    return rules;
}

export async function createPowerManagedDimmer(connection, name, dimmerID, pmz) {

    const MODE_ENABLED = 1;
    const modeID = await createStatusSensor(connection, name, "PM.Dimmer.Mode", MODE_ENABLED);

    function sensorID(name) {
        return pmz.sensors.filter(sensor => sensor.modelid === name)[0].id;
    }
    
    const actionID = sensorID("PM.Zone.Action");

    function delegateToZone(value) {
        const body = `{
            "name": "DMR to Zone",
            "conditions": [
                ${isEqual(modeID, MODE_ENABLED)},
                ${isButton(dimmerID, value)}
            ],
            "actions": [
                ${setValue(actionID, value)}
            ]
        }`;
        return createRule(connection, body);
    }
    
    const rules = [
        await delegateToZone(BTN_ON + BTN_initial_press),
        await delegateToZone(BTN_OFF + BTN_short_release),
        await delegateToZone(BTN_OFF + BTN_long_release),
        await delegateToZone(BTN_STAR_UP + BTN_initial_press),
        await delegateToZone(BTN_STAR_UP + BTN_repeat),
        await delegateToZone(BTN_STAR_DOWN + BTN_initial_press),
        await delegateToZone(BTN_STAR_DOWN + BTN_repeat),
    ];

    const rl = await createLinks(connection, name, "Power Managed Dimmer", [
        `/sensors/${dimmerID}`,
        `/resourcelinks/${pmz.id}`,
        `/groups/0`,
        `/sensors/${modeID}`,
        ...rules.map(rule => `/rules/${rule}`)
    ]);

    return rules;
}

export async function createPowerManagedMotionSensor(connection, name, motionID, pmz) {
    
    function sensorID(name) {
        return pmz.sensors.filter(sensor => sensor.modelid === name)[0].id;
    }
    
    const powerLevelID = sensorID("PM.Zone.PowerLevel");
    const powerManagementID = sensorID("PM.Zone.PowerManagement");

    const activation = await createStatusSensor(connection, "Motion Activation", "PM.Motion.Activation", PMM_TURN_ON);
    const actionID = await createStatusSensor(connection, "Motion Action", "PM.Motion.Action", 0);

    async function onActivate1() {
        const body = `{
            "name": "MTN: Activate",
            "conditions": [
                ${isUpdatedTo(actionID, PMM_ACTIVATE)},
                ${isEqual(activation, PMM_KEEP_ON)},
                {
                    "address": "/sensors/${powerLevelID}/state/status",
                    "operator": "gt",
                    "value": "0"
                }
            ],
            "actions": [
                ${setValue(powerLevelID, PMZ_FULL_POWER)}
            ]
        }`;
        return createRule(connection, body);
    }

    // When power management is enabled, we can turn on the lights (not just keep them on)
    async function onActivate2() {
        const body = `{
            "name": "MTN: Activate",
            "conditions": [
                ${isUpdatedTo(actionID, PMM_ACTIVATE)},
                ${isEqual(powerManagementID, PMZ_ENABLED)},
                ${isEqual(activation, PMM_TURN_ON)}
            ],
            "actions": [
                ${setValue(powerLevelID, PMZ_FULL_POWER)}
            ]
        }`;
        return createRule(connection, body);
    }

    // When power management is disabled, we only keep on the lights (not turn them on)
    async function onActivate3() {
        const body = `{
            "name": "MTN: Activate",
            "conditions": [
                ${isUpdatedTo(actionID, PMM_ACTIVATE)},
                ${isEqual(powerManagementID, PMZ_DISABLED)},
                ${isEqual(activation, PMM_TURN_ON)},
                {
                    "address": "/sensors/${powerLevelID}/state/status",
                    "operator": "gt",
                    "value": "0"
                }
            ],
            "actions": [
                ${setValue(powerLevelID, PMZ_FULL_POWER)}
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
                ${isChangedTo(powerLevelID, PMZ_LOW_POWER)}
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

    const rules = [
        await onActivate1(),
        await onActivate2(),
        await onActivate3(),
        await onLowPower(),
        await onPresence(),
    ];

    const rl = await createLinks(connection, name, "Power Managed Motion Sensor", [
        `/sensors/${motionID}`,
        `/resourcelinks/${pmz.id}`,
        `/groups/0`,
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
            ]
    },
    {
        modelid: "PM.Zone.Action",
        manufacturername: "Callionica",
        component: "Power Managed Zone",
        property: "Action",
        status: [
            { value: SC_ACTIVATE, name: "Scene > Activate", description: "Activate the appropriate version of the current scene for the zone's power state. (Disabled when power management is disabled)." },
            { value: SC_NEXT, name: "Scene > Next", description: "Move to the next scene and activate it. (Disabled when power management is disabled)." },
            { value: SC_BRIGHTER, name: "Lights > Brighter", description: "Make the lighting brighter" },
            { value: SC_DIMMER, name: "Lights > Dimmer", description: "Make the lighting dimmer" },
            { value: SC_FULL_POWER, name: "Lights > Full power", description: "Turn on the lights using the full power version of the current scene" },
            { value: SC_LOW_POWER, name: "Lights > Low power", description: "Turn on the lights using the low power version of the current scene" },
            { value: SC_OFF, name: "Lights > Off", description: "Turn off the lights" },

            { value: BTN_ON + BTN_initial_press, name: "Button > I > Down", description: "Press the button" },

            { value: BTN_OFF + BTN_short_release, name: "Button > O > Up (short)", description: "Release the button" },
            { value: BTN_OFF + BTN_long_release, name: "Button > O > Up (long)", description: "Release the button after a pause" },

            { value: BTN_STAR_UP + BTN_initial_press, name: "Button > + > Down", description: "Press the button" },
            { value: BTN_STAR_UP + BTN_repeat, name: "Button > + > Repeat", description: "Fires repeatedly while the button is down" },

            { value: BTN_STAR_DOWN + BTN_initial_press, name: "Button > - > Down", description: "Press the button" },
            { value: BTN_STAR_DOWN + BTN_repeat, name: "Button > - > Repeat", description: "Fires repeatedly while the button is down" },
        ]
    },
    {
        modelid: "PM.Dimmer.Mode",
        manufacturername: "Callionica",
        component: "Power Managed Dimmer",
        property: "Mode",
        status: [
            { value: 1, name: "Enabled", description: "Enable the dimmer" },
            { value: 0, name: "Disabled", description: "Disable the dimmer" }
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
    {
        modelid: "4PD.Period",
        manufacturername: "Callionica",
        component: "Four-part Day",
        property: "Period",
        status: [
            { value: 1, name: "Morning", description: "A period for waking" },
            { value: 2, name: "Day", description: "A period for working" },
            { value: 3, name: "Evening", description: "A period for relaxing" },
            { value: 4, name: "Night", description: "A period for sleeping" },
        ]
    },
    {
        modelid: "4PD.TimedPeriod",
        manufacturername: "Callionica",
        component: "Four-part Day",
        property: "TimedPeriod",
        status: [
            { value: 1, name: "Morning", description: "A period for waking" },
            { value: 2, name: "Day", description: "A period for working" },
            { value: 3, name: "Evening", description: "A period for relaxing" },
            { value: 4, name: "Night", description: "A period for sleeping" },
        ]
    },
    {
        modelid: "4PD.Mode",
        manufacturername: "Callionica",
        component: "Four-part Day",
        property: "Mode",
        status: [
            { value: 1, name: "Automatic", description: "The current period can be changed automatically" },
            { value: 2, name: "Manual", description: "The current period can be changed manually" },
            { value: 3, name: "Locked", description: "The current period cannot be changed" },
        ]
    },
];

const components = [
    {
        manufacturer: "Callionica",
        name: "Four-part Day",
        creatable: true,
        comment: "Divide the day into four parts",
        description: "Create rules based on four parts of the day: Morning, Day, Evening, and Night",
        url: "https://github.com/callionica/hue/blob/master/4PD.md",
    },
    {
        manufacturer: "Callionica",
        name: "Power Managed Zone",
        comment: "A room or zone that turns itself off after a period of time",
        description: "A room or zone that turns itself off after a period of time and that has a list of scenes that can be triggered manually or automatically at a certain time. Power managed zones have three power levels: Full Power, Low Power, and Off. The Low Power level gives you a warning that the lights will be turning off, allowing you to take an action to keep the lights on if necessary. Power Managed Zones have custom integrations with dimmers and motion sensors to ensure that all devices work well together in a standard way. Power management can be disabled (temporarily). The timings are all configurable, but examples might be 10 minutes before the zone switches from Full Power to Low Power, 1 minute before the zone switches from Low Power to Off, and 8 hours before the zone re-enables power management automatically.",
        url: "https://github.com/callionica/hue/blob/master/power-managed-zone.md",
    },
    {
        manufacturer: "Callionica",
        name: "Power Managed Dimmer",
        comment: "A dimmer that has been configured to work with a Power Managed Zone",
        description: "A dimmer that has been configured to work with a Power Managed Zone.",
        url: "https://github.com/callionica/hue/blob/master/power-managed-zone.md",
    },
    {
        manufacturer: "Callionica",
        name: "Power Managed Motion Sensor",
        comment: "A motion sensor that has been configured to work with a Power Managed Zone",
        description: "A motion sensor that has been configured to work with a Power Managed Zone. Power Managed Motion Sensors are designed to work well together with other Power Managed Motion Sensors and with Power Managed Dimmers controlling the same zone. Power Managed Motion Sensors do not turn off the lights, Power Managed Zones do that themselves. Power Managed Motion Sensors can either turn on the lights, keep the lights on, or do nothing. The option to keep the lights on, but not turn them on, can be useful where the motion sensor can not be positioned to avoid unwanted motion (such as pets). It can also be helpful where people are used to turning lights on and off manually.",
        url: "https://github.com/callionica/hue/blob/master/power-managed-zone.md",
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
                return { category, item: o };
            }
        }
    }

    return { category: "invalidLinks", item: link };
}

// Converts all links to their respective objects and separates them into categories
// Links from the start of the list up to the first "/groups/0" are "connections"
function expandResourceLink(id, data) {
    const resourceLink = data.resourcelinks[id];

    resourceLink.connections = [];
    resourceLink.groups = [];
    resourceLink.schedules = [];
    resourceLink.scenes = [];
    resourceLink.sensors = [];
    resourceLink.rules = [];
    resourceLink.resourcelinks = [];

    let connections = resourceLink.connections;

    for (const link of resourceLink.links) {
        
        if (connections && link === "/groups/0") {
            connections = null;
            continue;
        }

        const o = expandLink(link, data);
        if (o) {
            if (connections) {
                connections.push(o);
            } else {
                const c = resourceLink[o.category] || [];
                c.push(o.item);
                resourceLink[o.category] = c;    
            }
        }
    }

    return resourceLink;
}

export function sortBy(keyFn) {
    return function sorter(a, b) {
        const keyA = keyFn(a);
        const keyB = keyFn(b);
        if (keyA < keyB) return -1;
        if (keyA > keyB) return 1;
        return 0;
    }
}

function extractAgenda(sensor, schedules) {
    const result = [];
    const address = `/sensors/${sensor.id}/state`;
    const enabledSchedules = schedules.filter(schedule => (schedule.status === "enabled") && schedule.command.address.endsWith(address));
    for (const schedule of enabledSchedules) {
        const localTime = schedule.localtime;
        const value = schedule.command.body.status;
        result.push({ localTime, sensor, value, schedule });
    }

    return result.sort(sortBy(x => x.localTime));
}

function extractDaylightAgenda(sensor, data) {
    const result = [];
    // if (!data.sensors[1].config.on) {
    //     return result;
    // }
    const rules = Object.values(data.rules);
    const address = `/sensors/${sensor.id}/state`;
    const daylightSensor = `/sensors/1/state/`; // TODO
    const daylight = daylightSensor + `daylight`;

    const enabledRules = rules.filter(rule => (rule.status === "enabled") && (rule.actions) && (rule.conditions));

    for (const rule of enabledRules) {
        for (const trigger of rule.triggers) {
            const condition = trigger.conditions.filter(c => c.address === daylight && c.operator === "eq")[0];
            if (!condition) {
                continue;
            }

            // A combination of the test above that gets us a condition that matches
            // and the fact that we've already paired conditions into a trigger means
            // that we only need to look at the operator here
            const ddxCondition = trigger.conditions.filter(c => c.operator === "ddx")[0];

            for (const action of rule.actions) {
                if (action.address === address) {
                    let localTime = (condition.value === "true") ? "sunrise" : "sunset";
                    if (ddxCondition) {
                        localTime += "+" + ddxCondition.value; // TODO
                    }
                    const value = action.body.status;
                    result.push({ localTime, sensor, value, rule });
                }
            }
        }
    }

    return result;
}

function extractProperty(sensor, schedules, rules, propertyMetadata) {

    const values = [];

    const address = `/sensors/${sensor.id}/state/status`;
    const ruleName = propertyMetadata.item.toLowerCase();
    const enabledRules = rules.filter(rule => (rule.name.toLowerCase() === ruleName) && (rule.status === "enabled"));

    for (const rule of enabledRules) {
        const valueCondition = rule.conditions.filter(condition => (condition.address === address) && (condition.operator === "eq"))[0];
        if (valueCondition) {
            const value = parseInt(valueCondition.value, 10);
            if (propertyMetadata.kind === "ddx") {
                const propertyCondition = rule.conditions.filter(condition => (condition.operator === "ddx"))[0];
                if (propertyCondition) {
                    const propertyValue = propertyCondition.value;
                    values.push({ value, propertyValue });
                    continue;
                }
            } else if (propertyMetadata.kind === "scene") {
                // TODO error handling
                const propertyValue = rule.actions.filter(action => action.body.scene)[0].body.scene;
                values.push({ value, propertyValue, rule });
                continue;
            }

            values.push({ value });
        }
    }

    const result = [];

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

function rearrangeProperties(values, data) {
    const result = [];

    for (const v of values) {
        for (const d of v.data) {
            let existing = result.find(e => e.value === d.value);
            if (!existing) {
                existing = {value: d.value, properties: []};
                result.push(existing);
            }

            existing.properties.push({ name: v.metadata.property, value: d.propertyValue, kind: v.metadata.kind, rule: d.rule });
        }
    }

    function displayValue(p) {
        if (((p.kind === "ddx") || (p.kind === "schedule")) && p.value.startsWith("PT")) {
            return p.value.substring(2);
        }

        if (p.kind === "schedule" && p.value.startsWith("W127/T")) {
            return p.value.substring("W127/T".length);
        }

        if (p.kind === "scene") {
            return data.scenes[p.value]?.name || `(Scene: ${p.value})`;
        }

        return "" + p.value;
    }

    for (const v of result) {
        v.name = v.properties.map(p => { p.displayValue = displayValue(p); return p.name + ": " + p.displayValue; }).join(", ");
    }

    return result;
}

export function rearrangeForHueComponents(data) {
    // Give all objects their id property
    Object.entries(data).forEach(([category, collection]) => {
        if (["lights", "groups", "schedules", "scenes", "sensors", "rules", "resourcelinks"].includes(category)) {
            Object.entries(collection).forEach(([id, item]) => item.id = id)
        }
    });

    // Mark rule conditions as triggers
    Object.values(data.rules).forEach(rule => {
        // A condition is part of a trigger if any of the following applies:
        // 1. It's a dx condition
        // 2. It's a ddx condition
        // 3. There's a dx condition that matches it
        // 4. There's a ddx condition that matches it
        // 5. There are no dx or ddx conditions anywhere in the rule
        //
        // "A dx condition that matches it" is interesting:
        // For our purposes we match dx and ddx conditions for both "/state/status" and "/state/lastupdated".
        // Clearly we have to match /state/status.
        // state/lastupdated might not guarantee that /state/status has changed, but it does include that possibility, so we have to match that too. In fact, many rules with state/lastupdated
        // appear to be intended to trigger mainly or only when state/status has changed.

        const triggers = [];

        const dxx = rule.conditions.filter(condition => (condition.operator === "dx") || (condition.operator === "ddx"));

        dxx.forEach(condition => {
            condition.trigger = { conditions: [condition] };
            triggers.push(condition.trigger);
        });

        const allAreTriggers = (dxx.length === 0);

        function lastUpdated(address) {
            const path = address.split("/");
            return path.slice(0, path.length - 1).join("/") + "/lastupdated";
        }

        function noteTrigger(condition) {
            if ((condition.operator === "dx") || (condition.operator === "ddx")) {
                return;
            }

            if (allAreTriggers) {
                condition.trigger = { conditions: [condition] };
                triggers.push(condition.trigger);
            }

            const myself = condition.address;
            const mylastupdated = lastUpdated(condition.address);

            const matchDXX = dxx.filter(c => (c.address === myself) || (c.address === mylastupdated));
            matchDXX.forEach(d => {
                const trigger = d.trigger;
                condition.trigger = trigger;
                trigger.conditions.push(condition);
            });
        }

        rule.conditions.forEach(noteTrigger);
        rule.triggers = triggers;
    });

    data.components = {};

    return Object.entries(data.resourcelinks).filter(([id, resourceLink]) => resourceLink.classid === COMPONENT_CLASSID).map(([id, resourceLink]) => {
        const component = expandResourceLink(id, data);

        data.components[component.id] = component;

        component.metadata = components.filter(c => c.name === component.description)[0];

        for (const sensor of component.sensors) {
            // Link from sensor to component
            sensor.component = component;

            const metadata = componentSensors.filter(cs => cs.modelid === sensor.modelid && cs.manufacturername == sensor.manufacturername)[0];
            if (metadata) {
                sensor.metadata = metadata;

                let value = { value: sensor.state.status, name: sensor.state.status };

                let values;
                if (metadata.list) {
                    const v = metadata.list.map(propertyMetadata => {
                        return {
                            metadata: propertyMetadata,
                            data: extractProperty(sensor, component.schedules, component.rules, propertyMetadata)
                        };
                    });
                    
                    values = rearrangeProperties(v, data);
                } else {
                    values = metadata.status.map(s => { return {...s}; });
                }

                if (values) {
                    sensor.values = values;
                    const v = values.filter(status => status.value === sensor.state.status)[0];
                    if (v) {
                        value = v;
                    }
                }

                sensor.value = value;
            }
        }

        const agendaBySensor = component.sensors.flatMap(sensor => extractAgenda(sensor, Object.values(data.schedules)));

        const agenda = agendaBySensor.sort(sortBy(x => x.localTime));

        const daylightAgenda = component.sensors.flatMap(sensor => extractDaylightAgenda(sensor, data));


        component.agenda = agenda;
        component.daylightAgenda = daylightAgenda;
        // console.log(daylightAgenda);

        return component;
    });
}

/** Returns a cyclic graph of Hue data including Hue components */
export async function getAll(connection, maximumCacheAgeMS = 0) {
    const data = await getAllCategories(connection, maximumCacheAgeMS);
    
    // Promote and standardize the bridge ID
    data.id = data.config.bridgeid.toLowerCase();

    rearrangeForHueComponents(data);

    return data;
}

/* Same as getAll plus all the scene details (using the scene cache) */
export async function getAllPlus(connection, maximumCacheAgeMS = 0) {
    const data = await getAll(connection, maximumCacheAgeMS);

    for (const light of Object.values(data.lights)) {
        light.calculated = {};
        light.calculated.ct = lightCT(light);
        light.calculated.xy = lightXY(light);
    }

    const scenes = Object.values(data.scenes);
    
    // Use retries here because otherwise we hit throttling limit
    for (const scene of scenes) {
        const get = () => getSceneComplete(connection, scene.id, scene.lastupdated);
        const completeScene = await retry(get, [25, 100, 200]);
        scene.lightstates = completeScene.lightstates;
    }

    for (const scene of scenes) {
        scene.active = isActiveScene(data, scene);
    }

    const sensors = Object.values(data.sensors);

    // Group together the presence, light level, and temperature sensor of
    // a single Hue Motion Sensor
    const motionSensors = sensors.filter(sensor => sensor.manufacturername.startsWith("Signify") && sensor.type === "ZLLPresence");

    for (const motionSensor of motionSensors) {
        const prefix = motionSensor.uniqueid.substring(0, motionSensor.uniqueid.length - 4);

        const lightLevelSensors = sensors.filter(sensor => sensor.type === "ZLLLightLevel" && sensor.manufacturername === motionSensor.manufacturername && sensor.modelid === motionSensor.modelid && sensor.uniqueid.startsWith(prefix));
        const temperatureSensors = sensors.filter(sensor => sensor.type === "ZLLTemperature" && sensor.manufacturername === motionSensor.manufacturername && sensor.modelid === motionSensor.modelid && sensor.uniqueid.startsWith(prefix));

        if (lightLevelSensors.length === 1 && temperatureSensors.length === 1) {
            const l = lightLevelSensors[0];
            const t = temperatureSensors[0];
            const device = [motionSensor, l, t];
            for (const item of device) {
                item.device = device;
            }
        }
    }

    const temperatures = sensors.filter(sensor => sensor?.state?.temperature !== undefined);

    function CtoF(c) {
        return (c * 9/5) + 32;
    }

    function temp(sensor) {
        if (sensor === undefined) {
            return;
        }

        const isOn = (sensor) => {
            const on = sensor.config?.on;
            return on || (on === undefined);
        };

        const isReachable = (sensor) => {
            const reachable = sensor.config?.reachable;
            return reachable || (reachable === undefined);
        };

        if (isOn(sensor) && isReachable(sensor)) {
            return sensor.state?.temperature;
        }
    }

    function C(sensor) {
        const v = temp(sensor);
        if (v === undefined) {
            return;
        }
        return (v/100).toFixed(1);
    }

    function F(sensor) {
        const v = temp(sensor);
        if (v === undefined) {
            return;
        }
        return CtoF(v/100).toFixed(1);
    }

    for (const sensor of temperatures) {
        sensor.fahrenheit = F(sensor);
        sensor.celsius = C(sensor);
    }

    for (const group of Object.values(data.groups)) {
        group.lightSummary = summarizeLights(group, data);
        group.temperatures = temperatures.filter(sensor => sensor.name === group.name);
    }

    return data;
}

export function getConnectedComponents(item, data) {
    return Object.values(data.components).filter(c => c.connections.find(cn => cn.item === item));
}

export async function deleteComponent(connection, component) {
    
    for (const group of component.groups) {
        await deleteGroup(connection, group.id);
    }

    for (const schedule of component.schedules) {
        await deleteSchedule(connection, schedule.id);
    }

    for (const scene of component.scenes) {
        await deleteScene(connection, scene.id);
    }

    for (const sensor of component.sensors) {
        await deleteSensor(connection, sensor.id);
    }

    for (const rule of component.rules) {
        await deleteRule(connection, rule.id);
    }

    for (const resourceLink of component.resourcelinks) {
        if (resourceLink.classid === COMPONENT_CLASSID) {
            // Don't recommend having subcomponents
            // If you want to refer to another component that you depend on, put it in the "connections" list
            // If another component depends on you, your component should be in its connections list
            console.log(`Delete: subcomponent ${resourceLink.description}`);
            await deleteComponent(connection, resourceLink);
        } else {
            await deleteResourceLink(connection, resourceLink.id);
        }
    }

    // The component itself is a resourcelink
    await deleteResourceLink(connection, component.id);
}

export function displayLocalTime(value) {
    if (value.startsWith("W127/T")) {
        value = value.substring("W127/T".length);
    }
    if (value.endsWith(":00")) {
        value = value.substring(0, value.length - 3);
    }
    return value;
}

// TODO - freeze/copy metadata

/*
Returns true if the condition matches the specified sensor-property-value.
Otherwise returns false.
ONLY DEALING WITH EQ OPERATOR
*/
export function isMatchingCondition(condition, sensorID, property, value) {
    const sensorAddress = `/sensors/${sensorID}/state/${property}`;
    if (condition.address === sensorAddress) {
        if (condition.operator === "eq") {
            const textValue = `${value}`;
            return condition.value === textValue;
        }
    }
    return false;
}

/** Rules where the sensor is used as a trigger */
export function getSensorTriggeredRules(rules, sensorID) {
    const prefix = `/sensors/${sensorID}/`;
    return rules.filter(rule => rule.triggers.some(trigger => trigger.conditions.some(condition => condition.address.startsWith(prefix))));
}

/** Rules where the sensor is used as a condition */
export function getSensorConditionRules(rules, sensorID) {
    const prefix = `/sensors/${sensorID}/`;
    return rules.filter(rule => rule.conditions.some(condition => condition.address.startsWith(prefix)));
}

/** Rules where the sensor is updated by an action */
export function getSensorUpdatingRules(rules, sensorID) {
    const prefix = `/sensors/${sensorID}/`;
    return rules.filter(rule => rule.actions.some(action => action.address.startsWith(prefix)));
}

/** Schedules where the sensor is updated by a command */
export function getSensorUpdatingSchedules(schedules, sensorID) {
    const prefix = `/sensors/${sensorID}/`;
    return schedules.filter(schedule => {
        const address = schedule.command.address.replace(/^[/]api[/][^/]+[/]/, "/");
        return address.startsWith(prefix);
    });
}

/*
Returns an array of rules using the specified condition
Rules is an array of rules
*/
export function getMatchingRules(rules, sensorID, property, value) {
    return rules.filter(rule => rule.conditions.some(condition => isMatchingCondition(condition, sensorID, property, value)));
}

export function convertButtonRule(
    rule,
    oldSensorID, oldProperty, oldButtonEvent,
    newSensorID, newProperty, newButtonEvent,
) {
    const newRule = { name: rule.name, conditions: [...rule.conditions], actions: [...rule.actions] };

    const oldSensorBE = `/sensors/${oldSensorID}/state/${oldProperty}`;
    const oldSensorLU = `/sensors/${oldSensorID}/state/lastupdated`;
    const newSensorBE = `/sensors/${newSensorID}/state/${newProperty}`;
    const newSensorLU = `/sensors/${newSensorID}/state/lastupdated`;
    const oldButtonValue = `${oldButtonEvent}`;
    const newButtonValue = `${newButtonEvent}`;

    for (const condition of newRule.conditions) {
        if (condition.address === oldSensorBE) {
            condition.address = newSensorBE;
            if (condition.value === oldButtonValue && condition.operator === "eq") {
                condition.value = newButtonValue;
            }
        } else if (condition.address === oldSensorLU) {
            condition.address = newSensorLU;
        }
    }

    return newRule;
}

export async function copyButtonEvent(connection, data, oldSensorID, oldButtonEvent, newSensorID, newButtonEvent) {

    const oldProperty = data.sensors[newSensorID].type === "ZLLSwitch" ? "buttonevent" : "status";
    const newProperty = data.sensors[newSensorID].type === "ZLLSwitch" ? "buttonevent" : "status";

    const rules = getMatchingRules(Object.values(data.rules), oldSensorID, oldProperty, oldButtonEvent);
    const converted = rules.map(rule => convertButtonRule(rule, oldSensorID, oldProperty, oldButtonEvent, newSensorID, newProperty, newButtonEvent));

    for (const rule of converted) {
        await createRule(connection, rule);
    }
}

export async function copyButton(connection, data, oldSensorID, oldButton, newSensorID, newButton) {
    for (const event of [0, 1, 2, 3]) {
        await copyButtonEvent(connection, data, oldSensorID, oldButton + event, newSensorID, newButton + event);
    }
}

export async function copyButtonAccessory(connection, data, sourceSensorID, destinationSensorID) {
    // Only copy buttons present in the destination
    const destination = data.sensors[destinationSensorID];
    
    // Switches can tell us the number of buttons
    let buttons = destination?.capabilities?.inputs?.map(input => input.events[0].buttonevent);
    if (buttons === undefined) {
        // Generic sensors support up to 4 buttons
        buttons = [1000, 2000, 3000, 4000];
    }

    for (const button of buttons) {
        await copyButton(connection, data, sourceSensorID, button, destinationSensorID, button);
    }
}

// Returns changes to the bridge in a date-ordered list with the most recent changes at the head
// to the extent allowable by the date stamps that are tracked by the bridge.
/*
swupdate.lastinstall (lights/sensors)
state.lastupdated (sensors)
lasttriggered (rules) - can be “none”
created (rules, schedules)
starttime (schedules) - only for timers
lastupdated (scenes)
swupdate2.bridge.lastinstall (config)
swupdate2.lastchange (config) - is this release date of the firmware???
whitelist.<X>.create date (config) - it has a space
whitelist.<X>.last use date (config) - it has two spaces
*/
export function getLastChanges(data) {
    const result = [];

    for (const [id, light] of Object.entries(data.lights)) {
        const o = { id, ...light };
        const lastinstall = o.swupdate?.lastinstall;
        if ((lastinstall !== undefined) && (lastinstall !== "none")) {
            result.push(["installed", lastinstall, "light", o]);
        }
    }

    for (const [id, sensor] of Object.entries(data.sensors)) {
        const o = { id, ...sensor };
        const lastinstall = o.swupdate?.lastinstall;
        if ((lastinstall !== undefined) && (lastinstall !== "none")) {
            result.push(["installed", lastinstall, "sensor", o]);
        }

        const lastupdated = o.state?.lastupdated;
        if ((lastupdated !== undefined) && (lastupdated !== "none")) {
            result.push(["updated", lastupdated, "sensor", o]);
        }
    }

    for (const [id, rule] of Object.entries(data.rules)) {
        const o = { id, ...rule };
        const lasttriggered = o.lasttriggered;
        if ((lasttriggered !== undefined) && (lasttriggered !== "none")) {
            result.push(["triggered", lasttriggered, "rule", o]);
        }

        const created = o.created;
        if ((created !== undefined) && (created !== "none")) {
            result.push(["created", created, "rule", o]);
        }
    }

    for (const [id, schedule] of Object.entries(data.schedules)) {
        const o = { id, ...schedule };
        const starttime = o.starttime;
        if ((starttime !== undefined) && (starttime !== "none")) {
            result.push(["started", starttime, "schedule", o]);
        }

        const created = o.created;
        if ((created !== undefined) && (created !== "none")) {
            result.push(["created", created, "schedule", o]);
        }
    }

    for (const [id, scene] of Object.entries(data.scenes)) {
        const o = { id, ...scene };

        const lastupdated = o.lastupdated;
        if ((lastupdated !== undefined) && (lastupdated !== "none")) {
            result.push(["updated", lastupdated, "scene", o]);
        }
    }

    for (const [id, user] of Object.entries(data.config.whitelist)) {
        const o = { id, ...user };

        const created = o["create date"];
        if ((created !== undefined) && (created !== "none")) {
            result.push(["created", created, "user", o]);
        }

        const used = o["last use date"];
        if ((used !== undefined) && (used !== "none")) {
            result.push(["used", used, "user", o]);
        }
    }

    if (true) {
        const lastinstall = data.config.swupdate2?.bridge?.lastinstall;
        if ((lastinstall !== undefined) && (lastinstall !== "none")) {
            result.push(["installed", lastinstall, "bridge", data.config]);
        }

        const lastchange = data.config.swupdate2?.lastchange;
        if ((lastchange !== undefined) && (lastchange !== "none")) {
            result.push(["changed", lastchange, "software-update", data.config]);
        }
    }

    return result.sort((a,b) => -a[1].localeCompare(b[1], "en"));
}

export function summarizeLights(group, data) {
    if (group.lights.length === 0) {
        return { anyOn: false, allOn: false, anyUnreachable: true, allUnreachable: true };
    }

    let anyOn = false;
    let allOn = true;
    let countOn = 0;
    let anyUnreachable = false;
    let allUnreachable = true;
    let maximumBrightness = -1;
    let anyDimmable = false;
    let maximumColorTemperature = -1;

    for (const lightID of group.lights) {
        const light = data.lights[lightID];

        const unreachable = !light.state.reachable;
        const on = (light.state.on && light.state.reachable);

        if (on) {
            ++countOn;
            anyOn = true;
            if (light.state.bri > maximumBrightness) {
                maximumBrightness = light.state.bri;
            }
            const ct = light.calculated.ct || lightCT(light);
            if (ct > maximumColorTemperature) {
                maximumColorTemperature = ct;
            }
        }

        allOn = allOn && on;

        if (unreachable) {
            anyUnreachable = true;
        } else {
            if (light.state.bri !== undefined) { // Could do light.capabilities.control.maxlumen
                anyDimmable = true;
            }
        }

        allUnreachable = allUnreachable && unreachable;
    }

    // If any lights are on, but we didn't get a positive brightness value
    // we must have non-dimmable lights that are on, so treat max brightness as 100%.

    // Note that max brightness can decrease when a new light is switched on.
    // For example, a non-dimmable bulb is on, giving bri of 100%
    // then a dimmable bulb is switched on in addition, giving a bri of 50%.

    // In other words, maximumBrightness is the maximum brightness of
    // dimmable lights that are on unless there are no such lights
    // in which case it is 100% if any non-dimmable lights are on.

    if (anyOn && maximumBrightness < 0) {
        maximumBrightness = 254;
    }

    return { anyOn, allOn, countOn, anyUnreachable, allUnreachable, anyDimmable, maximumBrightness, maximumColorTemperature };
}

function eq(a, b) {
    // Array equality means each element is equal
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
            return false;
        }
        return a.every((v, i) => eq(v, b[i]));
    }

    // Check numeric equality to 3 DP
    if (Number.isFinite(a) && Number.isFinite(b)) {
        return Math.round(a * 1000) === Math.round(b * 1000);
    }

    return a === b;
}

function eqXY(a, b) {
    const e = (p) => Math.abs(Math.round(a[p] * 1000) - Math.round(b[p] * 1000)) < 2;
    return e("x") && e("y");
}

// Scenes need to have finished their transitions for this to work.
// Only scenes that contain a light with a matching light state will match.
// By default, an unreachable light will not disqualify a scene.
function isActiveScene(data, scene, options = { allowUnreachable: true }) {

    // if (!(scene.name === "Nightlight" && scene.group === "2")) {
    //     return false;
    // }

    // console.log(scene.name, scene.group);

    let same = true;
    let matchedSceneValue = false;
    let unreachable = false;

    const states = Object.entries(scene.lightstates);
    for (const [lightID, sceneState] of states) {

        const light = data.lights[lightID];
        const lightState = light.state;

        if (!lightState.reachable) {
            unreachable = true;
            if (!options.allowUnreachable) {
                same = false;
                break;
            } else {
                continue;
            }
        }

        for (const [prop, sceneValue] of Object.entries(sceneState))  {
            if (["transitiontime"].includes(prop)) {
                continue;
            }

            if (["ct", "xy"].includes(prop)) {
                if (light.state?.colormode === undefined) {
                    // If the light is not color-capable, it won't have a colormode
                    // and we can ignore any attempts by the scene to change color
                    continue;
                }

                const xyLight = light.calculated.xy || lightXY(light);
                const xyScene = (prop === "ct") ? ctToXY(sceneValue) : new Point(sceneValue[0], sceneValue[1]);
                if (!eqXY(xyLight, xyScene)) {
                    // console.log(prop, light.name, xyLight, xyScene, sceneValue);
                    same = false;
                    break;
                }
            } else {
                const lightValue = lightState[prop];
                if (!eq(lightValue, sceneValue)) {
                    // console.log(prop, light.name, lightValue, sceneValue);
                    same = false;
                    break;
                }
            }

            matchedSceneValue = true;
        }

        if (!same) {
            break;
        }
    }

    return same && matchedSceneValue;
}
