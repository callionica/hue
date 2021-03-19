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

    const AP = new Point(p.x - a.x, p.y - a.y);
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
    return Math.Sqrt(dx * dx + dy * dy);
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
            const dist = distance(point, p);
            return { pt, dist };
        }).reduce((previous, current) => current.dist < previous.dist ? current : previous).pt;

        return closest;
    }
}

const WhiteD65 = new Point(0.312713, 0.329016);

export const White = new Point(0.322727, 0.32902);

export const WideGamut = new Gamut([
    [0.700607, 0.299301],
    [0.172416, 0.746797],
    [0.135503, 0.039879]
]);

