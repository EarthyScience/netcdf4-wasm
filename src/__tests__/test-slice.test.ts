import { all, slice, resolveDim } from '../slice.js';

describe('slice selection compatibility', () => {
    test('all() behaves like slice(0, dimSize, 1)', () => {
        const dimSize = 17;
        expect(resolveDim(all(), dimSize)).toEqual(resolveDim(slice(0, dimSize, 1), dimSize));
    });

    test('null and "all" behave like all()', () => {
        const dimSize = 5;
        const expected = resolveDim(all(), dimSize);
        expect(resolveDim(null, dimSize)).toEqual(expected);
        expect(resolveDim("all", dimSize)).toEqual(expected);
    });
});

