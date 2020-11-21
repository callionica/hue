// deno-lint-ignore-file

import { fetch } from "../../denophile/src/fetch-curl.ts";

/** A secret that allows an app to access a Hue bridge */
export type Token = (string | "unauthenticated") & { kind_: "Token" };

/** A token that can be used to gain access to parts of the API open to unregistered apps */
export const TOKEN_UNAUTHENTICATED = "unauthenticated" as Token;

/** A string that uniquely identifies your app */
export type App = string & { kind_: "App" };

/** A URL on a Hue bridge that identifies a resource or action */
export type Address = URL & { kind_: "Address" };

/** An HTTP method */
export type Method = "POST" | "GET" | "PUT" | "DELETE";

/** The ID of a bridge (an opaque numeric identifier) */
export type BridgeID = string & { kind_: "BridgeID" };

/** The IP address of a bridge */
export type IPAddress = string & { kind_: "IPAddress" };

/** The host name of a bridge */
export type HostName = string & { kind_: "HostName" };

/** The available info about a bridge */
export type Bridge = { id: BridgeID, name?: string } & ({ hostName: HostName, ip?: IPAddress } | { ip: IPAddress, hostName?: HostName });

/** A connection to a Hue bridge including the identity of the bridge and the secret token */
export type Connection = { bridge: Bridge, token: Token, app?: App };

/** Entities in the Hue API */
export type Entity = "light" | "sensor" | "schedule" | "rule" | "resourcelink" | "group" | "scene";

/** Entities that can be created using the Hue API */
export type EntityCreatable = Exclude<Entity, "light">;

/** A section within the Hue API */
export type Section = Entity | "config";

/** An ID representing a specific entity */
export type ID<EntityType extends Entity> = { id: string, entity: EntityType };

export type EntityID = ID<Entity>;

export type LightID = ID<"light">;
export type SensorID = ID<"sensor">;
export type ScheduleID = ID<"schedule">;
export type RuleID = ID<"rule">;
export type ResourceLink = ID<"resourcelink">;
export type GroupID = ID<"group">;
export type SceneID = ID<"scene">;

/** An error thrown by Callionica's Hue API */
export class HueError extends Error {
    method: Method;
    address: Address;
    body: string;
    error: any;
    constructor(method: Method, address: Address, body: string, error: any) {
        super(`${error.message || "Error"} ` + JSON.stringify({ method, address, body, error }, null, "  "));
        this.method = method;
        this.address = address;
        this.body = body;
        this.error = error;
    }
}

function AddressOfBridge(bridge: Bridge): Address {
    return new URL(`https://${bridge.hostName || bridge.ip}/api/`) as Address;
}

function AddressOfConnection(connection: Connection): Address {
    return new URL(`https://${connection.bridge.hostName || connection.bridge.ip}/api/${connection.token}/`) as Address;
}

function Address(connection: Connection, section: Section, suffix: string = ""): Address {
    const sectionKey = (section === "config") ? section : section + "s";
    return new URL(`${sectionKey}/` + suffix, AddressOfConnection(connection)) as Address;
}

async function send(method: Method, address: Address, content: string | unknown = ""): Promise<any> {
    const body = (typeof content !== "string") ? JSON.stringify(content, null, "  ") : content;

    let bridgeResult: any;
    try {
        const result = await fetch(address, { method, body });
        bridgeResult = await result.json();
    } catch (e) {
        throw new HueError(method, address, body, e);
    }

    return bridgeResult;
}

async function send2(method: Method, address: Address, content: string | unknown = ""): Promise<any> {
    const body = (typeof content !== "string") ? JSON.stringify(content, null, "  ") : content;
    const bridgeResult = await send(method, address, body);

    if (Array.isArray(bridgeResult) && (bridgeResult.length === 1) && bridgeResult[0].success) {
        return bridgeResult[0].success;
    }

    throw new HueError(method, address, body, bridgeResult);
}

export async function create<EntityType extends EntityCreatable>(connection: Connection, entity: EntityType, content: string | unknown): Promise<ID<EntityType>> {
    const address = Address(connection, entity);
    const method = "POST";

    const success = await send2(method, address, content);
    return { id: success.id as string, entity };
}

export async function destroy<EntityType extends EntityCreatable>(connection: Connection, id: ID<EntityType>) {
    const address = Address(connection, id.entity, `${id}`);
    const method = "DELETE";
    const body = "";
    const bridgeResult = await send(method, address, body);
    return bridgeResult;
}

async function put(address: Address, content: string | unknown): Promise<any> {
    const method = "PUT";
    return await send2(method, address, content);
}

////////////////////////////////////////////////////////////////////////////////////////

function nameToHostName(name: string): HostName {
    const host = name.trim().toLowerCase().replace(" ", "-") + ".local";
    return host as HostName;
}

export async function bridgeByName(name: string): Promise<Bridge> {
    const host = nameToHostName(name);
    return bridgeByHostName(host);
}

export async function bridgeByHostName(hostName: HostName): Promise<Bridge> {
    const connection = { bridge: { hostName } as Bridge, token: TOKEN_UNAUTHENTICATED };
    const config = await getSection(connection, "config");
    return { id: config.bridgeid.toLowerCase() as BridgeID, hostName: hostName, name: config.name, ip: config.ipaddress as IPAddress };
}

export async function bridgeByIP(ip: IPAddress): Promise<Bridge> {
    const connection = { bridge: { ip } as Bridge, token: TOKEN_UNAUTHENTICATED };
    const config = await getSection(connection, "config");
    return { id: config.bridgeid.toLowerCase() as BridgeID, ip, name: config.name };
}

export async function isLiveConnection(connection: Connection): Promise<boolean> {
    try {
        const config = await getSection(connection, "config");
        return (config.whitelist !== undefined) && (config.bridgeid.toLowerCase() === connection.bridge.id);
    } catch (e) {
        // Do nothing
    }
    return false;
}

/** 
 * Philips Hue bridges report their internal IP addresses to meethue.com.
 * The server will send you back the internal IP addresses of any bridges whose
 * public IP address matches the public IP address of your request.
 */
export async function remoteDiscovery() {
    const response = await fetch("https://discovery.meethue.com");
    const result: { id: BridgeID, internalipaddress: IPAddress }[] = await response.json();
    return result.map(item => ({ id: item.id, ip: item.internalipaddress }));
}

/**
 * Register an app and receive a connection containing a new token
 */
export async function register(bridge: Bridge, app: App): Promise<Connection> {
    const address = AddressOfBridge(bridge);
    const body = { devicetype: app };
    const method = "POST";
    const bridgeResult = await send(method, address, body);
    return { bridge, app, token: (bridgeResult[0].success.username) as Token };
}

export async function touchlink(connection: Connection) {
    const address = Address(connection, "config");
    const body = { touchlink: true };
    return put(address, body);
}

export async function getDescriptionXML(bridge: Bridge): Promise<string> {
    const url = new URL("description.xml", `https://${bridge.hostName || bridge.ip}/`);
    const response = await fetch(url);
    return await response.text();
}

export async function getAll(connection: Connection) {
    const address = AddressOfConnection(connection);
    return await send("GET", address);
}

export async function getSection(connection: Connection, section: Section) {
    const address = Address(connection, section);
    return await send("GET", address);
}

//////////////////////////////////////////////////////////////

/**
 * Sets the value of a sensor which may be stored in the `flag` property for boolean values
 * or the `status` property for numbers.
 */
export async function setSensorValue(connection: Connection, id: SensorID, value: boolean | number) {
    const store = (typeof value === "boolean") ? "flag" : "status";
    const address = Address(connection, id.entity, `${id.id}/state`);
    const body = { [store]: `${value}` };
    return put(address, body);
}

