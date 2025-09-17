# Changelog

All notable changes for major version updates will be documented here.

## 4.0.0

Underlying package `redis` is updated from 3 to 5, which is natively promised based.  
Bluebird wrapper is removed, and all callback based methods.

### Added

- Package is now in typescript.

### Changed

- **Breaking:** Client is now based on redis@5 instead of redis@3.
- **Breaking:** All methods is now promised based instead of callback based.
- **Breaking:** Some methods have minor name changes, like `hgetall` -> `hGetAll`.

### Removed

- **Breaking:** All \*\*\*Async methods created by Bluebird is removed. Use `set` instead of `setAsync` etc..
- **Breaking:** Unused exports `connectClient` and `quit` removed.

## 3.4.0

### Changed

- `eslint` is now a devDependency rather than a full dependency.
