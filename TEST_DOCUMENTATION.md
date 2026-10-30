# NetCDF4-WASM Test Suite Documentation

This document describes the comprehensive test suite created for netcdf4-wasm, following patterns from the Python netcdf4-python library.

## Test Structure

The test suite is organized into multiple files, each focusing on specific functionality areas:

### Core Test Files

1. **`test-setup.ts`** - Test utilities and setup functions
2. **`test-dataset.test.ts`** - Dataset creation and basic I/O operations
3. **`test-dimensions.test.ts`** - Dimension creation and management
4. **`test-variables.test.ts`** - Variable definition and data handling
5. **`test-attributes.test.ts`** - Attribute setting and retrieval (global, variable, group)
6. **`test-datatypes.test.ts`** - Data types, array handling, and numeric edge cases
7. **`test-integration.test.ts`** - Comprehensive end-to-end workflows

## Test Categories

### Dataset Tests (`test-dataset.test.ts`)

- **Dataset Construction**: Factory methods, class methods, direct instantiation
- **File Modes**: Read, write, append mode handling
- **File Formats**: NetCDF4 format support and validation
- **Dataset Properties**: File paths, open/closed state tracking
- **Error Handling**: Invalid modes, file operation errors
- **Context Management**: Python-like `__aenter__`/`__aexit__` patterns

### Dimension Tests (`test-dimensions.test.ts`)

- **Dimension Creation**: Fixed-size and unlimited dimensions
- **Dimension Properties**: Name, size, unlimited status
- **Dimension Collections**: Management of dimension dictionaries
- **Edge Cases**: Zero-sized, large dimensions, validation
- **Group Dimensions**: Hierarchical dimension organization

### Variable Tests (`test-variables.test.ts`)

- **Variable Creation**: Scalar and multi-dimensional variables
- **Data Types**: Support for f8, f4, i4, i2, i1, S1 and alternative names
- **Variable Options**: Compression, chunking parameters
- **Data I/O**: Reading and writing variable data
- **Variable Collections**: Management of variable dictionaries
- **Error Handling**: Invalid types, undefined dimensions, type mismatches

### Attribute Tests (`test-attributes.test.ts`)

- **Global Attributes**: String, numeric, and special value attributes
- **Variable Attributes**: CF convention attributes, property-style access
- **Group Attributes**: Hierarchical attribute organization
- **Edge Cases**: Empty strings, unicode, null/undefined values
- **CF Conventions**: Climate and Forecast metadata standards

### Data Type Tests (`test-datatypes.test.ts`)

- **Data Type Constants**: NetCDF constant verification
- **Supported Types**: All netCDF data type support
- **Array Handling**: 1D, 2D, 3D, 4D, and scalar arrays
- **Special Values**: NaN, Infinity, extreme numbers
- **Performance**: Large array handling and memory management
- **Limitations**: Current implementation constraints

### Integration Tests (`test-integration.test.ts`)

- **Climate Dataset**: Complete CF-compliant climate data workflow
- **Multi-Group Dataset**: Hierarchical data organization
- **Read/Write Workflow**: Complex file operations and data persistence
- **Error Recovery**: Incomplete datasets and edge case handling

## Test Features

### Python API Compatibility

- Tests follow netcdf4-python patterns and conventions
- Comprehensive attribute testing matching Python library
- Dimension and variable management similar to Python Dataset
- Error handling patterns consistent with Python exceptions

### Mock and Real Testing

- **Mock Mode**: Tests run without WASM module for interface validation
- **Real Mode**: Full integration tests when WASM module is available
- Graceful fallback when WASM is not available
- Interface consistency verification regardless of backend

### CF Convention Support

- Climate and Forecast metadata convention testing
- Standard attribute validation
- Coordinate variable patterns
- Global attribute requirements

### Data Integrity

- Comprehensive array comparison utilities
- Floating-point precision handling
- Large dataset validation
- Memory leak prevention testing

## Running Tests

### Basic Test Execution

```bash
npm test                    # Run all tests
npm run test:watch         # Watch mode for development
npm run test:coverage      # Generate coverage report
```

### Test Configuration

- **Timeout**: 30 seconds for integration tests
- **Setup**: Mock environment configuration
- **Cleanup**: Automatic test file cleanup
- **Utilities**: Shared test data generation

### Test Data Patterns

- **Temperature Data**: Realistic climate patterns
- **Array Patterns**: Mathematical sequences and patterns
- **Special Values**: NaN, Infinity, extreme numbers
- **CF Examples**: Standard meteorological datasets

## Test Coverage

The test suite covers:

✅ **Dataset Operations**
- File creation, opening, closing
- Mode handling (read, write, append)
- Error conditions and recovery

✅ **Data Structure Management**
- Dimensions (fixed, unlimited, hierarchical)
- Variables (scalar, multi-dimensional)
- Groups (nested organization)

✅ **Attribute Handling**
- Global, variable, and group attributes
- CF convention compliance
- Property-style access patterns

✅ **Data Types and Arrays**
- All supported NetCDF data types
- Multi-dimensional array operations
- Special numeric values

✅ **Integration Workflows**
- Complete dataset creation pipelines
- Real-world usage patterns
- Performance and memory testing

## Python netcdf4 Pattern Adherence

This test suite closely follows the testing patterns established in the Python netcdf4 library:

- **Test Organization**: Similar file structure and categorization
- **Assertion Patterns**: Comparable validation approaches
- **Edge Case Coverage**: Matching boundary condition testing
- **CF Convention Testing**: Equivalent metadata validation
- **Error Handling**: Similar exception and error patterns

The goal is to ensure that users familiar with netcdf4-python will find a consistent and reliable experience with netcdf4-wasm.
