# SkinCart AI

SkinCart AI is an explainable cosmetic shopping prototype for the YouCam API Skin AI & eCommerce VTO Hackathon 2026.

## Flow
1. Shopper uploads a front-facing selfie or uses the official YouCam sample.
2. Server calls YouCam Skin Analysis V2.1 with eight HD cosmetic signals.
3. Lowest cosmetic scores become shopping priorities.
4. SkinCart creates a three-step sample routine and explains each selection.

## YouCam integration
- File upload: POST /s2s/v2.0/file
- Analysis: POST /s2s/v2.1/task/skin-analysis
- Polling: GET /s2s/v2.1/task/skin-analysis/{task_id}
- API secret: server-side environment variable only: YOUCAM_API_KEY

The eight HD actions are hydration, oil balance, radiance, visible redness, dark-circle appearance, pore appearance, texture, and skin type.

## Safety and privacy
SkinCart is cosmetic product-discovery software, not medical advice or diagnosis.
The app does not intentionally persist shopper images or results.
Never commit .env files or API keys.

