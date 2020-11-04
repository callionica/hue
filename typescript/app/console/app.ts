// import { bridgeByIP, bridgeByName, remoteDiscovery } from "../../hue-core.ts";
import { bridgeByName, getDescriptionXML, remoteDiscovery, IPAddress, Bridge } from "../../hue-core.ts";

import { execute, FilePath } from "../../../../denophile/src/file.ts";
import { fetch, HttpClient } from "../../../../denophile/src/fetch-curl.ts";
import { CertificateLibrary, NameResolver, Server } from "../../../../denophile/src/ssl.ts";

// const response = await fetch("https://main-hub.local");

async function arp() {
    const results = await execute("arp", "-a");
    const re = /\((?<ip>[^)]+)\) at (?<mac>\S+) on/ig;
    const m = results.matchAll(re);
    return [...m].map(m => m.groups!);
}

const PhilipsMACPrefix = "ec:b5:fa:";
const dis = (await arp()).filter(a => a.mac.startsWith(PhilipsMACPrefix));
console.log(dis);

const nameResolver = {
    // "ecb5fafffe091e61": "10.0.1.185" as IPAddress,
    "ecb5fafffe091e61": { name: "main-hub.local" } as Server
} as NameResolver;

const lib = new CertificateLibrary("/Users/user/Desktop/__current/--lib-1/", nameResolver);

const client: HttpClient = {
    caFile: "/Users/user/Documents/github/hue/certificates/hsb_cacert.pem",
    nameResolver,
    skipVerifyingCertificateChain: true,
    publicKeyHashProvider: lib,
};

// console.log(await getDescriptionXML({ip: "10.0.1.185" as IPAddress} as Bridge));

const response = await fetch("https://ecb5fafffe091e61/api/3CY8HUdsDdkQ0wn1CzWTaSZU1DOUI3AuImIzJ-c9/config/", { client });
// const response = await fetch("https://main-hub.local/api/3CY8HUdsDdkQ0wn1CzWTaSZU1DOUI3AuImIzJ-c9/config/", { client });
console.log(await response.text());

// const pem = "/Users/user/Documents/github/hue/ecb5fafffe091e61-chain.pem"; // TODO
// const client = Deno.createHttpClient({ caFile: pem });
// const response = await fetch("https://main-hub.local", { client });
// console.log(await response.text());

// const found = await remoteDiscovery();

// // const bridges = await Promise.all(found.map(b => bridgeByIP(b.ip)));

// const names = ["Main Hub", "Test hub"];
// const bridges = await Promise.all(names.map(name => bridgeByName(name)));

// console.log(found);
// console.log(bridges);