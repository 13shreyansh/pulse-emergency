export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Pulse-specific
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY ?? "",
  vapiApiKey: process.env.VAPI_API_KEY ?? "",
  vapiPublicKey: process.env.VAPI_PUBLIC_KEY ?? "",
  tinyfishApiKey: process.env.TINYFISH_API_KEY ?? "",
  googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY ?? "",
  vapiPhoneNumberId: process.env.VAPI_PHONE_NUMBER_ID ?? "",
  demoTargetPhone: process.env.DEMO_TARGET_PHONE ?? "+919204151001",
};
