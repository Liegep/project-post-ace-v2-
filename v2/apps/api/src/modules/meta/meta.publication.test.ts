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

test("two images are allowed in a Facebook carousel", () => {
  const result = planMetaCardPublications({ platforms: ["facebook"], mediaUrls: imageUrls(2), mediaType: "image", artType: "Carrossel", locationId: null, instagramUserTags: [] });
  assert.equal(result.error, null);
  assert.equal(result.plans?.[0]?.mediaType, "carousel");
  assert.equal(result.plans?.[0]?.mediaUrls.length, 2);
});

test("ten images are allowed in a Facebook carousel", () => {
  const result = planMetaCardPublications({ platforms: ["facebook"], mediaUrls: imageUrls(10), mediaType: "image", artType: "Carrossel", locationId: null, instagramUserTags: [] });
  assert.equal(result.error, null);
  assert.equal(result.plans?.[0]?.mediaUrls.length, 10);
});

test("one carousel creates independent Instagram and Facebook plans", () => {
  const result = planMetaCardPublications({ platforms: ["instagram", "facebook"], mediaUrls: imageUrls(2), mediaType: "image", artType: "Carrossel", locationId: null, instagramUserTags: [] });
  assert.equal(result.error, null);
  assert.deepEqual(result.plans?.map((plan) => ({ platform: plan.platform, mediaType: plan.mediaType, mediaUrls: plan.mediaUrls })), [
    { platform: "instagram", mediaType: "carousel", mediaUrls: imageUrls(2) },
    { platform: "facebook", mediaType: "carousel", mediaUrls: imageUrls(2) },
  ]);
});

test("carousel keeps location on its main publication plan", () => {
  const result = planMetaCardPublications({ platforms: ["instagram"], mediaUrls: imageUrls(3), mediaType: "image", artType: "Carrossel", locationId: "123456789", instagramUserTags: [tag] });
  assert.equal(result.error, null);
  assert.equal(result.plans?.[0]?.locationId, "123456789");
  assert.deepEqual(result.plans?.[0]?.instagramUserTags, []);
});

test("one image is allowed as an Instagram Story without tags, location or Reel cover", () => {
  const result = planMetaCardPublications({
    platforms: ["instagram"],
    mediaUrls: imageUrls(1),
    mediaType: "image",
    artType: "Story",
    reelCoverUrl: "/api/uploads/cover.webp",
    locationId: "123456789",
    instagramUserTags: [tag],
  });
  assert.equal(result.error, null);
  assert.equal(result.plans?.[0]?.mediaType, "story");
  assert.equal(result.plans?.[0]?.reelCoverUrl, null);
  assert.equal(result.plans?.[0]?.locationId, null);
  assert.deepEqual(result.plans?.[0]?.instagramUserTags, []);
});

test("one MP4 is allowed as an Instagram Story", () => {
  const result = planMetaCardPublications({ platforms: ["instagram"], mediaUrls: ["https://cdn.example.com/story.mp4"], mediaType: "video", artType: "Stories", locationId: null, instagramUserTags: [] });
  assert.equal(result.error, null);
  assert.equal(result.plans?.[0]?.mediaType, "story");
});

test("the scheduling format override can publish a regular card as a Story", () => {
  const result = planMetaCardPublications({ platforms: ["instagram"], mediaUrls: imageUrls(1), mediaType: "image", artType: "Post único", publicationFormat: "story", locationId: null, instagramUserTags: [] });
  assert.equal(result.error, null);
  assert.equal(result.plans?.[0]?.mediaType, "story");
});

test("multiple media items are rejected for Stories", () => {
  const images = planMetaCardPublications({ platforms: ["instagram"], mediaUrls: imageUrls(2), mediaType: "image", artType: "Story", locationId: null, instagramUserTags: [] });
  const videos = planMetaCardPublications({ platforms: ["instagram"], mediaUrls: ["https://cdn.example.com/one.mp4", "https://cdn.example.com/two.mp4"], mediaType: "video", artType: "Story", locationId: null, instagramUserTags: [] });
  const mixed = planMetaCardPublications({ platforms: ["instagram"], mediaUrls: [imageUrls(1)[0], "https://cdn.example.com/story.mp4"], mediaType: "video", artType: "Story", locationId: null, instagramUserTags: [] });
  assert.match(images.error ?? "", /exatamente uma/i);
  assert.match(videos.error ?? "", /exatamente uma/i);
  assert.match(mixed.error ?? "", /exatamente uma/i);
});

test("a Facebook image Story is allowed", () => {
  const result = planMetaCardPublications({ platforms: ["facebook"], mediaUrls: imageUrls(1), mediaType: "image", artType: "Story", locationId: null, instagramUserTags: [] });
  assert.equal(result.error, null);
  assert.equal(result.plans?.[0]?.platform, "facebook");
  assert.equal(result.plans?.[0]?.mediaType, "story");
});

test("a Facebook video Story is allowed", () => {
  const result = planMetaCardPublications({ platforms: ["facebook"], mediaUrls: ["https://cdn.example.com/story.mp4"], mediaType: "video", artType: "Story", locationId: null, instagramUserTags: [] });
  assert.equal(result.error, null);
  assert.equal(result.plans?.[0]?.mediaType, "story");
});

test("an Instagram and Facebook Story creates one independent plan per platform", () => {
  const result = planMetaCardPublications({ platforms: ["instagram", "facebook"], mediaUrls: imageUrls(1), mediaType: "image", artType: "Story", locationId: "123", instagramUserTags: [tag] });
  assert.equal(result.error, null);
  assert.deepEqual(result.plans?.map((plan) => ({ platform: plan.platform, mediaType: plan.mediaType, locationId: plan.locationId, tags: plan.instagramUserTags })), [
    { platform: "instagram", mediaType: "story", locationId: null, tags: [] },
    { platform: "facebook", mediaType: "story", locationId: null, tags: [] },
  ]);
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

test("a Reel can be scheduled for Facebook with its location", () => {
  const result = planMetaCardPublications({ platforms: ["facebook"], mediaUrls: ["https://cdn.example.com/reel.mov"], mediaType: "video", artType: "Reels", locationId: "123456789", instagramUserTags: [] });
  assert.equal(result.error, null);
  assert.equal(result.plans?.[0]?.mediaType, "reel");
  assert.equal(result.plans?.[0]?.locationId, "123456789");
});

test("one Reel creates independent Instagram and Facebook plans", () => {
  const result = planMetaCardPublications({
    platforms: ["instagram", "facebook"],
    mediaUrls: ["https://cdn.example.com/reel.mp4"],
    mediaType: "video",
    artType: "Reels",
    reelCoverUrl: "/api/uploads/cover.webp",
    locationId: "123456789",
    instagramUserTags: [],
  });
  assert.equal(result.error, null);
  assert.equal(result.plans?.length, 2);
  assert.deepEqual(result.plans?.map((plan) => ({ platform: plan.platform, mediaType: plan.mediaType, cover: plan.reelCoverUrl, location: plan.locationId })), [
    { platform: "instagram", mediaType: "reel", cover: "/api/uploads/cover.webp", location: null },
    { platform: "facebook", mediaType: "reel", cover: "/api/uploads/cover.webp", location: "123456789" },
  ]);
});

test("multiple videos are rejected", () => {
  const result = planMetaCardPublications({ platforms: ["instagram"], mediaUrls: ["https://cdn.example.com/one.mp4", "https://cdn.example.com/two.mp4"], mediaType: "video", artType: "Reels", locationId: null, instagramUserTags: [] });
  assert.match(result.error ?? "", /somente um vídeo/i);
});

test("mixed video and image media are rejected", () => {
  const result = planMetaCardPublications({ platforms: ["instagram"], mediaUrls: ["https://cdn.example.com/reel.mp4", ...imageUrls(1)], mediaType: "video", artType: "Reels", locationId: null, instagramUserTags: [] });
  assert.match(result.error ?? "", /não misture vídeo com imagens/i);
});
