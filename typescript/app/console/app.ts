// import { bridgeByIP, bridgeByName, remoteDiscovery } from "../../hue-core.ts";
import { bridgeByName, getDescriptionXML, remoteDiscovery, IPAddress, Bridge } from "../../hue-core.ts";

import { FilePath } from "../../../../denophile/src/file.ts";
import { fetch } from "../../../../denophile/src/fetch-curl.ts";
import { CertificateLibrary } from "../../../../denophile/src/ssl.ts";

// const response = await fetch("https://main-hub.local");

class HueCertificateLibrary extends CertificateLibrary {
    constructor(folder: FilePath) {
        super(folder);
    }

    async toFetchableURL(url: URL): Promise<URL> {
        const fu = new URL(url.toString());
        if (fu.hostname === "ecb5fafffe091e61") {
            fu.hostname = "10.0.1.185";
        }
        return fu;
    }
}

const lib = new HueCertificateLibrary("/Users/user/Desktop/__current/--lib-1/");

const client = {
    caFile: "/Users/user/Documents/github/hue/certificates/hsb_cacert.pem",
    nameResolver: {
            "ecb5fafffe091e61": "10.0.1.185"
    },
    skipVerifyingCertificateChain: true,
    pinningLibrary: lib,
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