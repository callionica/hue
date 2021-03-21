import { getAllPlus, setLightOn, setLightCT, delay } from "./hue-callionica.js";

export async function getCtToXyMap(connection, lightID) {

    await setLightOn(connection, lightID, true);

    const result = {};
    for (let ct = 153; ct <= 555; ++ct) {
        await setLightCT(connection, lightID, ct);
        await delay(500);
        const data = await getAllPlus(connection);
        result[ct] = data.lights[lightID].state;
    }

    const result2 = {};
    Object.values(result).forEach(s => result2[s.ct] = s.xy);

    return result2;
}