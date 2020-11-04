// import { bridgeByIP, bridgeByName, remoteDiscovery } from "../../hue-core.ts";
import { bridgeByName, getDescriptionXML, remoteDiscovery, IPAddress, Bridge } from "../../hue-core.ts";

import { FilePath } from "../../../../denophile/src/file.ts";
import { fetch, HttpClient } from "../../../../denophile/src/fetch-curl.ts";
import { CertificateLibrary, NameResolver } from "../../../../denophile/src/ssl.ts";

// const response = await fetch("https://main-hub.local");

const nameResolver = {
    "ecb5fafffe091e61": "10.0.1.185" as IPAddress
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