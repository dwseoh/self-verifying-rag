# C/C++ conventions — generic embedded / systems style

## C_STYLE_001: Include hygiene

- Prefer `#include "project/header.h"` for project headers; system headers use `#include <...>`.
- Headers must use include guards or `#pragma once`.
- Do not include heavy headers from public API headers when a forward declaration suffices.
- Keep include order: related header, project headers, then system headers.

## C_STYLE_002: Error handling

- Check return codes from syscalls, HAL calls, and library functions — do not ignore `errno` or negative status values.
- Propagate errors to callers with consistent codes; avoid silent failure in CLI or command paths.
- Log or report failures at boundaries (CLI exit codes, API responses) — not deep inside hot loops.

## C_STYLE_003: Memory and concurrency

- No `malloc` / `free` (or `new` / `delete`) in interrupt service routines or signal handlers.
- Prefer stack allocation or static pools for bounded real-time paths.
- Document ownership when passing pointers across modules.

## C_STYLE_004: Module boundaries

- Tooling and CLI layers must not bypass service APIs to reach hardware or driver internals directly.
- Shared types live in dedicated headers; avoid circular includes between subsystems.
