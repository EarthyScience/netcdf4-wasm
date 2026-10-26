import { Dataset, NetCDF4 } from '../index.js';
import { TestSetup } from '../test-setup.js';

describe('getFullMetadata', () => {
    let nc: NetCDF4;

    beforeEach(async () => {
        nc = await Dataset(TestSetup.getTestFilename('_metadata'), 'w');
    });

    afterEach(async () => {
        await nc.close();
    });

    test('preserves the variable name alongside a nested name attribute', async () => {
        const t = await nc.createVariable('t', 'f4');
        t.setAttr('name', 'Temperature');
        t.setAttr('units', 'K');

        const metadata = await nc.getFullMetadata();

        expect(metadata).toHaveLength(1);
        expect(metadata[0].name).toBe('t');
        expect(metadata[0].attributes.name).toBe('Temperature');
        expect(metadata[0].attributes).toEqual({ name: 'Temperature', units: 'K' });
        expect(metadata[0]).not.toHaveProperty('units');
    });

    test('returns metadata for variables with and without attributes', async () => {
        await nc.createDimension('x', 3);
        const t = await nc.createVariable('t', 'f4', ['x']);
        t.setAttr('units', 'K');
        t.setAttr('valid_range', [200, 320]);
        await nc.createVariable('p', 'f8');

        const metadata = await nc.getFullMetadata();

        expect(metadata).toHaveLength(2);
        expect(metadata[0]).toMatchObject({
            name: 't', dtype: 'f4', dimensions: ['x'], shape: [3],
            attributes: { units: 'K', valid_range: [200, 320] },
        });
        expect(metadata[1]).toMatchObject({ name: 'p', dtype: 'f8', shape: [] });
        expect(metadata[1].attributes).toEqual({});
    });
});
