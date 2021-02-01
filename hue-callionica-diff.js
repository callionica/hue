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
    const sourceOnly = values.filter(v => (v.source !== undefined) && (v.destination === undefined)).map(v => v.source).sort((a,b) => a.name.localeCompare(b.name));
    const destinationOnly = values.filter(v => (v.destination !== undefined) && (v.source === undefined)).map(v => v.destination).sort((a,b) => a.name.localeCompare(b.name));
    const both = values.filter(v => (v.destination !== undefined) && (v.source !== undefined));
    const renamed = both.filter(v => v.destination.name !== v.source.name);

    // Unmatched lights in the destination are ones whose name has changed or which don't have a uniqueid match in the source
    // IOW if there is a uniqueid match or a name match, the light is not unmatched
    const dst = [
        ...destinationOnly.map(v => ({...v, unmatched: "new"})),
        ...renamed.map(v => ({ ...v.destination, unmatched: "renamed" }))
    ].sort((a,b) => a.name.localeCompare(b.name));

    const unmatched = {
        destination: dst
    };

    return { all: lights, sourceOnly, destinationOnly, both, renamed, unmatched };
}

function table() {
    return document.createElement("table");
}

function row(table) {
    const e = document.createElement("tr");
    table.appendChild(e);
    return e;
}

function cell(row, item) {
    const e = document.createElement("td");
    row.appendChild(e);
    if (item !== undefined) {
        e.append(item);
    }
    return e;
}

function cells(row, ...items) {
    for (const item of items) {
        cell(row, item);
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

export function lightPicker(lights) {
    const e = document.createElement("select");

    if (true) {
        const o = document.createElement("option");

        o.value = "(none)";
        o.innerText = "(None)";
        o.title = "No light";

        e.append(o);
    }

    for (const light of lights) {
        const o = document.createElement("option");
        
        o.value = light.uniqueid;
        o.innerText = light.name;
        const um = light.unmatched?.toUpperCase() || "";
        o.title = `${um}: ${light.type}`;

        e.append(o);
    }

    return e;
}

// Returns array of [source-id, destination-light]
export function extractSourceToDestinationMap(lights, scope) {
    scope = scope || document;

    const elements = [...scope.querySelectorAll("select[data-type='map-source-to-destination']")];
    const uniqueids = elements.map(e => [e.dataset.uniqueid, e.value === "(none)" ? undefined : e.value]);

    const ids = [];
    for (const [uniqueid, value] of Object.entries(lights.all)) {
        if (value.source === undefined) {
            continue;
        }

        const mapped = uniqueids.find(v => v[0] === uniqueid);
        if (mapped !== undefined) {
            const [src, dst] = mapped; 
            ids.push([value.source.id, (dst === undefined) ? undefined : lights.all[dst].destination]);
        } else {
            ids.push([value.source.id, value.destination]);
        }
    }

    return ids;
}

export function lightsTable(lights, tbl) {
    tbl = tbl || table();

    if (lights.sourceOnly.length > 0) {
        const r = row(tbl);
        r.dataset.type = "heading";
        cells(r, "Lights only in source", "", "");
        
        const rl = row(tbl);
        rl.dataset.type = "labels";
        cells(rl, "Name", "Type", "Destination");
    }

    for (const v of lights.sourceOnly) {
        const r = row(tbl);
        const d = r.dataset;
        d.uniqueid = v.uniqueid;
        d.type = "source-only";

        const lp = lightPicker(lights.unmatched.destination);
        lp.dataset.uniqueid = v.uniqueid;
        lp.dataset.type = "map-source-to-destination";

        for (const o of [...lp.querySelectorAll("option")]) {
            if (o.innerText === v.name) {
                o.selected = true;
                break;
            }
        }

        cells(r, v.name, v.type, lp);
    }

    if (lights.renamed.length > 0) {
        const r = row(tbl);
        r.dataset.type = "heading";
        cells(r, "Lights with different names", "", "");

        const rl = row(tbl);
        rl.dataset.type = "labels";
        cells(rl, "Name", "Type", "Destination");
    }

    for (const v of lights.renamed) {
        const r = row(tbl);
        r.dataset.type = "renamed";

        const lp = lightPicker(lights.unmatched.destination);
        lp.dataset.uniqueid = v.uniqueid;
        lp.dataset.type = "map-source-to-destination";

        for (const o of [...lp.querySelectorAll("option")]) {
            if (o.innerText === v.destination.name) {
                o.selected = true;
                break;
            }
        }

        cells(r, v.source.name, v.source.type, lp);
    }

    /*if (lights.destinationOnly.length > 0) {
        const r = row(tbl);
        r.dataset.type = "heading";
        cells(r, "Lights only in destination", "", "");

        const rl = row(tbl);
        rl.dataset.type = "labels";
        cells(rl, "Name", "Type", "");
    }

    for (const v of lights.destinationOnly) {
        const r = row(tbl);
        const d = r.dataset;
        d.uniqueid = v.uniqueid;
        d.type = "destination-only";
        cells(r, v.name, v.type, "");
    }*/

    return tbl;
}