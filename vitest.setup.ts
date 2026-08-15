// vitest.setup.ts
import { vi } from "vitest";
import Module from "module";

// Mock next/server and next/headers before any test files import them
vi.mock("next/server", () => ({
  NextRequest: class {},
}), { virtual: true });

vi.mock("next/headers", () => ({
  headers: vi.fn(() => ({
    get: vi.fn(),
  })),
}), { virtual: true });

vi.mock("next-auth/jwt", () => ({
  getToken: vi.fn(),
}), { virtual: true });

vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
  AuthError: class AuthError extends Error {
    static type = "AuthError";
  },
}), { virtual: true });

// Override require resolution for modules that are already loaded
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id: string) {
  if (id === "next/server") {
    return { NextRequest: class {} };
  }
  if (id === "next/headers") {
    return { headers: () => ({ get: () => null }) };
  }
  return originalRequire.apply(this, arguments as any);
};

