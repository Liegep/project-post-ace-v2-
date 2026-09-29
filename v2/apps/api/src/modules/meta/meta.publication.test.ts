import assert from "node:assert/strict";
import test from "node:test";
import { planMetaCardPublications } from "./meta.publication.js";

const imageUrls = (count: number) => Array.from({ length: count }, (_, index) => `https://cdn.example.com/image-${index + 1}.jpg`);
const tag = { username: "designhub", x: 0.5, y: 0.4 };

test("one image keeps the existing Instagram image flow", () => {
  const result = planMetaCardPublications({ platforms: ["instagram"], mediaUrls: imageUrls(1), mediaType: "image", artType: "Post único", locationId: null, instagramUserTags: [tag] });
  assert.equal(result.error, null);
  assert.equal(result.plans?.[0]?.mediaType, "image");
  assert.deepEqual(result.plans?.[0]?.instagramUserTags, [tag]);
});

test("two images select the Instagram carousel flow without user tags", () => {
  const result = planMetaCardPublications({ platforms: ["instagram"], mediaUrls: imageUrls(2), mediaType: "image", artType: "Carrossel", locationId: null, instagramUserTags: [tag] });
  assert.equal(result.error, null);
  assert.equal(result.plans?.[0]?.mediaType, "carousel");
  assert.deepEqual(result.plans?.[0]?.instagramUserTags, []);
});

test("ten images are allowed in an Instagram carousel", () => {
  const result = planMetaCardPublications({ platforms: ["instagram"], mediaUrls: imageUrls(10), mediaType: "image", artType: "Carrossel", locationId: null, instagramUserTags: [] });
  assert.equal(result.error, null);
  assert.equal(result.plans?.[0]?.mediaUrls.length, 10);
});

test("eleven images are rejected", () => {
  const result = planMetaCardPublications({ platforms: ["instagram"], mediaUrls: imageUrls(11), mediaType: "image", artType: "Carrossel", locationId: null, instagramUserTags: [] });
  assert.match(result.error ?? "", /máximo 10 imagens/i);
});

test("a carousel cannot be scheduled for Facebook", () => {
  const result = planMetaCardPublications({ platforms: ["instagram", "facebook"], mediaUrls: imageUrls(2), mediaType: "image", artType: "Carrossel", locationId: null, instagramUserTags: [] });
  assert.match(result.error ?? "", /somente no Instagram/i);
});

test("carousel keeps location on its main publication plan", () => {
  const result = planMetaCardPublications({ platforms: ["instagram"], mediaUrls: imageUrls(3), mediaType: "image", artType: "Carrossel", locationId: "123456789", instagramUserTags: [tag] });
  assert.equal(result.error, null);
  assert.equal(result.plans?.[0]?.locationId, "123456789");
  assert.deepEqual(result.plans?.[0]?.instagramUserTags, []);
});

test("one MP4 is classified as an Instagram Reel", () => {
  const result = planMetaCardPublications({
    platforms: ["instagram"],
    mediaUrls: ["https://cdn.example.com/reel.mp4"],
    mediaType: "video",
    artType: "Reels",
    locationId: "123456789",
    instagramUserTags: [tag],
  });
  assert.equal(result.error, null);
  assert.equal(result.plans?.[0]?.mediaType, "reel");
  assert.equal(result.plans?.[0]?.locationId, null);
  assert.deepEqual(result.plans?.[0]?.instagramUserTags, []);
  assert.equal(result.plans?.[0]?.reelCoverUrl, null);
});

test("a Reel keeps an optional uploaded cover reference", () => {
  const result = planMetaCardPublications({
    platforms: ["instagram"],
    mediaUrls: ["https://cdn.example.com/reel.mp4"],
    mediaType: "video",
    artType: "Reels",
    reelCoverUrl: "/api/uploads/cover.webp",
    locationId: null,
    instagramUserTags: [],
  });
  assert.equal(result.error, null);
  assert.equal(result.plans?.[0]?.reelCoverUrl, "/api/uploads/cover.webp");
});

test("an invalid Reel cover is rejected", () => {
  const result = planMetaCardPublications({
    platforms: ["instagram"],
    mediaUrls: ["https://cdn.example.com/reel.mp4"],
    mediaType: "video",
    artType: "Reels",
    reelCoverUrl: "https://cdn.example.com/cover.mp4",
    locationId: null,
    instagramUserTags: [],
  });
  assert.match(result.error ?? "", /capa.+imagem/i);
});

test("image and carousel plans never receive a Reel cover", () => {
  const image = planMetaCardPublications({ platforms: ["instagram"], mediaUrls: imageUrls(1), mediaType: "image", artType: "Post único", reelCoverUrl: "/api/uploads/cover.webp", locationId: null, instagramUserTags: [] });
  const carousel = planMetaCardPublications({ platforms: ["instagram"], mediaUrls: imageUrls(2), mediaType: "image", artType: "Carrossel", reelCoverUrl: "/api/uploads/cover.webp", locationId: null, instagramUserTags: [] });
  assert.equal(image.plans?.[0]?.reelCoverUrl, null);
  assert.equal(carousel.plans?.[0]?.reelCoverUrl, null);
});

test("Reel cannot be scheduled for Facebook", () => {
  const result = planMetaCardPublications({ platforms: ["facebook"], mediaUrls: ["https://cdn.example.com/reel.mov"], mediaType: "video", artType: "Reels", locationId: null, instagramUserTags: [] });
  assert.match(result.error ?? "", /somente no Instagram/i);
});

test("multiple videos are rejected", () => {
  const result = planMetaCardPublications({ platforms: ["instagram"], mediaUrls: ["https://cdn.example.com/one.mp4", "https://cdn.example.com/two.mp4"], mediaType: "video", artType: "Reels", locationId: null, instagramUserTags: [] });
  assert.match(result.error ?? "", /somente um vídeo/i);
});

test("mixed video and image media are rejected", () => {
  const result = planMetaCardPublications({ platforms: ["instagram"], mediaUrls: ["https://cdn.example.com/reel.mp4", ...imageUrls(1)], mediaType: "video", artType: "Reels", locationId: null, instagramUserTags: [] });
  assert.match(result.error ?? "", /não misture vídeo com imagens/i);
});
