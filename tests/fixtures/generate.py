"""Generate the netCDF test fixtures in this directory.

Requires netCDF4-python built with Blosc, Zstandard, bzip2 and szip support
(the PyPI wheels and conda-forge packages are):

    python tests/fixtures/generate.py

The tests hard-code the values written here, so keep both in sync.
"""

import os
import sys
from pathlib import Path

# conda-forge's netCDF4 bundles a Blosc plugin that fails to write; the one
# installed with conda-forge's libnetcdf works. netCDF4 only sets
# HDF5_PLUGIN_PATH on import when it is unset, so set it first.
CONDA_PLUGINS = Path(sys.prefix) / "hdf5" / "lib" / "plugin"
if "HDF5_PLUGIN_PATH" not in os.environ and CONDA_PLUGINS.is_dir():
    os.environ["HDF5_PLUGIN_PATH"] = str(CONDA_PLUGINS)

import netCDF4  # noqa: E402
import numpy as np  # noqa: E402

OUT = Path(__file__).parent


def basic():
    """Dimensions, coordinates, attributes and a 3D field for slicing."""
    with netCDF4.Dataset(OUT / "basic.nc", "w", format="NETCDF4") as ds:
        ds.title = "netcdf4-wasm test fixture"
        ds.Conventions = "CF-1.8"
        ds.version = np.int32(3)
        ds.pi = np.float64(np.pi)
        ds.valid_range = np.array([0, 100], dtype="i4")

        ds.createDimension("time", None)
        ds.createDimension("lat", 4)
        ds.createDimension("lon", 5)

        time = ds.createVariable("time", "f8", ("time",))
        time.units = "days since 2000-01-01"
        time.calendar = "standard"
        time[:] = [0.0, 1.0, 2.0]

        lat = ds.createVariable("lat", "f4", ("lat",))
        lat.units = "degrees_north"
        lat[:] = [-45.0, -15.0, 15.0, 45.0]

        lon = ds.createVariable("lon", "f4", ("lon",))
        lon.units = "degrees_east"
        lon[:] = [0.0, 72.0, 144.0, 216.0, 288.0]

        # temp[t, y, x] = 100 * t + 10 * y + x
        temp = ds.createVariable(
            "temp", "f4", ("time", "lat", "lon"), chunksizes=(1, 4, 5)
        )
        temp.units = "K"
        temp.long_name = "temperature"
        t, y, x = np.indices((3, 4, 5))
        temp[:] = 100 * t + 10 * y + x


def types():
    """One variable per netCDF type, including extremes and special values."""
    with netCDF4.Dataset(OUT / "types.nc", "w", format="NETCDF4") as ds:
        ds.createDimension("n", 4)
        ds.createDimension("strlen", 3)

        numeric = {
            "i1": [-128, -1, 0, 127],
            "u1": [0, 1, 254, 255],
            "i2": [-32768, -1, 0, 32767],
            "u2": [0, 1, 65534, 65535],
            "i4": [-(2**31), -1, 0, 2**31 - 1],
            "u4": [0, 1, 2**32 - 2, 2**32 - 1],
            "i8": [-(2**63), -1, 0, 2**63 - 1],
            "u8": [0, 1, 2**63, 2**64 - 1],
            "f4": [-1.5, 0.0, 0.25, 3.0e38],
            "f8": [np.nan, np.inf, -np.inf, 1.0e300],
        }
        for dtype, values in numeric.items():
            # fill_value=False: store the values as they are, unmasked
            var = ds.createVariable(dtype, dtype, ("n",), fill_value=False)
            var.set_auto_mask(False)
            var[:] = np.array(values, dtype=dtype)

        chars = ds.createVariable("chars", "S1", ("n", "strlen"))
        chars[:] = np.array([b"abc", b"de", b"f", b""], "S3").view("S1").reshape(4, 3)

        strings = ds.createVariable("strings", str, ("n",))
        strings[:] = np.array(["", "hello", "ünïcödé", "x"], dtype=object)

        cloud_t = ds.createEnumType(
            np.uint8, "cloud_t", {"clear": 0, "cloudy": 1, "missing": 255}
        )
        cloud = ds.createVariable("cloud", cloud_t, ("n",), fill_value=False)
        cloud[:] = np.array([0, 1, 255, 0], dtype="u1")

        scalar = ds.createVariable("scalar", "f8")
        scalar.assignValue(42.0)


def enum_fill():
    """An enum variable with a _FillValue, an attribute of the enum type."""
    with netCDF4.Dataset(OUT / "enum-fill.nc", "w", format="NETCDF4") as ds:
        ds.createDimension("n", 2)
        flag_t = ds.createEnumType(np.uint8, "flag_t", {"off": 0, "on": 1})
        flag = ds.createVariable("flag", flag_t, ("n",), fill_value=0)
        flag[:] = np.array([1, 0], dtype="u1")


def groups():
    """Nested groups, with a child variable using a parent dimension."""
    with netCDF4.Dataset(OUT / "groups.nc", "w", format="NETCDF4") as ds:
        ds.where = "root"
        ds.createDimension("x", 2)
        ds.createVariable("root_var", "i4", ("x",))[:] = [1, 2]

        a = ds.createGroup("a")
        a.where = "a"
        a.createDimension("y", 3)
        a.createVariable("a_var", "i4", ("x", "y"))[:] = np.arange(6).reshape(
            2, 3
        )

        b = a.createGroup("b")
        b.where = "b"
        b.createVariable("b_var", "f8", ("y",))[:] = [0.5, 1.5, 2.5]

        c = ds.createGroup("c")
        c.where = "c"


def classic():
    """NETCDF3_CLASSIC (CDF-1) file, read without HDF5."""
    with netCDF4.Dataset(OUT / "classic.nc", "w", format="NETCDF3_CLASSIC") as ds:
        ds.title = "classic"
        ds.createDimension("rec", None)
        ds.createDimension("x", 3)
        ds.createVariable("v", "f4", ("rec", "x"))[:] = np.arange(
            6, dtype="f4"
        ).reshape(2, 3)
        ds.createVariable("s", "i2", ("x",))[:] = [-1, 0, 1]


# The same 40x50 field in every compression fixture:
# data[y, x] = (50 * y + x) % 97. Large and repetitive enough for Blosc,
# which rejects buffers it cannot compress.
COMPRESSIONS = {
    "none": {},
    "zlib": {"compression": "zlib", "complevel": 4},
    "zlib-shuffle": {"compression": "zlib", "complevel": 4, "shuffle": True},
    "zstd": {"compression": "zstd"},
    "bzip2": {"compression": "bzip2"},
    "blosc_lz": {"compression": "blosc_lz"},
    "blosc_lz4": {"compression": "blosc_lz4"},
    "blosc_lz4hc": {"compression": "blosc_lz4hc"},
    "blosc_zlib": {"compression": "blosc_zlib"},
    "blosc_zstd": {"compression": "blosc_zstd"},
    # Not built into the WASM module: reading it must fail cleanly
    "szip": {"compression": "szip"},
}


def compression():
    data = (np.arange(40 * 50).reshape(40, 50) % 97).astype("f4")
    for name, options in COMPRESSIONS.items():
        path = OUT / f"compression-{name}.nc"
        with netCDF4.Dataset(path, "w", format="NETCDF4") as ds:
            ds.createDimension("y", 40)
            ds.createDimension("x", 50)
            # netCDF4-python enables the HDF5 shuffle filter by default
            options = {"shuffle": False, **options}
            var = ds.createVariable(
                "data", "f4", ("y", "x"), chunksizes=(10, 50), **options
            )
            var[:] = data


if __name__ == "__main__":
    basic()
    types()
    enum_fill()
    groups()
    classic()
    compression()
    for path in sorted(OUT.glob("*.nc")):
        print(f"{path.name:32} {path.stat().st_size:7} bytes")
