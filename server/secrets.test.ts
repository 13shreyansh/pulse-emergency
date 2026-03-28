import { describe, expect, it } from "vitest";

describe("API secrets configuration", () => {
  it("has OPENAI_API_KEY set", () => {
    expect(process.env.OPENAI_API_KEY).toBeDefined();
    expect(process.env.OPENAI_API_KEY!.length).toBeGreaterThan(10);
  });

  it("has ELEVENLABS_API_KEY set", () => {
    expect(process.env.ELEVENLABS_API_KEY).toBeDefined();
    expect(process.env.ELEVENLABS_API_KEY!.length).toBeGreaterThan(10);
  });

  it("has VAPI_API_KEY set", () => {
    expect(process.env.VAPI_API_KEY).toBeDefined();
    expect(process.env.VAPI_API_KEY!.length).toBeGreaterThan(10);
  });

  it("has TINYFISH_API_KEY set", () => {
    expect(process.env.TINYFISH_API_KEY).toBeDefined();
    expect(process.env.TINYFISH_API_KEY!.length).toBeGreaterThan(10);
  });

  it("has GOOGLE_PLACES_API_KEY set", () => {
    expect(process.env.GOOGLE_PLACES_API_KEY).toBeDefined();
    expect(process.env.GOOGLE_PLACES_API_KEY!.length).toBeGreaterThan(10);
  });

  it("has VAPI_PHONE_NUMBER_ID set", () => {
    expect(process.env.VAPI_PHONE_NUMBER_ID).toBeDefined();
    expect(process.env.VAPI_PHONE_NUMBER_ID!.length).toBeGreaterThan(5);
  });

  it("has DEMO_TARGET_PHONE set", () => {
    expect(process.env.DEMO_TARGET_PHONE).toBeDefined();
    expect(process.env.DEMO_TARGET_PHONE).toContain("+");
  });

  it("OpenAI key can authenticate", async () => {
    const resp = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    });
    expect(resp.status).toBe(200);
  });
});
