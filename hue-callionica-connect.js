"use strict";
import { getConfig, delay, TimeoutExpired, fetch } from "./hue-callionica.js";

// bridge: { id, ip, name }
// connection: { bridge, app, token }

const KEY_DISCOVERY = "hue-bridges";
const KEY_BRIDGE = "hue-bridge-current";
const KEY_BRIDGES = "hue-bridges-current";

export function loadConnection(app, bridge) {
    const key = `hue-connection:${app}:${bridge.id}`;
    const json = localStorage.getItem(key);
    if (json) {
        return JSON.parse(json);
    }
}

export function forgetConnection(connection) {
    const key = `hue-connection:${connection.app}:${connection.bridge.id}`;
    localStorage.removeItem(key);
}

export function loadConnections() {
    return Object.keys(localStorage).filter(key => key.startsWith("hue-connection:")).map(key => JSON.parse(localStorage[key]));
}

function storeBridge(bridge) {
    const key = KEY_DISCOVERY;
    const json = localStorage.getItem(key);
    const item = bridge;
    let list = [item];
    if (json) {
        list = JSON.parse(json);
        const existing = list.find(existing => existing.id === item.id);
        if (!existing) {
            list.push(item);
        } else {
            existing.name = item.name;
            existing.ip = item.ip;
        }    
    }

    const data = JSON.stringify(list);
    localStorage.setItem(key, data);

    localStorage.setItem(`hue-bridge:${bridge.id}`, JSON.stringify(bridge, null, 2));
}

export function storeCurrentBridge(bridge) {
    let currentBridges = loadCurrentBridges();
    if (currentBridges !== undefined) {
        const otherBridges = currentBridges.filter(b => b.id !== bridge.id);
        currentBridges = [bridge, ...otherBridges];
        storeCurrentBridges(currentBridges);
    } else {
        storeCurrentBridges([bridge]);
    }
}

function loadCurrentBridge_() {
    const key = KEY_BRIDGE;
    const json = localStorage.getItem(key);
    if (json) {
        return JSON.parse(json);
    }
}

export function loadCurrentBridge() {
    const bridges = loadCurrentBridges();
    const bridge = bridges?.[0];

    if (bridge !== undefined) {
        return bridge;
    }

    return loadCurrentBridge_();
}

export function storeCurrentBridges(bridges) {
    const key = KEY_BRIDGES;
    const data = JSON.stringify(bridges);
    localStorage.setItem(key, data);
}

export function loadCurrentBridges() {
    const key = KEY_BRIDGES;
    const json = localStorage.getItem(key);
    if (json) {
        return JSON.parse(json);
    }

    const bridge = loadCurrentBridge_();
    if (bridge !== undefined) {
        return [bridge];
    }

    return Object.keys(localStorage).filter(key => key.startsWith("hue-bridge:")).map(key => JSON.parse(localStorage[key]));
}

export function storeConnection(connection) {
    const data = JSON.stringify(connection);
    const keys = [
        `hue-connection:${connection.app}:${connection.bridge.id}`
    ];
    keys.forEach(key => localStorage.setItem(key, data));

    storeBridge(connection.bridge);
}

// Given an IP, we can get the bridge ID and name without authenticating
export async function bridgeByIP(ip) {
    const connection = { bridge: {ip}, token: "unauthenticated" };
    const config = await getConfig(connection);
    return { id: config.bridgeid.toLowerCase(), ip, name: config.name };
}

export async function diagnoseConnection(connection) {
    try {
        const result = await getConfig(connection);

        const id = result.bridgeid?.toLowerCase();

        if (id === undefined) {
            return "not-a-bridge-error";
        }

        if (id !== connection.bridge.id) {
            return "wrong-bridge-error";
        }

        if (result.whitelist === undefined) {
            return "authentication-error";
        }

        return "success";
    } catch (error) {
        if (error.e instanceof TimeoutExpired) {
            return "unreachable";
        }
        return "certificate-error";
    }
}

// Return the bridge name and serial number obtained from the description XML over HTTP
// This method avoids certificate issues by relying on HTTP only
export async function bridgeFromDescriptionXML(address) {
    const response = await fetch(`http://${address}/description.xml`);
    const data = await response.text();
    const parser = new DOMParser();
    const dom = parser.parseFromString(data, "application/xml");
    let serialNumber = dom.querySelector("serialNumber").textContent.toLowerCase();
    const id = serialNumber.substring(0, 6) + "fffe" + serialNumber.substring(6);
    const name = dom.querySelector("friendlyName").textContent;
    const bridge = { id, ip: address, name };
    return bridge;
}

export async function bridgeFromAddress(address) {
    try {
        const bridge = await bridgeByIP(address);
        return { bridge, status: "reachable" };
    } catch (e) {
        console.log(e);
    }

    return { status: "certificate-failure" };

    // MIXED CONTENT ERROR PRODUCED BY CODE BELOW SO CAN'T USE
    // try {
    //     const bridge = await bridgeFromDescriptionXML(address);
    //     return { bridge, status: "certificate-failure" };
    // } catch (e) {
    // }

    // return { status: "unreachable" };
}

async function jsonFetch(address, ms) {
    var result;
    try {
        const fetchResult = await fetch(address, undefined, ms);
        result = await fetchResult.json();
    } catch (e) {
        console.log(e);
        throw { address, e };
    }

    return result;
}

// Philips Hue bridges report internal IP addresses to meethue
// The server will send you back the internal IP addresses of any bridges whose public IP matches the public IP address of your request
export async function bridgesByRemoteDiscovery() {
    const result = await jsonFetch("https://discovery.meethue.com", 6000);
    return result.map(item => { return { id: item.id, ip: item.internalipaddress }; });
}

// export async function bridgesByStandardMdnsName() {
//     const host = "philips-hue.local";
// }

// Every time we get a working connection, we store the bridge ID and local IP address
export async function bridgesByLocalDiscovery() {
    const key = KEY_DISCOVERY;
    const json = localStorage.getItem(key);
    if (json) {
        return JSON.parse(json);
    }
    return [];
}

export async function bridgeIPsByDiscovery() {
    const locals = await bridgesByLocalDiscovery();
    const remotes = await bridgesByRemoteDiscovery();

    // Add unknown local items to the remote items
    for (const local of locals) {
        const remote = remotes.find(remote => remote.id === local.id);
        if (remote) {
            remote.name = local.name;
        } else {
            const ip = local.ip || local.internalipaddress;
            remotes.push({...local, ip});
        }
    }
    return remotes;
}

export async function bridgesByDiscovery() {
    const discoveredBridges = await bridgeIPsByDiscovery();
    const result = [];
    for (const discoveredBridge of discoveredBridges) {
        const bridge = await bridgeByIP(discoveredBridge.ip);
        result.push(bridge);
    }
    return result;
}

////////

async function get(address) {
    let bridgeResult;
    try {
        const result = await fetch(address);
        bridgeResult = await result.json();
    } catch (e) {
        console.log(address);
        console.log(body);
        console.log(e);
        throw { body, e };
    }

    return bridgeResult;
}

async function send(method, address, body) {
    let bridgeResult;
    try {
        const result = await fetch(address, { method, body });
        bridgeResult = await result.json();
    } catch (e) {
        console.log(address);
        console.log(body);
        console.log(e);
        throw { body, e };
    }

    if (Array.isArray(bridgeResult) && (bridgeResult.length === 1) && bridgeResult[0].success) {
        return bridgeResult;
    }

    console.log(address);
    console.log(body);
    console.log(bridgeResult);
    throw { body, bridgeResult };
}

// A connection is working if we can get the whitelist and the responding bridge has the expected ID
export async function testConnection(connection) {
    const address = `https://${connection.bridge.ip}/api/${connection.token}/config`;
    try {
        const result = await get(address);
        return (result.whitelist !== undefined) && (result.bridgeid.toLowerCase() === connection.bridge.id);
    } catch (e) {
    }
    return false;
}

export async function register(bridge, app) {
    const address = `https://${bridge.ip}/api/`;
    const body = `{"devicetype": "${app}"}`;
    const method = "POST";
    let bridgeResult = await send(method, address, body);
    return { bridge, app, token: bridgeResult[0].success.username };
}
