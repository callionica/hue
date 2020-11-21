import { Method } from "./hue-core.ts";

type Time = string;

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
    value: string
} | {
    address: string,
    operator: "ddx" | "stable",
    value: Time
} | {
    address: string,
    operator: "dx"
};

class Rules {

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

