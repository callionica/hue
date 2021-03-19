function relationOfPointToLine(point, line) {
    const [a, b] = line;
    const slope = (a.y - b.y) / (a.x - b.x);
    const intercept = a.y - slope * a.x;

    const maxY = point.x * slope + intercept;

    if (point.y < maxY) {
        return "below";
    }

    if (point.y > maxY) {
        return "above";
    }

    return "on";
}

function isAbove(point, line) {
    return ["above", "on"].includes(relationOfPointToLine(point, line));
}

function isBelow(point, line) {
    return ["below", "on"].includes(relationOfPointToLine(point, line));
}

function closestPointOnLine(point, line) {
    const [a, b] = line;

    const AP = new Point(point.x - a.x, point.y - a.y);
    const AB = new Point(b.x - a.x, b.y - a.y);

    const ab2 = AB.x * AB.x + AB.y * AB.y;
    const ap_ab = AP.x * AB.x + AP.y * AB.y;

    const t = ap_ab / ab2;

    if (t < 0) {
        t = 0;
    } else if (t > 1) {
        t = 1;
    }

    return new Point(a.x + AB.x * t, a.y + AB.y * t);
}

function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

export function ctToXY(ct) {
    const kelvin = 1000000 / ct;
    let x, y;

    if (kelvin < 4000) {
        x = 11790 +
            57520658 / kelvin +
            -15358885888 / kelvin / kelvin +
            -17440695910400 / kelvin / kelvin / kelvin;
    } else {
        x = 15754 +
            14590587 / kelvin +
            138086835814 / kelvin / kelvin +
            -198301902438400 / kelvin / kelvin / kelvin;
    }
    if (kelvin < 2222) {
        y = -3312 +
            35808 * x / 0x10000 +
            -22087 * x * x / 0x100000000 +
            -18126 * x * x * x / 0x1000000000000;
    } else if (kelvin < 4000) {
        y = -2744 +
            34265 * x / 0x10000 +
            -22514 * x * x / 0x100000000 +
            -15645 * x * x * x / 0x1000000000000;
    } else {
        y = -6062 +
            61458 * x / 0x10000 +
            -96229 * x * x / 0x100000000 +
            50491 * x * x * x / 0x1000000000000;
    }
    y *= 4;
    x /= 0xFFFF;
    y /= 0xFFFF;

    return new Point(Math.round(x * 10000) / 10000, Math.round(y * 10000) / 10000);
}

export class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

export class Gamut {
    constructor(gamut){
        const [pointR, pointG, pointB] = gamut;
        this.r = new Point(pointR[0], pointR[1]);
        this.g = new Point(pointG[0], pointG[1]);
        this.b = new Point(pointB[0], pointB[1]);
    }

    contains(point) {
        const result =
            isBelow(point, [this.r, this.g]) &&
            isBelow(point, [this.g, this.b]) &&
            isAbove(point, [this.b, this.r]);
        return result;
    }

    nearest(point) {
        if (this.contains(point)) {
            return point;
        }

        const lines = [[this.r, this.g], [this.g, this.b], [this.b, this.r]];

        const closest = lines.map(line => {
            const pt = closestPointOnLine(point, line);
            const dist = distance(point, pt);
            return { pt, dist };
        }).reduce((previous, current) => current.dist < previous.dist ? current : previous).pt;

        return closest;
    }

    nearestFromCT(ct) {
        const xy = ctToXY(ct);
        // console.log("ct-xy", xy);
        return this.nearest(xy);
    }
}

const WhiteD65 = new Point(0.312713, 0.329016);

export const White = new Point(0.322727, 0.32902);

export const WideGamut = new Gamut([
    [0.700607, 0.299301],
    [0.172416, 0.746797],
    [0.135503, 0.039879]
]);

export function lightXY(light) {
    if (light.state?.colormode === "xy") {
        return new Point(light.state.xy[0], light.state.xy[1]);
    }

    if (light.state?.colormode === "ct") {
        const ct = light.state.ct;
        const xy = ctToXY(ct);
        // TODO - do we need to conform to the gamut here?
        return xy;
    }

    return undefined;
}

export function ctToLightXY(ct, light) {
    const g = light.capabilities?.control?.colorgamut;
    const gamut = (g !== undefined) ? new Gamut(g) : WideGamut;
    const xy = gamut.nearestFromCT(ct);
    return xy;
}

export function xyToLightXY(xy, light) {
    xy = Array.isArray(xy) ? new Point(xy[0], xy[1]) : xy;
    const g = light?.capabilities?.control?.colorgamut;
    const gamut = (g !== undefined) ? new Gamut(g) : WideGamut;
    const xy2 = gamut.nearest(xy);
    return xy2;
}