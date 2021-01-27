export function getDaylight(data) {
    const daylightSensor = Object.values(data.sensors).find(sensor => sensor.type === "Daylight");

    let daylight;
    if (daylightSensor?.config?.configured && daylightSensor?.config?.on) {
        daylight = {
            value: (daylightSensor?.state?.daylight) ? "light" : "dark",
            updated: new Date(daylightSensor?.state?.lastupdated)
        };
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

    const scenes = {
        morning: ["morning", "day", "dimmed"],
        day: ["day", "morning", "bright"],
        evening: ["evening", "day", "morning", "dimmed"],
        night: ["night", "nightlight"],
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
        let item = localStorage.getItem(keyManual);
        if (item == undefined) {
            return undefined;
        }
        return JSON.parse(item);
    }

    function setManual(manual) {
        localStorage.setItem(keyManual, JSON.stringify(manual, null, 2));
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
            return { name: "night", start: lastNight };
        }

        const start = new Date(today);

        if (now < fourPartDaySeconds.day) {
            start.setSeconds(fourPartDaySeconds.morning);
            return { name: "morning", start };
        }
        if (now < fourPartDaySeconds.evening) {
            start.setSeconds(fourPartDaySeconds.day);
            return { name: "day", start };
        }
        if (now < fourPartDaySeconds.night) {
            start.setSeconds(fourPartDaySeconds.evening);
            return { name: "evening", start };
        }

        start.setSeconds(fourPartDaySeconds.night);
        return { name: "night", start };
    }

    function adjustPart(rules, part, daylight) {
        // If there's no daylight information, return the current part
        if (daylight === undefined) {
            return part;
        }

        const adjustment = `${part}-${daylight.value}`;
        const result = rules[adjustment];

        // If there's no adjustment, return the current part
        if ((result === undefined) || (result === part)) {
            return part;
        }

        // If the daylight change happened in the current period,
        // we can adjust to the next period.
        // Otherwise, we can adjust to the previous period.

        // Day can move to evening, but not morning
        // Night can move to morning, but not evening
        const isForwardPart = forward[part];
        const daylightPart = getPartFromTime(rules, daylight.updated);
        const isForwardTransition = (daylightPart.name === part);

        // If the transition and the part are in different directions,
        // return the original part without any adjustment
        if (isForwardTransition !== isForwardPart) {
            return part;
        }

        return result;
    }

    // Returns the part based on time, daylight rules, and manual override
    function getPart(data, rules, date, manual) {
        rules = rules || getRules();
        date = date || new Date();

        const part = getPartFromTime(rules, date);

        const daylight = getDaylight(data);
        const adjustedPart = adjustPart(rules, part.name, daylight);

        if (manual !== undefined) {
            // Time wins if a new part started after our manual override was made
            const timeWins = manual.start < part.start;

            // Daylight wins if there was a daylight adjustment and light conditions changed after
            // our manual override was made
            const daylightWins = (adjustedPart !== part.name) && (daylight !== undefined) && manual.start < daylight.updated;

            if (!timeWins && !daylightWins) {
                return manual.part;
            }
        }

        return adjustedPart;
    }

    function getScene(data, groupID, part) {
        part = part || getPart(data);

        const possibleScenes = scenes[part];
        const groupScenes = Object.values(data.scenes).filter(scene => scene.group === groupID);

        let matchingScene;
        for (const possibleScene of possibleScenes) {
            for (const scene of groupScenes) {
                if (scene.name.toLowerCase() === possibleScene) {
                    matchingScene = scene;
                    break;
                }
            }
        }
    
        return matchingScene;
    }

    // function adjustPart_Test() {
    //     const rules = getRules();
    //     const part = "day";
    //     const daylight = undefined; //"dark";
    //     const daylightUpdated = new Date("2001-01-01T10:30:00");
    //     console.log(part, adjustPart(rules, part, daylight, daylightUpdated))
    // }

    // adjustPart_Test();

    return {
        parts, adjustments, rules, scenes, daylight, forward, standardRules,
        getRules, setRules, getPartFromTime, adjustPart, getPart, getScene
    };
})();



export function localizeDateTime(dt) {
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