
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
        const x = new Array(preferred.length);
        const y = [];
        for (const item of items) {
            const index = preferred.indexOf(item.name.toLowerCase());
            if (index >= 0) {
                x[index] = item;
            } else {
                y.push(item);
            }
        }

        items = [...x.filter(x => x), ...y];
    }

    return items;
}