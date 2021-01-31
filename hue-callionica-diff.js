// Compares two different sets of Hue bridge data to produce information about the differences

export function lights({ source, destination }) {
    // source and destination are raw data as produced by the bridge (except possibly with lightstate for scenes)

    const lights = {};

    for (const [id, light] of Object.entries(source.lights)) {
        let result = lights[light.uniqueid];
        if (result === undefined) {
            result = { uniqueid: light.uniqueid, source: { id, ...light } };
            lights[light.uniqueid] = result;
        } else {
            console.log("Unexpected duplicate uniqueid - light");
            result.source = { id, ...light };
        }
    }

    for (const [id, light] of Object.entries(destination.lights)) {
        let result = lights[light.uniqueid];
        if (result === undefined) {
            result = { uniqueid: light.uniqueid, destination: { id, ...light } };
            lights[light.uniqueid] = result;
        } else {
            result.destination = { id, ...light };
        }
    }

    const values = Object.values(lights);
    const sourceOnly = values.filter(v => (v.source !== undefined) && (v.destination === undefined)).map(v => v.source);
    const destinationOnly = values.filter(v => (v.destination !== undefined) && (v.source === undefined)).map(v => v.destination);
    const both = values.filter(v => (v.destination !== undefined) && (v.source !== undefined));
    const renamed = both.filter(v => v.destination.name !== v.source.name);

    return { sourceOnly, destinationOnly, both, renamed };
}

function table() {
    return document.createElement("table");
}

function row(tbl) {
    const e = document.createElement("tr");
    tbl.appendChild(e);
    return e;
}

function cell(r, text) {
    const e = document.createElement("td");
    r.appendChild(e);
    if (text !== undefined) {
        e.innerText = text;
    }
    return e;
}

function cells(r, ...texts) {
    for (const text of texts) {
        cell(r, text);
    }
}

export function propertyTable(kv, tbl) {
    tbl = tbl || table();

    for (const [key, value] of kv) {
        const r = row(tbl);
        const k = cell(r, key);
        k.dataset.type = "label";
        const v = cell(r, value);
    }
    return tbl;
}

export function lightsTable(lights, tbl) {
    tbl = tbl || table();

    if (lights.sourceOnly.length > 0) {
        const r = row(tbl);
        r.dataset.type = "heading";
        cells(r, "Lights only in source", "", "");
        
        const rl = row(tbl);
        rl.dataset.type = "labels";
        cells(rl, "Name", "Type", "");
    }

    for (const v of lights.sourceOnly) {
        const r = row(tbl);
        r.dataset.type = "sourceOnly";
        cells(r, v.name, v.type, "");
    }

    if (lights.destinationOnly.length > 0) {
        const r = row(tbl);
        r.dataset.type = "heading";
        cells(r, "Lights only in destination", "", "");

        const rl = row(tbl);
        rl.dataset.type = "labels";
        cells(rl, "Name", "Type", "");
    }

    for (const v of lights.destinationOnly) {
        const r = row(tbl);
        r.dataset.type = "destinationOnly";
        cells(r, v.name, v.type, "");
    }

    if (lights.renamed.length > 0) {
        const r = row(tbl);
        r.dataset.type = "heading";
        cells(r, "Lights with different names", "", "");

        const rl = row(tbl);
        rl.dataset.type = "labels";
        cells(rl, "Name in source", "Name in destination", "");
    }

    for (const v of lights.renamed) {
        const r = row(tbl);
        r.dataset.type = "renamed";
        cells(r, v.source.name, v.destination.name);
    }

    return tbl;
}