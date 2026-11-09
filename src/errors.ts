// Error handling helpers

/** Turn a caught value, which can be anything that was thrown, into an Error. */
export function toError(err: unknown): Error {
    if (err instanceof Error) {
        return err;
    }
    if (
        typeof err === "object" &&
        err !== null &&
        "message" in err &&
        typeof err.message === "string"
    ) {
        return new Error(err.message);
    }
    return new Error(String(err));
}
