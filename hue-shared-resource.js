"use strict";

// Hope this works!
function uuid() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

// A shared resource is:
// 1. A ClipGenericStatus sensor which represents the number of users
// 2. A ClipGenericFlag sensor that can be used to trigger an increment of the user count
// 3. A ClipGenericFlag sensor that can be used to trigger a  decrement of the user count
// 4. N rules that increment/decrement the user count in response to the triggers (where N is the maximum number of users).
// 5. N ClipGenericFlag sensors: one for each potential user indicating whether they are using the resource or not
// 6. 2N rules that fire the triggers to update the user count on the shared resource (2 rules for each user sensor: one to increment the shared count, one to decrement it) 

// There are so many rules because the Hue hub does not have an action for incrementing or decrementing an integer. The triggers are here so that the rules only need to be implemented once (and not once for each user; with the triggers we have N + 2N rules; without the triggers we'd have 2N^2 rules; if increment was implemented natively, we'd have 2N rules)

// An example of a shared resource is lighting in a hallway
// You want the lights in the hallway to remain on while there is anyone using or intending to use the hallway and you want the lights to turn off when there's no one using it
// You achieve this by removing the ability to directly turn on and turn off lights in the hallway from users and instead give them the ability to say that they are using or not using the hallway. Rules turn on the lights when the hallway is in use and turn off the lights when it's no longer in use.
// This gets rid of any confusion around motion detection and multiple users
// The motion detector is just another user who can let the hallway know it's being used, but is not responsible for turning lights off



async function createUserCount(connection, resourceName, userNames) {
    const hub = connection.hub;
    const app = connection.app;

    const maximumUserCount = userNames.length;

    async function create(method, address, body) {
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

    async function createSensor(body) {
        const address = `https://${hub}/api/${app}/sensors`;
        const method = "POST";

        return create(method, address, body);
    }

    async function createRule(body) {
        const address = `https://${hub}/api/${app}/rules`;
        const method = "POST";

        return create(method, address, body);
    }

    async function createTriggerRule(countID, triggerID, oldValue, newValue) {
        const body = `{
            "name": "${resourceName}",
            "conditions": [
                {
                    "address": "/sensors/${triggerID}/state/lastupdated",
                    "operator": "dx"
                },
                {
                    "address": "/sensors/${countID}/state/status",
                    "operator": "eq",
                    "value": "${oldValue}"
                }
            ],
            "actions": [
                {
                    "address": "/sensors/${countID}/state",
                    "method": "PUT",
                    "body": {
                        "status": ${newValue}
                    }
                }
            ]
        }`;

        return createRule(body);
    }

    async function createTriggerSensor(countID, value) {
        const body = `{
            "name": "${resourceName}",
            "state": {
                "flag": false
            },
            "config": {
                "on": true,
                "reachable": true
            },
            "type": "CLIPGenericFlag",
            "modelid": "User Count Trigger",
            "manufacturername": "Callionica",
            "swversion": "1.0",
            "uniqueid": "${uuid()}",
            "recycle": false
        }`;

        const id = await createSensor(body);
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
        const body = `{
            "name": "${resourceName}",
            "state": {
                "status": 0
            },
            "config": {
                "on": true,
                "reachable": true
            },
            "type": "CLIPGenericStatus",
            "modelid": "User Count",
            "manufacturername": "Callionica",
            "swversion": "1.0",
            "uniqueid": "${uuid()}",
            "recycle": false
        }`;

        return createSensor(body);
    }

    async function createUserRule(userID, userName, value, triggerID) {
        const body = `{
            "name": "${userName}",
            "conditions": [
                {
                    "address": "/sensors/${userID}/state/flag",
                    "operator": "eq",
                    "value": "${value}"
                }
            ],
            "actions": [
                {
                    "address": "/sensors/${triggerID}/state",
                    "method": "PUT",
                    "body": {
                        "flag": true
                    }
                }
            ]
        }`;

        return createRule(body);
    }

    async function createUserSensor(userName, increment, decrement) {
        const body = `{
            "name": "${userName}",
            "state": {
                "flag": false
            },
            "config": {
                "on": true,
                "reachable": true
            },
            "type": "CLIPGenericFlag",
            "modelid": "User Count User",
            "manufacturername": "Callionica",
            "swversion": "1.0",
            "uniqueid": "${uuid()}",
            "recycle": false
        }`;

        const id = await createSensor(body);

        const inc = await createUserRule(id, userName, true, increment.id);
        const dec = await createUserRule(id, userName, false, decrement.id);
        const rules = [inc, dec];

        return { id, name: userName, rules };
    }

    const id = await createUserCountSensor();
    const increment = await createTriggerSensor(id, +1);
    const decrement = await createTriggerSensor(id, -1);
    const users = [];
    for (const userName of userNames) {
        const user = await createUserSensor(userName, increment, decrement);
        users.push(user);
    }
    return { id, name: resourceName, triggers: [increment, decrement], users };
}

async function deleteRule(connection, id) {
    const address = `https://${connection.hub}/api/${connection.app}/rules/${id}`;
    const method = "DELETE";
    return fetch(address, { method })
}

async function deleteSensor(connection, id) {
    const address = `https://${connection.hub}/api/${connection.app}/sensors/${id}`;
    const method = "DELETE";
    return fetch(address, { method })
}

async function deleteUserCount(connection, uc) {

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

async function getCategory(connection, category) {
    const address = `https://${connection.hub}/api/${connection.app}/${category}`;
    
    var json;
    try {
        const result = await fetch(address);
        json = await result.json();
    } catch (e) {
        console.log(body);
        console.log(e);
        throw { body, e };
    }

    return json;
}

async function getRules(connection) {
    return getCategory(connection, "rules");
}

async function getSensors(connection) {
    return getCategory(connection, "sensors");
}

async function deleteAppRules(connection) {
    const rules = await getRules(connection);

    for (const ruleID in rules) {
        const rule = rules[ruleID];
        if (rule.owner === connection.app) {
            await deleteRule(connection, ruleID);
        }
    }
}

async function deleteManufacturerSensors(connection, manufacturer) {
    const sensors = await getSensors(connection);

    for (const sensorID in sensors) {
        const sensor = sensors[sensorID];
        if (sensor.manufacturername === manufacturer) {
            await deleteSensor(connection, sensorID);
        }
    }
}
