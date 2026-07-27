# alleviate

## 0.2.3

### Patch Changes

- [#9](https://github.com/beeequeue/alleviate/pull/9) [`a673034`](https://github.com/beeequeue/alleviate/commit/a673034ae414a2c9f9bb40f5a20ec5b2055b75b0) Thanks [@beeequeue](https://github.com/beeequeue)! - Removed `fnva1-64` again as it killed performance

- [#9](https://github.com/beeequeue/alleviate/pull/9) [`a673034`](https://github.com/beeequeue/alleviate/commit/a673034ae414a2c9f9bb40f5a20ec5b2055b75b0) Thanks [@beeequeue](https://github.com/beeequeue)! - Optimized `memoize` and `DataLoader` performance.

## 0.2.2

### Patch Changes

- [`3ada5fa`](https://github.com/beeequeue/alleviate/commit/3ada5fafe020340348a47e1adaa112d9d48a247d) Thanks [@beeequeue](https://github.com/beeequeue)! - `memoize` and `DataLoader` now uses `fnv1a-64` for hashing in their serializer functions

## 0.2.1

### Patch Changes

- [`85f24d3`](https://github.com/beeequeue/alleviate/commit/85f24d3b5f8555e9d477aea4342cac036191482e) Thanks [@beeequeue](https://github.com/beeequeue)! - Fixed Limiter infinite loop with `refillInterval: 0`

## 0.2.0

### Minor Changes

- 4a937cb: Added `DataLoader` implementation

### Patch Changes

- 0c74ee7: Fixed `Limiter` timeout promise rejection not working properly
- e695003: Fixed browser usage by removing `node:crypto` requirement in `memoize`

## 0.1.1

### Patch Changes

- b68aa2c: Added `.delete()` to `LRU`

## 0.1.0

### Minor Changes

- Initial release
