# Tests

The tests use [Vitest](https://vitest.dev/) and run against the real WASM
module in `dist/`, so build it first. Vitest 5 needs Node 22.12 or newer.

```bash
npm run build:wasm   # once, and after changing the C side
npm test             # or test:watch, test:coverage
```

## Layout

- `unit/`: code that needs no WASM module: slicing, range requests and the
  block cache (with a fake `XMLHttpRequest`/`fetch`), and the worker
  handshake (with a fake `Worker`). The worker path itself is not covered:
  it needs a browser for `Worker` and `WORKERFS`.
- `wasm/`: reads the fixtures through the WASM module, and writes new files.
- `setup.ts`: lets the browser-only module run in Node. It stubs `window`,
  serves the `.wasm` binary through `fetch`, and compiles it once per test
  file.
- `fixtures/`: small netCDF files, made by `fixtures/generate.py`.

## Known bugs: `test.fails`

A `test.fails` test passes while its assertions fail. Each one describes
behavior that should work but does not yet, with a comment on the cause.
Once a fix makes it pass, Vitest reports it as failing: replace
`test.fails` with `test`.

## Fixtures

The tests hard-code the values written by `generate.py`. To change or add a
fixture, edit the script and run it with netCDF4-python built with Blosc,
Zstandard, bzip2 and szip support (conda-forge's `netcdf4` is):

```bash
python tests/fixtures/generate.py
```

`types.nc` and `enum-fill.nc` change on every run, because HDF5 stores
timestamps with their enum types. Only commit them when their content
changed.

| File               | Contents                                                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `basic.nc`         | Unlimited and fixed dimensions, coordinate variables, global and variable attributes, a chunked 3D field                                     |
| `types.nc`         | Every numeric type with its extremes, NaN and infinities, chars, strings, an enum, a scalar                                                  |
| `enum-fill.nc`     | An enum variable with a `_FillValue`                                                                                                         |
| `groups.nc`        | Nested groups, a variable using a parent group's dimension                                                                                   |
| `classic.nc`       | `NETCDF3_CLASSIC` format                                                                                                                     |
| `compression-*.nc` | The same field per filter: zlib (with and without shuffle), zstd, bzip2, five Blosc codecs, and szip, which the WASM module does not support |
