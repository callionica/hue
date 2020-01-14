"use strict";
import { getConfig } from "./hue-callionica.js";

// bridge: { id, ip, name }
// connection: { bridge, app, token }

const KEY_DISCOVERY = "hue-discovery";

export function loadConnection(app, bridge) {
    const key = `hue-connection:${app}:${bridge.id}`;
    const json = localStorage.getItem(key);
    if (json) {
        return JSON.parse(json);
    }
}

function storeBridgeIP(bridge) {
    const key = KEY_DISCOVERY;
    const json = localStorage.getItem(key);
    const item = {id: bridge.id, internalipaddress: bridge.ip, name: bridge.name};
    let list = [item];
    if (json) {
        list = JSON.parse(json);
        const existing = list.find(existing => existing.id === item.id);
        if (!existing) {
            list.push(item);
        } else {
            existing.name = item.name;
            existing.internalipaddress = item.internalipaddress;
        }    
    }

    const data = JSON.stringify(list);
    localStorage.setItem(key, data);
}

export function storeConnection(connection) {
    const data = JSON.stringify(connection);
    const keys = [
        `hue-connection:${connection.app}:${connection.bridge.id}`,
        `hue-connection:${connection.app}:${connection.bridge.ip}`,
    ];
    keys.forEach(key => localStorage.setItem(key, data));

    storeBridgeIP(connection.bridge);
}

// export function loadConnections(app) {
//     const connections = [];
//     const key = KEY_BRIDGES;
//     const json = localStorage.getItem(key);
//     if (json) {
//         const bridges = JSON.parse(json);
//         for (const bridge of bridges) {
//             const connection = loadConnection(app, bridge);
//             if (connection) {
//                 connections.push(connection);
//             }
//         }
//     }
//     return connections;
// }

// Given an IP, we can get the bridge ID and name without authenticating
export async function bridgeByIP(ip) {
    const connection = { hub: ip, app: "unauthenticated" };
    const config = await getConfig(connection);
    return { id: config.bridgeid.toLowerCase(), ip, name: config.name };
}

async function jsonFetch(address) {
    var result;
    try {
        const fetchResult = await fetch(address);
        result = await fetchResult.json();
    } catch (e) {
        console.log(e);
        throw { address, e };
    }

    return result;
}

// Philips Hue bridges report internal IP addresses to meethue
// The server will send you back the internal IP addresses of any hubs whose public IP matches the public IP address of your request
export async function bridgesByRemoteDiscovery() {
    const result = await jsonFetch("https://discovery.meethue.com");
    return result;
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
            remotes.push(local);
        }
    }
    return remotes;
}

export async function bridgesByDiscovery() {
    const discoveredBridges = await bridgeIPsByDiscovery();
    const result = [];
    for (const discoveredBridge of discoveredBridges) {
        const bridge = await bridgeByIP(discoveredBridge.internalipaddress);
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
