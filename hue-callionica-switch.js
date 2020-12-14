// deno-lint-ignore-file
// Creates the HTML and event handlers for a dimmer switch UI connected to a sensor

export class Switch {
    constructor(document, rootElement) {
        this.document = document;
        this.rootElement = rootElement;
        
        const create = (buttonID) => {
            const button = this.document.createElement("button");
            button.dataset.action = buttonID;
            button.onmousedown = (e) => this.down(e, buttonID);
            button.onmouseup = (e) => this.up(e, buttonID);

            button.innerText = buttonID;
            return button;
        }
        
        const buttonIDs = ["on", "brighter", "dimmer", "off"];

        for (const buttonID of buttonIDs) {
            const e = create(buttonID);
            this.rootElement.appendChild(e);
        }
    }

    down(e, id) {
        console.log("DOWN", e, id);

        this.activity = id;
        this.activityStart = Date.now();
        
    }

    up(e, id) {
        console.log("UP", e, id, this.active);

        if (id !== this.activity) {
            return;
        }

        
    }
}