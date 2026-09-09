---
name: Artifact workflow working directories
description: A runtime path convention for files served by managed artifact workflows.
---

Managed artifact workflows execute from the artifact package directory rather than always from the workspace root.

**Why:** A relative path that includes the package directory twice works from the workspace root but fails in the managed workflow with a duplicated path segment.

**How to apply:** Resolve package-owned runtime assets from the package-local working directory, or use an explicit candidate-path strategy when a command may run from more than one directory.