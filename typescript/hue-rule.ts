import { Entity, Method, ID, EntityID, SensorID } from "./hue-core.ts";

type Time = string;
type ButtonEvent = number;

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

type ConditionValue = boolean | number | string;

type Condition = {
    address: string,
    operator: "eq" | "lt" | "gt",
    value: string
} | {
    address: string,
    operator: "ddx" | "stable",
    value: Time
} | {
    address: string,
    operator: "dx"
};

class Conditions {
    static isEqual(id: EntityID, value: ConditionValue, property = "status"): Condition {
        return {
            address: `/${id.entity}s/${id.id}/state/${property}`,
            operator: "eq",
            value: `${value}`
        };
    }

    static isChanged(id: EntityID, property = "status"): Condition {
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

    static isChangedTo(id: EntityID, value: ConditionValue, property = "status"): Condition[] {
        return [this.isEqual(id, value, property), this.isChanged(id, property)];
    }

    static isUpdatedTo(id: EntityID, value: ConditionValue, property = "status"): Condition[] {
        return [this.isEqual(id, value, property), this.isUpdated(id)];
    }

    static wasChangedTo(id: EntityID, value: ConditionValue, time: Time, property = "status"): Condition[] {
        return [
            this.isEqual(id, value, property),
            {
                address: `/${id.entity}s/${id.id}/state/${property}`,
                operator: "ddx",
                value: time
            }
        ];
    }

    static wasUpdatedTo(id: EntityID, value: ConditionValue, time: Time, property = "status"): Condition[] {
        return [
            this.isEqual(id, value, property),
            {
                address: `/${id.entity}s/${id.id}/state/lastupdated`,
                operator: "ddx",
                value: time
            }
        ];
    }

    static notChangedSince(id: EntityID, value: ConditionValue, time: Time, property = "status"): Condition[] {
        return [
            this.isEqual(id, value, property),
            {
                address: `/${id.entity}s/${id.id}/state/${property}`,
                operator: "stable",
                value: time
            }
        ];
    }

    static notUpdatedSince(id: EntityID, value: ConditionValue, time: Time, property = "status"): Condition[] {
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
}

class Actions {

}

// function actionSetValue<Value extends boolean | number>(id: ID<"sensor">, value: Value) {
//     type Body<T> = T extends boolean ? { flag: boolean } : { status: number };
//     const body = ((typeof value === "boolean") ? { flag: value } as Body<boolean> : { status: value } as Body<number>) as Body<Value>;
//     return {
//         address: `/${id.entity}/${id.id}/state`,
//         method: "PUT" as const,
//         body: body
//     };
// }

