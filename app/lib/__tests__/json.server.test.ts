import { describe, test, expect } from "vitest";
import { json } from "../json.server";

describe("json", () => {
  test("returns Response with JSON data", async () => {
    const data = { message: "success" };
    const response = json(data);

    expect(response).toBeInstanceOf(Response);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = await response.json();
    expect(body).toEqual(data);
  });

  test("sets status code when number provided", async () => {
    const data = { error: "not found" };
    const response = json(data, 404);

    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body).toEqual(data);
  });

  test("accepts ResponseInit object", async () => {
    const data = { message: "created" };
    const response = json(data, { status: 201, statusText: "Created" });

    expect(response.status).toBe(201);
    expect(response.statusText).toBe("Created");

    const body = await response.json();
    expect(body).toEqual(data);
  });

  test("accepts custom headers in ResponseInit", async () => {
    const data = { message: "success" };
    const response = json(data, {
      headers: { "X-Custom-Header": "test-value" },
    });

    expect(response.headers.get("X-Custom-Header")).toBe("test-value");

    const body = await response.json();
    expect(body).toEqual(data);
  });

  test("handles complex data structures", async () => {
    const data = {
      users: [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ],
      meta: { total: 2, page: 1 },
    };
    const response = json(data);

    const body = await response.json();
    expect(body).toEqual(data);
  });

  test("handles null data", async () => {
    const response = json(null);

    const body = await response.json();
    expect(body).toBeNull();
  });

  test("handles empty object", async () => {
    const data = {};
    const response = json(data);

    const body = await response.json();
    expect(body).toEqual({});
  });

  test("handles empty array", async () => {
    const data: any[] = [];
    const response = json(data);

    const body = await response.json();
    expect(body).toEqual([]);
  });

  test("handles string data", async () => {
    const data = "simple string";
    const response = json(data);

    const body = await response.json();
    expect(body).toBe(data);
  });

  test("handles number data", async () => {
    const data = 42;
    const response = json(data);

    const body = await response.json();
    expect(body).toBe(data);
  });

  test("handles boolean data", async () => {
    const data = true;
    const response = json(data);

    const body = await response.json();
    expect(body).toBe(data);
  });

  test("defaults to 200 status when no status provided", () => {
    const data = { message: "ok" };
    const response = json(data);

    expect(response.status).toBe(200);
  });

  test("combines status and headers correctly", async () => {
    const data = { error: "unauthorized" };
    const response = json(data, {
      status: 401,
      headers: { "WWW-Authenticate": "Bearer" },
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");

    const body = await response.json();
    expect(body).toEqual(data);
  });
});
