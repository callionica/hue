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

function option(s, ...items) {
    const e = document.createElement("option");
    s.appendChild(e);
    e.append(...items);
    return e;
}

export function propertyTable(kv, tbl) {
    tbl = tbl || table();

    for (const [key, value] of kv) {
        const r = row(tbl);
        const k = cell(r, key);
        k.dataset.type = "label";
        const v = cell(r, value);
        v.setAttribute("colspan", 2);
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
        const h = cell(r, "Missing lights");
        h.setAttribute("colspan", 3);
        
        const rl = row(tbl);
        rl.dataset.type = "labels";
        cells(rl, "Name", "Type", "New Light");
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
        const h = cell(r, "Renamed lights");
        h.setAttribute("colspan", 3);

        const rl = row(tbl);
        rl.dataset.type = "labels";
        cells(rl, "Name", "Type", "New Light");
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

export function renameTable(source, destination, s2d, tbl) {
    tbl = tbl || table();

    const renames = [];
    
    for (const [id, dst] of s2d) {
        const src = source.lights[id];
        if ((dst !== undefined) && (src.name !== dst.name)) {
            renames.push([src, dst]);
        }
    }

    console.log(renames);


    if (renames.length > 0) {
        const r = row(tbl);
        r.dataset.type = "heading";
        const h = cell(r, "Renames");
        h.setAttribute("colspan", 3);
        
        const rl = row(tbl);
        rl.dataset.type = "labels";
        cells(rl, "Current name", "Proposed name", "Action");
    }

    for (const [src, dst] of renames) {
        const r = row(tbl);

        const select = document.createElement("select");
        const d = select.dataset;

        d.targetCategory = "lights";
        d.targetId = dst.id;
        d.targetProperty = "name";
        d.targetValue = src.name;

        const change = option(select, "Change name");
        change.value = "change";
        change.selected = true;

        const nochange = option(select, "Don't change");
        nochange.value = "no-change";

        select.append(change, nochange);

        cells(r, dst.name, src.name, select);
    }

    return tbl;
}

export function extractRenameList(scope) {
    scope = scope || document;

    const list = [...scope.querySelectorAll("select[data-target-property='name']")].filter(e => e.value === "change").map(e => {
        const d = e.dataset;
        return { category: d.targetCategory, id: d.targetId, property: d.targetProperty, value: d.targetValue };
    });

    return list;
}

function items(o) {
    return Object.entries(o).map(([id, item]) => ({ id, ...item }));
}

function isSetEqual(a, b) {
    const w = new Set(b);
    for (const o of a) {
        if (w.has(o)) {
            w.delete(o);
        } else {
            return false;
        }
    }
    if (w.size === 0) {
        return true;
    }
    return false;
}

export function groups({ source, destination, lightMap }) {
    const rooms = [];
    const zones = [];

    const destinationGroups = items(destination.groups);
    const destinationRooms = destinationGroups.filter(g => g.type === "Room");
    const destinationZones = destinationGroups.filter(g => g.type !== "Room");

    for (const group of items(source.groups)) {
        const collection = (group.type === "Room") ? rooms : zones;
        const dest = (group.type === "Room") ? destinationRooms : destinationZones;

        const lights = group.lights.map(id => lightMap[id]?.id);
        // console.log("LIGHTS", lights);

        const idNameMatch = dest.find(g => (g.id === group.id) && (g.name === group.name));

        if (idNameMatch !== undefined) {
            collection.push({ source: group, destination: idNameMatch, match: "id-name" });
            continue;
        }

        const nameMatch = dest.find(g => (g.name === group.name));

        if (nameMatch !== undefined) {
            collection.push({ source: group, destination: nameMatch, match: "name" });
            continue;
        }

        const lightsMatch = dest.find(g => isSetEqual(lights, g.lights));

        if (lightsMatch !== undefined) {
            collection.push({ source: group, destination: lightsMatch, match: "lights" });
            continue;
        }

        collection.push({ source: group, destination: undefined, match: "none" });
    }

    return { source: { rooms, zones }, destination: { rooms: destinationRooms, zones: destinationZones } };
}