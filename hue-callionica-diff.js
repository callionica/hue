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