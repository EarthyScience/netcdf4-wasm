// Normalising caught values to Error

import { describe, expect, test } from "vitest";
import { toError } from "../../src/errors.js";

describe("toError", () => {
    test("returns Error instances unchanged", () => {
        const err = new TypeError("boom");
        expect(toError(err)).toBe(err);
    });

    test("keeps the message of error-like objects", () => {
        expect(toError({ message: "boom" }).message).toBe("boom");
    });

    test("stringifies anything else", () => {
        expect(toError("boom").message).toBe("boom");
        expect(toError(29).message).toBe("29");
        expect(toError(undefined).message).toBe("undefined");
    });
});
