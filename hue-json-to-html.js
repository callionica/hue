// Converts hue JSON to HTML using links to make it easier to navigate

function hueJsonToHtml(value, stack, indent) {
    stack = stack || [];
    indent = indent || 0;

    if (value === undefined) {
        return "undefined";
    }

    if (value === null) {
        return "null";
    }

    const type = typeof value;
    switch (type) {
        case "boolean":
            return JSON.stringify(value);
            break;
        case "number":
            return JSON.stringify(value);
            break;
        case "string":
            if (stack[stack.length - 1] === "scene") {
                return `<a href="#scenes/${value}">${JSON.stringify(value)}</a>`;
            }

            if (stack[stack.length - 1] === "lights") {
                return `<a href="#lights/${value}">${JSON.stringify(value)}</a>`;
            }

            if (stack[stack.length - 1] === "group") {
                return `<a href="#groups/${value}">${JSON.stringify(value)}</a>`;
            }

            if (stack[stack.length - 1] === "owner") {
                return `<a href="#whitelist/${value}">${JSON.stringify(value)}</a>`;
            }

            let prefix = "";
            let suffix = "";
            let pieces = value.split("/");
            if (pieces.length >= 3) {
                if (pieces[0] === "" && pieces[1] === "api") {
                    pieces = pieces.slice(3, 5); // Skip 1) blank, 2) API and 3) username
                } else {
                    pieces = pieces.slice(1, 3);
                }
                const destination = pieces.join("/");
                prefix = `<a href="#${destination}">`;
                suffix = `</a>`;
            }
            return `${prefix}${JSON.stringify(value)}${suffix}`;
            break;
    }

    if (value instanceof Date) {
        return JSON.stringify(value);
    }

    let dent = "   ".repeat(indent);
    let dent1 = dent;
    if (indent > 0) {
        dent1 = "   ".repeat(indent - 1);
    }

    if (Array.isArray(value)) {
        return `[\n${dent}` + value.map(v => hueJsonToHtml(v, stack, indent + 1)).join(`,\n${dent}`) + `\n${dent1}]`;
    }

    const order = ["name", "type", "lasttriggered"];
    
    function getOrder(v) {
        const result = order.indexOf(v);
        if (result >= 0) {
            return result;
        }
        return order.length;
    }

    let result = ["{"];
    const entries = Object.entries(value).sort((lhs, rhs)=>{
        const l = getOrder(lhs[0]);
        const r = getOrder(rhs[0]);
        return l - r;
    });
    for (const [name, value] of entries) {
        const isResource = ((stack.length === 1) && (stack[stack.length - 1] !== "config")) || (stack[stack.length - 1] === "whitelist");
        if (isResource) {
            result.push(`<span id="${stack[stack.length - 1]}/${name}">`);
        }
        stack.push(name);
        result.push(JSON.stringify(name) + ": " + hueJsonToHtml(value, stack, indent + 1) + ",");
        stack.pop();
        if (isResource) {
            result.push(`</span>`);
        }
    }
    
    return result.join(`\n${dent}`) + `\n${dent1}}`;
}

function convertPage() {
    globalThis.$data$ = JSON.parse(document.body.innerText);
    document.body.innerHTML = `<pre>${hueJsonToHtml(globalThis.$data$)}</pre>`;
}
