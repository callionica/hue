const keySunrise = "hue-four-part-day-sunrise";
const keySunset = "hue-four-part-day-sunset";

export function getDaylight(data) {
    const daylightSensor = Object.values(data.sensors).find(sensor => sensor.type === "Daylight");

    let daylight;
    if (daylightSensor?.config?.configured && daylightSensor?.config?.on) {
        daylight = {
            value: (daylightSensor?.state?.daylight) ? "light" : "dark",
            updated: new Date(daylightSensor?.state?.lastupdated),
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

        const possibleScenes = [...firstScenes, ...scenes[partName]];
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

    return {
        parts, adjustments, rules, scenes, daylight, forward, standardRules,
        getRules, setRules, getManual, setManual, removeManual, getLastAction, setLastAction, getPartFromTime, adjustPart, getPart, getScene
    };
})();



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

    const preferred = getList("sort");
    if (preferred) {
        const x = preferred.map(p => []);
        const y = [];
        for (const item of items) {
            const index = preferred.indexOf(item.name.toLowerCase());
            if (index >= 0) {
                x[index].push(item);
            } else {
                y.push(item);
            }
        }

        items = [...x.flatMap(x => x), ...y];
    }

    return items;
}