// Re-export barrel used by e2e tests and any backend module that needs engine
// symbols without a long relative path.  @splendor/engine is the workspace
// package at packages/engine; both the compiled backend and ts-jest tests
// resolve it via the pnpm workspace.
export * from "@splendor/engine";
