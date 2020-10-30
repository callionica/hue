/** A secret that allows an app to access a Hue bridge */
type Token = (string | "unauthenticated") & { kind_: "Token" };

/** A token that can be used to gain access to parts of the API open to unregistered apps */
export const TOKEN_UNAUTHENTICATED = "unauthenticated" as Token;

/** A string that uniquely identifies your app */
type App = string & { kind_: "App" };

/** A URL on a Hue bridge that identifies a resource or action */
type Address = URL & { kind_: "Address" };

/** An HTTP method */
type Method = "POST" | "GET" | "PUT" | "DELETE";

/** The ID of a bridge (an opaque numeric identifier) */
type BridgeID = string & { kind_: "BridgeID" };

/** The IP address of a bridge */
type IPAddress = string & { kind_: "IPAddress" };

/** The host name of a bridge */
type HostName = string & { kind_: "HostName" };

/** The available info about a bridge */
type Bridge = { id?: BridgeID, host?: HostName, ip?: IPAddress, name?: string } & { kind_: "Bridge" };

/** A connection to a Hue bridge including the identity of the bridge and the secret token */
type Connection = { bridge: Bridge, token: Token, app?: App };

type Category = "light" | "sensor" | "schedule" | "rule" | "resourcelink" | "group" | "scene";
type CategoryAPI = Category | "config";
type CategoryCreatable = Exclude<Category, "light">;

type ID<T extends Category> = { id: string, category: T };

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
        super(JSON.stringify({ method, address, body, error }, null, "  "));
        this.method = method;
        this.address = address;
        this.body = body;
        this.error = error;
    }
}

function Address(connection: Connection, category: CategoryAPI, suffix: string = ""): Address {
    const section = (category === "config") ? category : category + "s";
    return new URL(`https://${connection.bridge.host || connection.bridge.ip}/api/${connection.token}/${section}/` + suffix) as Address;
}

function AddressOfBridge(bridge: Bridge): Address {
    return new URL(`https://${bridge.host || bridge.ip}/api/`) as Address;
}

function AddressOfRoot(connection: Connection): Address {
    return new URL(`https://${connection.bridge.host || connection.bridge.ip}/api/${connection.token}/`) as Address;
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

export async function create<T extends CategoryCreatable>(connection: Connection, category: T, content: string | unknown): Promise<ID<T>> {
    const address = Address(connection, category);
    const method = "POST";

    const success = await send2(method, address, content);
    return { id: success.id as string, category: category };
}

export async function destroy<T extends CategoryCreatable>(connection: Connection, id: ID<T>) {
    const address = Address(connection, id.category, `${id}`);
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

/**
 * Register an app and receive a connection containing a new token
 */
export async function register(bridge: Bridge, app: App): Promise<Connection> {
    const address = AddressOfBridge(bridge);
    const body = { devicetype: app };
    const method = "POST";
    let bridgeResult = await send(method, address, body);
    return { bridge, app, token: (bridgeResult[0].success.username) as Token };
}

export async function touchlink(connection: Connection) {
    const address = Address(connection, "config");
    const body = { touchlink: true };
    return put(address, body);
}

export async function getAllCategories(connection: Connection) {
    const address = AddressOfRoot(connection);
    return await send("GET", address);
}

export async function getCategory(connection: Connection, category: CategoryAPI) {
    const address = Address(connection, category);
    return await send("GET", address);
}

export async function setSensorValue(connection: Connection, id: SensorID, value: boolean | number) {
    const store = (typeof value === "boolean") ? "flag" : "status";
    const address = Address(connection, id.category, `${id.id}/state`);
    const body = { [store]: `${value}` };
    return put(address, body);
}
