import { describe, expect, it } from "vitest";

import { getServerApiBaseUrl, withApiBase } from "./api-base-url";

describe("api-base-url", () => {
  it("uses API_BASE_URL when provided", () => {
    const previous = process.env.API_BASE_URL;
    process.env.API_BASE_URL = "https://api.vsezapchasti.ru/";

    expect(getServerApiBaseUrl()).toBe("https://api.vsezapchasti.ru");

    process.env.API_BASE_URL = previous;
  });

  it("falls back to localhost in server environment", () => {
    const previousApi = process.env.API_BASE_URL;
    const previousPublic = process.env.NEXT_PUBLIC_API_BASE_URL;

    delete process.env.API_BASE_URL;
    delete process.env.NEXT_PUBLIC_API_BASE_URL;

    expect(getServerApiBaseUrl()).toBe("http://localhost:8000");

    process.env.API_BASE_URL = previousApi;
    process.env.NEXT_PUBLIC_API_BASE_URL = previousPublic;
  });

  it("joins base url and path safely", () => {
    expect(withApiBase("https://api.vsezapchasti.ru", "/api/health")).toBe(
      "https://api.vsezapchasti.ru/api/health",
    );
    expect(
      withApiBase("https://api.vsezapchasti.ru", "api/public/content"),
    ).toBe("https://api.vsezapchasti.ru/api/public/content");
  });
});
