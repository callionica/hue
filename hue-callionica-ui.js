import { loadCurrentBridges, loadConnection } from "./hue-callionica-connect.js";
import { delay, getAllPlus } from "./hue-callionica.js";

const keySunrise = "hue-four-part-day-sunrise";
const keySunset = "hue-four-part-day-sunset";

export function getDaylight(data) {
    const daylightSensor = Object.values(data.sensors).find(sensor => sensor.type === "Daylight");

    let daylight;
    if (daylightSensor?.config?.configured && daylightSensor?.config?.on) {
        daylight = {
            value: (daylightSensor?.state?.daylight) ? "light" : "dark",
            updated: new Date(daylightSensor?.state?.lastupdated + "Z"),
            sunriseOffset: daylightSensor?.config?.sunriseoffset,
            sunsetOffset: daylightSensor?.config?.sunsetoffset,
        };

        // Cache and return sunrise/sunset times
        // TODO - doing a state change here is a little ugly!
        const [keyStore, keyRead] = (daylight.value === "light") ? [keySunrise, keySunset] : [keySunset, keySunrise];

        // Store the current value
        localStorage.setItem(keyStore, JSON.stringify(daylight, null, 2));

        // Load the other value
        const d = localStorage.getItem(keyRead);
        let o;
        if (d != undefined) {
            o = JSON.parse(d);
            o.updated = new Date(o.updated);
        }

        if (daylight.value === "light") {
            daylight.sunrise = daylight.updated;
            daylight.sunset = o?.updated;
        } else {
            daylight.sunrise = o?.updated;
            daylight.sunset = daylight.updated;
        }
    }

    return daylight;
}

export const FourPartDay = (()=>{
    const parts = ["morning", "day", "evening", "night"];
    
    const daylight = {
        morning: "light",
        day: "light",
        evening: "dark",
        night: "dark"
    };
    
    const forward = {
        morning: false,
        day: true,
        evening: false,
        night: true
    };

    const brights = ["day", "bright", "read", "morning"];
    const dims = ["evening", "dimmed", "morning"];

    const scenes = {
        first: ["first"],
        morning: [...new Set(["morning", ...dims, ...brights])],
        day: [...new Set(["day", ...brights, ...dims])],
        evening: [...new Set(["evening", ...dims, ...brights])],
        night: [...new Set(["night", "nightlight", ...dims])],
    };

    const adjustments = parts.map(part => `${part}-${daylight[part] === "light" ? "dark" : "light"}`);

    const rules = [...parts, ...adjustments];

    const standardRules = {
        // Times
        "morning": "T06:30:00",
        "day": "T08:30:00",
        "evening": "T19:30:00",
        "night": "T23:00:00",
    
        // Daylight adjustments
        "morning-dark": "morning",
        "day-dark": "day",
        "evening-light": "evening",
        "night-light": "night",
    };

    const keyRules = "hue-four-part-day";
    const keyManual = "hue-four-part-day-manual";
    const keyLastAction = "hue-four-part-day-last-action";

    function getRules() {
        let rules = localStorage.getItem(keyRules);
        if (rules == undefined) {
            rules = standardRules;
            localStorage.setItem(keyRules, JSON.stringify(rules, null, 2));
        } else {
            rules = JSON.parse(rules);
        }
        return rules;
    }
    
    function setRules(rules) {
        localStorage.setItem(keyRules, JSON.stringify(rules, null, 2));
    }

    function getManual() {
        const item = localStorage.getItem(keyManual);
        if (item == undefined) {
            return undefined;
        }
        const o = JSON.parse(item);
        o.start = new Date(o.start);
        o.kind = "manual";
        return o;
    }

    function setManual(manual) {
        localStorage.setItem(keyManual, JSON.stringify(manual, null, 2));
    }

    function removeManual() {
        localStorage.removeItem(keyManual);
    }

    function getLastAction() {
        const item = localStorage.getItem(keyLastAction);
        if (item == undefined) {
            return undefined;
        }
        const o = JSON.parse(item);
        o.date = new Date(o.date);
        return o;
    }

    function setLastAction(action) {
        localStorage.setItem(keyLastAction, JSON.stringify(action, null, 2));
    }

    // Returns the part based only on the time rules
    function getPartFromTime(rules, date) {
        rules = rules || getRules();
        date = date || new Date();

        const today = new Date(date);
        today.setHours(0, 0, 0, 0);

        function getTimeSeconds(date) {
            return (date.getHours() * 60 * 60) +
            (date.getMinutes() * 60) +
            (date.getSeconds())
            ;
        }

        function timeToSeconds(time) {
            const date = new Date(new Date().toISOString().substring(0, 10) + time);
            return getTimeSeconds(date);
        }

        const fourPartDaySeconds = {
            morning: timeToSeconds(rules.morning),
            day: timeToSeconds(rules.day),
            evening: timeToSeconds(rules.evening),
            night: timeToSeconds(rules.night),
        }

        // Assume that morning starts on or after 0 
        // and night starts before 24
    
        const now = getTimeSeconds(date);

        if (now < fourPartDaySeconds.morning) {
            const lastNight = new Date(today);
            lastNight.setDate(lastNight.getDate() - 1);
            lastNight.setSeconds(fourPartDaySeconds.night);
            return { name: "night", start: lastNight, kind: "time" };
        }

        const start = new Date(today);

        if (now < fourPartDaySeconds.day) {
            start.setSeconds(fourPartDaySeconds.morning);
            return { name: "morning", start, kind: "time" };
        }
        if (now < fourPartDaySeconds.evening) {
            start.setSeconds(fourPartDaySeconds.day);
            return { name: "day", start, kind: "time" };
        }
        if (now < fourPartDaySeconds.night) {
            start.setSeconds(fourPartDaySeconds.evening);
            return { name: "evening", start, kind: "time" };
        }

        start.setSeconds(fourPartDaySeconds.night);
        return { name: "night", start, kind: "time" };
    }

    function adjustPart(rules, part, daylight) {
        // If there's no daylight information, return the current part
        if (daylight === undefined) {
            return part;
        }

        const adjustment = `${part.name}-${daylight.value}`;
        const result = rules[adjustment];

        // If there's no adjustment, return the current part
        if ((result === undefined) || (result === part.name)) {
            return part;
        }

        // If the daylight change happened in the current period,
        // we can adjust to the next period.
        // Otherwise, we can adjust to the previous period.

        // Day can move to evening, but not morning
        // Night can move to morning, but not evening
        const isForwardPart = forward[part.name];
        const daylightPart = getPartFromTime(rules, daylight.updated);
        const isForwardTransition = (daylightPart.name === part.name);

        // If the transition and the part are in different directions,
        // return the original part without any adjustment
        if (isForwardTransition !== isForwardPart) {
            return part;
        }

        // Start time is the later of the original period's start time or the sunset/sunrise time
        return { name: result, start: new Date(Math.max(daylight.updated, part.start)), kind: "adjustment" };
    }

    // Returns the part based on time, daylight rules, and manual override
    function getPart(data, rules, date, manual) {
        rules = rules || getRules();
        date = date || new Date();
        manual = manual || getManual();

        if (manual !== undefined) {
            if (manual.locked) {
                return manual;
            }
        }

        const part = getPartFromTime(rules, date);

        const daylight = getDaylight(data);
        const adjustedPart = adjustPart(rules, part, daylight);

        if (manual !== undefined) {
            const expired = manual.start < adjustedPart.start;
            if (!expired) {
                return manual;
            }
        }

        return adjustedPart;
    }

    function getScene(data, groupID, partName) {
        partName = partName || getPart(data).name;

        // Allow the 'first' scene to be used if no previous action this morning
        let firstScenes = [];
        if (partName === "morning") {
            const o = getLastAction();
            if (o !== undefined) {
                const day = new Date(o.date);
                day.setHours(0, 0, 0, 0);

                const today = new Date();
                today.setHours(0, 0, 0, 0);

                if ((day.getTime() != today.getTime()) || (o.part !== partName)) {
                    firstScenes = scenes["first"];
                }
            }
        }

        const daylight = getDaylight(data);
        const specific = (daylight !== undefined) ? `${partName}-${daylight.value}` : "";

        const possibleScenes = [...firstScenes, specific, ...scenes[partName]];
        const groupScenes = Object.values(data.scenes).filter(scene => scene.group === groupID);

        let matchingScene;
        for (const possibleScene of possibleScenes) {
            for (const scene of groupScenes) {
                const name = scene.name.toLowerCase();
                if (name === possibleScene) {
                    matchingScene = scene;
                    break;
                }
            }

            if (matchingScene !== undefined) {
                break;
            }
        }
    
        return matchingScene;
    }

    // Returns the 'off' scene associated with the group, time of day, lighting conditions
    // or undefined if there's no matching 'off' scene.
    function getOffScene(data, groupID, partName, lightDark) {
        partName = partName || getPart(data).name;
        lightDark = lightDark || getDaylight(data)?.value || "dark";

        const l1 = "off";
        const l2 = `off-${partName}`;
        const l3 = `off-${partName}-${lightDark}`;

        const possibleScenes = [l3, l2, l1];
        const groupScenes = Object.values(data.scenes).filter(scene => scene.group === groupID);

        let matchingScene;
        for (const possibleScene of possibleScenes) {
            for (const scene of groupScenes) {
                const name = scene.name.toLowerCase();
                if (name === possibleScene) {
                    matchingScene = scene;
                    break;
                }
            }

            if (matchingScene !== undefined) {
                break;
            }
        }

        return matchingScene;
    }

    // Returns an array of 'off' scenes associated with the group
    // or an empty array if no 'off' scenes are found.
    function getOffScenes(data, groupID) {

        const l1 = "off";
        const names = [l1];
        for (const dayPart of parts) {
            const l2 = `${l1}-${dayPart}`;
            names.push(l2);
            for (const lightDark of ["light", "dark"]) {
                const l3 = `${l2}-${lightDark}`;
                names.push(l3);
            }
        }

        return Object.values(data.scenes).filter(scene => scene.group === groupID && names.includes(scene.name.toLowerCase()));
    }

    return {
        parts, adjustments, rules, scenes, daylight, forward, standardRules,
        getRules, setRules, getManual, setManual, removeManual, getLastAction, setLastAction, getPartFromTime, adjustPart, getPart, getScene, getOffScene, getOffScenes
    };
})();

const dateFormatWithYear = Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric"});
const dateFormatWithoutYear = Intl.DateTimeFormat(undefined, { month: "short", day: "numeric"});

export function formatHumanDate(date) {
    try {
        const now = new Date();
        if (date.getFullYear() == now.getFullYear()) {
            return dateFormatWithoutYear.format(date);
        }
        return dateFormatWithYear.format(date);
    } catch (e) {
        return "Unknown";
    }
}

const timeFormatYMDT = Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric"});
const timeFormatMDT = Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "numeric"});
const timeFormatT = Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "numeric"});

export function formatHumanDateTime(date) {
    try {
        const now = new Date();
        if (date.getFullYear() == now.getFullYear()) {
            if ((date.getMonth() == now.getMonth()) && (date.getDate() == now.getDate())) {
                return timeFormatT.format(date);
            }
            return timeFormatMDT.format(date);
        }
        return timeFormatYMDT.format(date);
    } catch (e) {
        return "Unknown";
    }
}

export function localizeDateTime(dt) {
    if (dt === undefined) {
        return undefined;
        // return { display: "Unknown", displayDate: "Unknown", displayTime: "Unknown" };
    }

    const d = new Date(dt);
    const o = {weekday: "short", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "numeric", timeZoneName: "short"};
    const oDate = {weekday: "short", day: "numeric", month: "long", year: "numeric"};
    const oTime = {hour: "numeric", minute: "numeric", timeZoneName: "short"};
    const displayDate = d.toLocaleDateString(undefined, oDate);
    const displayTime = d.toLocaleTimeString(undefined, oTime).replace(/(:00)?:00( [AP]M)/i, "$2");
    const display = d.toLocaleString(undefined, o).replace(/(:00)?:00( [AP]M)/i, "$2");

    return { display, displayDate, displayTime };
}

function pick(names, items) {
    const chosen = names.map(p => []);
    const remainder = [];
    for (const item of items) {
        const index = names.indexOf(item.name.toLowerCase());
        if (index >= 0) {
            chosen[index].push(item);
        } else {
            remainder.push(item);
        }
    }
    return { chosen: chosen.flatMap(x => x), remainder };
}

export function paramsSort(params, items) {
    function getList(name) {
        const p = params.get(name);
        return p?.split(",").map(x => x.trim().toLowerCase());
    }

    const include = getList("include");
    if (include) {
        // Keep name sorting, but only for the listed items
        items = items.filter(item => include.includes(item.name.toLowerCase()));

        // If we wanted to use the sort order from include as well, we'd do this:
        // groups = include.map(n => groups.find(g => n === g.name.toLowerCase())).filter(x=>x);
    }

    const exclude = getList("exclude");
    if (exclude) {
        items = items.filter(item => !exclude.includes(item.name.toLowerCase()));
    }

    const last = getList("end");
    if (last) {
        const x = pick(last, items);

        items = [...x.remainder, ...x.chosen];
    }

    const first = getList("start");
    if (first) {
        const x = pick(first, items);

        items = [...x.chosen, ...x.remainder];
    }

    return items;
}

function FFromC(c) {
    return (c * 9/5) + 32;
}

function CFromF(f) {
    return (f - 32) * 5/9;
}

function TFromC(c) {
    return Math.floor(100 * c);
}

function TFromF(f) {
    return TFromC(CFromF(f));
}

export function optionsTemp(unit, selectedT, start, end, interval) {
    const fn = unit === "C" ? TFromC : TFromF;
    
    if (unit === "C") {
        start = (start !== undefined) ? start : 0;
        end = (end !== undefined) ? end : 40;
        interval = interval || 0.5;
    } else {
        start = (start !== undefined) ? start : 30;
        end = (end !== undefined) ? end : 110;
        interval = interval || 1;
    }

    selectedT = (selectedT !== undefined) ? selectedT : fn(start);
    let selected = false;

    const result = [];
    for (let current = start; current <= end; current += interval) {
        const e = document.createElement("option");
        const value = fn(current);
        e.value = value;
        e.innerText = interval < 1 ? current.toFixed(1) : current;

        if (!selected && (value >= selectedT)) {
            selected = true;
            e.selected = true;
        }

        result.push(e);
    }
    return result;
}

function optionsIDName(items) {
    const result = [];
    for (const group of items) {
        const e = document.createElement("option");
        e.value = group.id;
        e.innerText = group.name;

        result.push(e);
    }
    return result;

}

export function optionsGroup(data) {
    const groups = Object.values(data.groups);
    groups.sort((a,b) => a.name.localeCompare(b.name));

    return optionsIDName(groups);
}

export function optionsScene(data, group) {
    function isRecoveryScene(scene) {
        return scene.name.replaceAll(" ", "").toLowerCase().includes("recoveryscene");
    }

    const scenes = Object.values(data.scenes).filter(scene => (scene.group === group.id) && !isRecoveryScene(scene)).sort((a,b) => a.name.localeCompare(b.name));

    return optionsIDName(scenes);
}

/*
snapToGrid sets the grid-column-end style on grid items using the 
character length of the grid item to determine how many columns to use.
Assumption is that grid columns are evenly spaced.

.snap-grid - apply to a grid where you want snapping
.snap-grid-item - apply to items that you want extended to grid lines
(Items will not be snapped if they already have an explicit grid-column-end)
--grid-columns - the number of columns in a row of the grid
--grid-characters - the number of characters in a row of the grid
[data-characters] - a grid item attribute that overrides the character length
*/
export function snapToGrid(grid) {
    function characterLength(item, minimumLength = 12) {
        const c1 = parseInt(item.dataset.characters, 10) || undefined;
        if (c1 !== undefined) {
            return c1; // No minimum length here
        }

        if (item.nodeName === "SELECT") {
            const options = [...item.querySelectorAll("option")];
            let c2 = 0;
            for (const option of options) {
                if (option.text.length > c2) {
                    c2 = option.text.length;
                }
            }
            return Math.max(c2, minimumLength);
        }

        if (item.nodeName === "INPUT") {
            return Math.max(item.value.length, minimumLength);
        }

        return Math.max(item.innerText.length, minimumLength);
    }

    function setGridColumnEnd(item, columnsPerLine, charactersPerLine) {
        if (!["", "auto"].includes(getComputedStyle(item).gridColumnEnd)) {
            // Ignore elements with an explicit grid-column-end
            return;
        }

        const characters = characterLength(item);

        const controlColumns = Math.min(Math.ceil(columnsPerLine * characters / charactersPerLine), columnsPerLine);
        if (controlColumns > 1) {
            item.style.gridColumnEnd = `span ${controlColumns}`;
        }
    }

    const grids = (grid !== undefined) ?
        (Array.isArray(grid) ? grid : [grid]) :
        [...document.querySelectorAll(".snap-grid")];

    for (const grid of grids) {
        const style = getComputedStyle(grid);
        // More reliable than parsing the grid style
        const columnsPerLine = parseInt(style.getPropertyValue("--grid-columns"), 10) || undefined;
        // Must be provided by the designer
        const charactersPerLine = parseInt(style.getPropertyValue("--grid-characters"), 10) || undefined;
        if (columnsPerLine && charactersPerLine) {
            const items = [...grid.querySelectorAll(".snap-grid-item")];
            for (const item of items) {
                setGridColumnEnd(item, columnsPerLine, charactersPerLine);
            }
        }
    }
}

export class CallionicaHuePage {
    constructor() {
        this.params = new URLSearchParams(document.location.search);
        this.scale_ = undefined;
        this.pauseData = false;
        this.pauseUpdates = false;
        this.dataRequestMade = false;
        this.dataTimeoutToken = undefined;
        this.delay = 2 * 1000;
        this.cacheMS = this.delay/2;
        this.delayController = new AbortController();
        this.hubs = [];

        window.addEventListener('pageshow', (event) => {
            this.update();
        });
    }

    // Parse a comma-separated, case-insensitive list from params 
    getParamsList(name) {
        const p = this.params.get(name);
        return p?.split(",").map(x => x.trim().toLowerCase());
    }

    // Sort and filter items by name using parameters passed to the page
    sortAndFilter(items) {
        return paramsSort(this.params, items);
    }

    // Returns the current temperature scale ("C" or "F")
    get scale() {
        if (this.scale_ !== undefined) {
            return this.scale_;
        }

        const paramScale = this.params.get("scale")?.toUpperCase().trim() ?? undefined;
        const scale = paramScale ?? sessionStorage.getItem("scale") ?? localStorage.getItem("scale") ?? "C";
        this.scale_ = (scale.startsWith("F")) ? "F" : "C";

        return this.scale_;
    }

    // Get the bridges to use for the current page
    getBridges() {
        let bridges;

        const bridgeNamesOrIDs = this.getParamsList("bridges") || undefined;
        if (bridgeNamesOrIDs !== undefined) {
            const connections = loadConnections();
            bridges = bridgeNamesOrIDs.map(id => {
                const named = connections.find(connection => connection.bridge.name.toLowerCase() === id);
                if (named !== undefined) {
                    return { id: named.bridge.id };
                } else {
                    return { id };
                }
            });
        }

        if (bridges === undefined) {
            bridges = loadCurrentBridges();
        }

        return bridges;
    }

    // Load connections for the specified bridges
    getConnections(bridges) {
        return bridges.map(
            bridge => loadConnection("Callionica", bridge)
        );
    }

    // Get the data for the specified connections
    async getData(connections, cacheMS) {
        const promises = connections.map(
            connection => getAllPlus(connection, cacheMS)
        );
        const results = await Promise.allSettled(promises);
        return connections.map((connection, index) => {
            return {
                connection,
                data: results[index].value,
                status: results[index].status
            };
        });
    }

    async handlePossibleErrors(dataResults) {
        const missing = (dataResults.length === 0) || dataResults.some(result => result.connection === undefined);

        const failures = dataResults.filter(r => (r.connection !== undefined) && (r.status !== "fulfilled")).map(r => r.connection);
        
        if (!missing && (failures.length === 0)) {
            delete document.body.dataset.showConnection;
            return;
        }

        document.body.dataset.showConnection = true;

        const e = document.querySelector("#connection");

        if (missing) {
            const existing = e.querySelector(`a[href='hue-callionica-connect.html']`);
            if (!existing) {
                e.innerHTML = `<a href="hue-callionica-connect.html">Connect to your Hue bridge</a>`;
            }
        } else {
            let generalFailure = false;

            for (const connection of failures) {
                const diagnosis = await diagnoseConnection(connection);

                const link = `https://${connection.bridge.ip}/api/unauthenticated/config`;
                const cert = e.querySelector(`a[href='${link}']`);

                if (diagnosis === "certificate-error") {    
                    if (!cert) {
                        const p = document.createElement("p");
                        p.innerHTML = `<a href="${link}" rel="noopener">Refresh connection '${connection.bridge.name}'</a>`;
                        e.append(p);
                    }
                    continue;
                }

                if (cert) {
                    cert.parentElement?.remove();
                }

                if (diagnosis === "success") {
                    continue;
                }

                generalFailure = true;

                console.log("Diagnosis", diagnosis);
            }

            const general = e.querySelector(`a[href='hue-callionica-connect.html']`);
            if (generalFailure) {
                if (!general) {
                    const p = document.createElement("p");
                    p.innerHTML = `<a href="hue-callionica-connect.html">Connect to your Hue bridge</a>`;
                    e.append(p);
                }
            } else if (general) {
                general.parentElement?.remove();
            }
        }
    }

    // Override to refresh the page when data changes (or periodically)
    // Argument is { connection, data }[]
    async onUpdatePage(hubs) {
        console.log("onUpdatePage", new Date());
    }

    // Request data from the Hue bridges (unless we shouldn't)
    async requestData_(cacheMS) {
        if (!this.pauseData && !document.hidden && navigator.onLine) {
            const bridges = this.getBridges();
            const connections = this.getConnections(bridges);
            const dataResults = await this.getData(connections, cacheMS);

            await this.handlePossibleErrors(dataResults);

            return dataResults.filter(r => r.status === "fulfilled");
        }
    }

    // Update the page with the latest data (unless we shouldn't)
    async updatePage_(hubs) {
        if (!this.pauseUpdates && !document.hidden) {
            await this.onUpdatePage(hubs);
        }
    }

    // Returns { connection, data } or undefined
    getBridgeData(bridgeID) {
        return this.hubs.find(d => d.connection.bridge.id === bridgeID) ?? undefined;
    }

    // Without explicit control, the page will poll the bridges at 2 second
    // intervals and will accept cached data no older than 1 second.
    // (Data might be cached if there are other pages active.)
    // To get truly fresh data call update() which will quit out of the pause
    // state and request fresh data from the bridges.
    // The page will then go back to polling and accepting cached data.
    async loop() {
        while (true) {
            const hubs = await this.requestData_(this.cacheMS);
            this.cacheMS = Math.min(this.delay/2, 1 * 1000);
            if (hubs !== undefined) {
                this.hubs = hubs;
            }

            await this.updatePage_(this.hubs);

            this.delayController = new AbortController();
            await delay(this.delay, this.delayController.signal);
        }
    }

    update() {
        this.cacheMS = 0;
        this.delayController.abort();
    }
}