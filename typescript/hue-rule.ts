// deno-lint-ignore-file no-unused-vars
import { Entity, Method, ID, EntityID, SensorID } from "./hue-core.ts";

type TimeDuration = string;
type TimeInterval = string;

type Rule = {
    name: string,
    conditions: Condition[],
    actions: Action[]
};

type Action = {
    address: string,
    method: Method,
    body: Record<string, unknown>
};

type Condition = {
    address: string,
    operator: "eq" | "lt" | "gt",
    value: string // Conditions have string values
} | {
    address: string,
    operator: "ddx" | "stable" | "not stable",
    value: TimeDuration
} | {
    address: string,
    operator: "in" | "not in",
    value: TimeInterval
} | {
    address: string,
    operator: "dx"
};

type ButtonEvent = number;
type ConditionValue = boolean | number | string;

type WriteableStateProperty = "flag" | "status";
type StateProperty = WriteableStateProperty | "buttonevent" | "presence" | "temperature";

class Conditions {
    static isEqual(id: EntityID, value: ConditionValue, property: StateProperty = "status"): Condition {
        return {
            address: `/${id.entity}s/${id.id}/state/${property}`,
            operator: "eq",
            value: `${value}`
        };
    }

    static isChanged(id: EntityID, property: StateProperty = "status"): Condition {
        return {
            address: `/${id.entity}s/${id.id}/state/${property}`,
            operator: "dx"
        };
    }

    static isUpdated(id: EntityID): Condition {
        return {
            address: `/${id.entity}s/${id.id}/state/lastupdated`,
            operator: "dx"
        };
    }

    static isChangedTo(id: EntityID, value: ConditionValue, property: StateProperty = "status"): Condition[] {
        return [this.isEqual(id, value, property), this.isChanged(id, property)];
    }

    static isUpdatedTo(id: EntityID, value: ConditionValue, property: StateProperty = "status"): Condition[] {
        return [this.isEqual(id, value, property), this.isUpdated(id)];
    }

    static wasChangedTo(id: EntityID, value: ConditionValue, time: TimeDuration, property: StateProperty = "status"): Condition[] {
        return [
            this.isEqual(id, value, property),
            {
                address: `/${id.entity}s/${id.id}/state/${property}`,
                operator: "ddx",
                value: time
            }
        ];
    }

    static wasUpdatedTo(id: EntityID, value: ConditionValue, time: TimeDuration, property: StateProperty = "status"): Condition[] {
        return [
            this.isEqual(id, value, property),
            {
                address: `/${id.entity}s/${id.id}/state/lastupdated`,
                operator: "ddx",
                value: time
            }
        ];
    }

    static notChangedSince(id: EntityID, value: ConditionValue, time: TimeDuration, property: StateProperty = "status"): Condition[] {
        return [
            this.isEqual(id, value, property),
            {
                address: `/${id.entity}s/${id.id}/state/${property}`,
                operator: "stable",
                value: time
            }
        ];
    }

    static notUpdatedSince(id: EntityID, value: ConditionValue, time: TimeDuration, property: StateProperty = "status"): Condition[] {
        return [
            this.isEqual(id, value, property),
            {
                address: `/${id.entity}s/${id.id}/state/lastupdated`,
                operator: "stable",
                value: time
            }
        ];
    }

    static isPresent(id: SensorID): Condition[] {
        return [this.isEqual(id, true, "presence")];
    }

    static isButtonEvent(id: SensorID, value: ButtonEvent): Condition[] {
        return this.isUpdatedTo(id, value, "buttonevent");
    }

    static sort(conditions: Condition[]): Condition[] {
        return conditions.sort((a, b) => {
            const aa = a.address.replace(/[/]lastupdated$/i, "/zzz-lastupdated");
            const ba = b.address.replace(/[/]lastupdated$/i, "/zzz-lastupdated");
            const n = aa.localeCompare(ba);
            if (n !== 0) {
                return n;
            }

            const ops = ["eq", "lt", "gt", "ddx", "stable", "not stable", "in", "not in", "dx"];
            const ao = ops.findIndex(o => o === a.operator);
            const bo = ops.findIndex(o => o === b.operator);
            if (ao < bo) {
                return -1;
            }

            if (ao > bo) {
                return +1;
            }

            return 0;
        });
    }
}

class Actions {

}

// function parseConditions(conditions: Condition[]) {

//     for (const condition of conditions) {
//         if (done.includes(condition)) {
//             continue;
//         }
//     }
// }

// function actionSetValue<Value extends boolean | number>(id: ID<"sensor">, value: Value) {
//     type Body<T> = T extends boolean ? { flag: boolean } : { status: number };
//     const body = ((typeof value === "boolean") ? { flag: value } as Body<boolean> : { status: value } as Body<number>) as Body<Value>;
//     return {
//         address: `/${id.entity}/${id.id}/state`,
//         method: "PUT" as const,
//         body: body
//     };
// }

