import assert from "node:assert/strict";
import test from "node:test";
import { metaPublicationPreviewSource } from "../src/metaPublicationPreview";

const publication = (overrides: Partial<Parameters<typeof metaPublicationPreviewSource>[0]> = {}) => ({ mediaUrl: null, mediaUrls: [], reelCoverUrl: null, ...overrides });

test("single image uses its media URL", () => {
  assert.deepEqual(metaPublicationPreviewSource(publication({ mediaUrl: "https://cdn.example.com/post.jpg" })), { url: "https://cdn.example.com/post.jpg", kind: "image" });
});

test("carousel uses its first image", () => {
  assert.equal(metaPublicationPreviewSource(publication({ mediaUrl: "https://cdn.example.com/fallback.jpg", mediaUrls: ["https://cdn.example.com/first.jpg", "https://cdn.example.com/second.jpg"] }))?.url, "https://cdn.example.com/first.jpg");
});

test("Reel cover takes precedence over video media", () => {
  assert.deepEqual(metaPublicationPreviewSource(publication({ reelCoverUrl: "https://cdn.example.com/cover.jpg", mediaUrls: ["https://cdn.example.com/reel.mp4"] })), { url: "https://cdn.example.com/cover.jpg", kind: "image" });
});

test("video fallback is identified and missing media has no preview", () => {
  assert.deepEqual(metaPublicationPreviewSource(publication({ mediaUrl: "https://cdn.example.com/reel.webm?token=safe" })), { url: "https://cdn.example.com/reel.webm?token=safe", kind: "video" });
  assert.equal(metaPublicationPreviewSource(publication()), null);
});
