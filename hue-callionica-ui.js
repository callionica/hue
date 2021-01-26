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
        "morning": "T06:00:00",
        "day": "T08:30:00",
        "evening": "T19:30:00",
        "night": "T22:00:00",
    
        // Daylight adjustments
        "morning-dark": "morning",
        "day-dark": "day",
        "evening-light": "evening",
        "night-light": "night",
    };

    const key = "hue-four-part-day";

    function getRules() {
        let rules = localStorage.getItem(key);
        if (rules == undefined) {
            rules = standardRules;
            localStorage.setItem(key, JSON.stringify(rules, null, 2));
        } else {
            rules = JSON.parse(rules);
        }
        return rules;
    }
    
    function setRules(rules) {
        localStorage.setItem(key, JSON.stringify(rules, null, 2));
    }

    return { parts, adjustments, rules, scenes, daylight, forward, standardRules, getRules, setRules };
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