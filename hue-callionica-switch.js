// deno-lint-ignore-file

function getActionElement(src) {
    while (src && src.dataset?.action == undefined) {
        src = src.parentNode;
    }
    return src;
}

export class ActionHandler {
    constructor(document) {
        this.document = document;

        this.activity = 0;
        this.action = undefined;
        this.actionElement = undefined;
        this.repeater = undefined;
        
        document.addEventListener("mousedown", (e) => this.down_(e));
        document.addEventListener("mouseup", (e) => this.up_(e));

        document.addEventListener("touchstart", (e) => this.down_(e));
        document.addEventListener("touchend", (e) => { this.up_(e); });
        document.addEventListener("touchcancel", (e) => { this.clear(); });
    }

    down_(e) {
        if ((e.buttons !== undefined)) {
            if (e.buttons !== 1) {
                return;
            }
            this.clientX = e.clientX;
            this.clientY = e.clientY;
        }

        if ((e.touches !== undefined)) {
            if (e.touches.length !== 1) {
                return;
            }
            this.clientX = e.touches[0].clientX;
            this.clientY = e.touches[0].clientY;
        }

        clearInterval(this.repeater);

        const actionElement = getActionElement(e.srcElement);
        if (actionElement) {
            const action = actionElement.dataset.action;
            this.isLong = false;
            this.action = action;
            this.actionElement = actionElement;

            this.activity++;
            const activity = this.activity;
            this.activityStart = Date.now();
        
            this.down(actionElement, action);
            
            this.repeater = setInterval(() => {
                if (this.activity === activity) {
                    this.repeat(this.actionElement, this.action);
                    this.isLong = true;
                }
            }, 800);
        }
    }

    up_(e) {
        let clientX;
        let clientY;

        if ((e.buttons !== undefined)) {
            if (e.buttons !== 0) {
                return;
            }
            clientX = e.clientX;
            clientY = e.clientY;
        }

        if ((e.touches !== undefined)) {
            if (e.touches.length !== 0) {
                return;
            }
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
        }

        clearInterval(this.repeater);

        const limit = 4;
        if ((Math.abs(clientX - this.clientX) > limit) || (Math.abs(clientY - this.clientY) > limit)) {
            return;
        }

        if (this.actionElement !== undefined) {
            const actionElement = getActionElement(e.srcElement);
            if (actionElement === this.actionElement) {
                e.preventDefault();
                this.up(this.actionElement, this.action);
                this.actionElement = undefined;
                this.action = undefined;
            }
        }
    }

    down(e, id) {
    }

    repeat(e, id) {
    }

    up(e, id) {
        const activityEnd = Date.now();
        const duration = activityEnd - this.activityStart;
        if (this.isLong) {
            this.upLong(e, id);
        } else {
            this.upShort(e, id);
        }
    }

    upShort(e, id) {
    }

    upLong(e, id) {
    }

    clear() {
        clearInterval(this.repeater);
        this.actionElement = undefined;
        this.action = undefined;
    }
}